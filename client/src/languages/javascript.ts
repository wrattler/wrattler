import {h,VNode} from 'maquette';
import * as Langs from '../definitions/languages';
import * as Graph from '../definitions/graph';
import * as Values from '../definitions/values';
import {createOutputPreview, createMonacoEditor} from '../editors/editor';

// import Plotly from 'Plotly';
import ts from 'typescript';
import axios from 'axios';
import {Md5} from 'ts-md5';
import {AsyncLazy} from '../common/lazy';
import * as Doc from '../services/documentService';
import { Log } from '../common/log';

// ------------------------------------------------------------------------------------------------
// Markdown plugin
// ------------------------------------------------------------------------------------------------

/// A class that represents a Markdown block. All blocks need to have
/// `language` and Markdown also keeps the Markdown source we edit and render

export class JavascriptBlockKind implements Langs.Block {
  language : string;
  source : string;

  constructor(source:string) {
    this.language = "javascript";
    this.source = source;
  }
}

export interface JavascriptSwitchTabEvent {
  kind: "switchtab"
  index: number
}

export type JavascriptEvent = JavascriptSwitchTabEvent

export type JavascriptState = {
  id: number
  block: JavascriptBlockKind
  tabID: number
}

async function getCachedOrEval(body, datastoreURI:string, argDictionary) : Promise<any> {
  let cacheUrl = datastoreURI.concat("/" + body.hash).concat("/.cached")
  try {
    let params = {headers: {'Accept': 'application/json'}}
    Log.trace("js", "Checking cached response: %s", cacheUrl)
    let response = await axios.get(cacheUrl, params)
    return {values: response.data, outputs: undefined}
  } catch(e) {
    Log.trace("js", "Checking failed at JS, calling eval (%s)", e)
    var addOutput = function(f) {
      outputs.push(f)
    }
    var outputs : ((id:string) => void)[] = [];
    let values : { (key:string) : any[] } = eval(body.code)(addOutput, argDictionary);
    return {values: values, outputs: outputs}
  }
}

async function getCodeResourcesAndExports(cache:Graph.NodeCache, scope: Langs.ScopeDictionary, source: string, resources:Array<Langs.Resource>): Promise<Langs.BindingResult> {
  let language = "javascript"
  let regex_global:RegExp = /^%global/;
  let regex_local:RegExp = /^%local/;

  let newResources : Array<Langs.Resource> = []
  function resourceExists(fileName):boolean{
    for (let r = 0; r < resources.length; r++) {
      if (resources[r].fileName == fileName)
        return true
    }
    return false
  }
  
  async function putResource(fileName:string, code: string) : Promise<string> {
    let hash = Md5.hashStr(fileName)
    try {
      let url = this.datastoreURI.concat("/"+hash).concat("/"+fileName)
      // let url = "http://wrattler_wrattler_data_store_1:7102"
      let headers = {'Content-Type': 'text/html'}
      var response = await axios.put(url, code, {headers: headers});
      return url
        // return "http://wrattler_wrattler_data_store_1:7102".concat("/"+hash).concat("/"+variableName)
    }
    catch (error) {
      throw error;
    }
  }

  let src = source.replace(/\r/g,'\n')
  let srcArray = src.split('\n')
  let strippedSrc = ''
  for (let l = 0; l < srcArray.length; l++) {
    
    if ((srcArray[l].match(regex_global))||(srcArray[l].match(regex_local))){
      let scope : "global" | "local" = srcArray[l].match(regex_global) ? 'global' : 'local'
      let resourceName = srcArray[l].split(' ')[1]
      if (!resourceExists(resourceName)) {
        let newResource:Langs.Resource = {fileName:resourceName, language:language, scope: scope, url:''}
        newResources.push(newResource)
      }
    }
    else {
      strippedSrc = strippedSrc.concat(srcArray[l]).concat('\n')
    }  
  }

  let tsSourceFile = ts.createSourceFile(
    __filename,
    strippedSrc,
    ts.ScriptTarget.Latest
  );
  
  let antecedents : Graph.Node[] = []
  function addAntedents(expr:ts.Node) {
    ts.forEachChild(expr, function(child) {
      switch(child.kind) {
        case ts.SyntaxKind.Identifier:
          // REVIEW: As above, 'escapedText' is actually '__String' which might cause problems
          let argumentName = <string>(<ts.Identifier>child).escapedText;
          if (argumentName in scope) {
            let antecedentNode = scope[argumentName]
            if (antecedents.indexOf(antecedentNode) == -1)
              antecedents.push(antecedentNode);
          }
          break;
      }
      addAntedents(child)
    })
  }
  addAntedents(tsSourceFile)
  
  let allHash = Md5.hashStr(antecedents.map(a => a.hash).join("-") + source)
  let initialNode:Graph.JsCodeNode = {
    language:"javascript",
    antecedents:antecedents,
    exportedVariables:[],
    kind: 'code',
    hash: <string>allHash,
    value: null,
    source: source,
    errors: []
  }
  let cachedNode = <Graph.JsCodeNode>cache.tryFindNode(initialNode)

  let dependencies:Graph.JsExportNode[] = [];

  function addExports(expr:ts.Node) {
    ts.forEachChild(expr, function(child) {
      switch(child.kind) {
        case ts.SyntaxKind.VariableStatement:
          let decl = (<ts.VariableStatement>child).declarationList.declarations[0].name
          // REVIEW: This could fail if 'decl' is 'BindingPattern' and not 'Identifier'
          // REVIEW: Also, TypeScript uses some strange '__String' that might not be valid 'string'
          let name = <string>(<ts.Identifier>decl).escapedText
          let exportNode:Graph.JsExportNode = {
            variableName: name,
            value: null,
            hash: <string>Md5.hashStr(allHash + name),
            language:"javascript",
            code: cachedNode,
            kind: 'export',
            antecedents:[cachedNode],
            errors:[]
            };
          let cachedExportNode = <Graph.JsExportNode>cache.tryFindNode(exportNode)
          dependencies.push(cachedExportNode);
          cachedNode.exportedVariables.push(cachedExportNode.variableName);
          break;
      }
      addExports(child)
    })
  }

  addExports(tsSourceFile)
  return {code: cachedNode, exports: dependencies, resources: newResources};
}

export const javascriptEditor : Langs.Editor<JavascriptState, JavascriptEvent> = {
  initialize: (id:number, block:Langs.Block) => {
    return { id: id, block: <JavascriptBlockKind>block, tabID:0}
  },

  update: (state:JavascriptState, event:JavascriptEvent) => {
    switch(event.kind) {
      case 'switchtab':
      {
        return { id: state.id, block: state.block, tabID: event.index }
      }
    }
    return state
  },

  render: (cell: Langs.BlockState, state:JavascriptState, context:Langs.EditorContext<JavascriptEvent>) => {
    let previewButton = h('button', 
      { class:'preview-button', onclick:() => { 
          Log.trace("editor", "Evaluate button clicked in external language plugin")
          context.evaluate(cell.editor.id) } }, ["Evaluate!"] )
    let spinner = h('i', {id:'cellSpinner_'+cell.editor.id, class: 'fas fa-spinner fa-spin' }, [])
    let triggerSelect = (t:number) => context.trigger({kind:'switchtab', index: t})
    let preview = h('div', {class:'preview'}, [(cell.code.value==undefined) ? (cell.evaluationState=='pending')?spinner:previewButton : (createOutputPreview(cell, triggerSelect, state.tabID, <Values.ExportsValue>cell.code.value))]);
    let code = createMonacoEditor("javascript", state.block.source, cell, context)
    return h('div', { }, [code, preview])
  }
}

export class JavascriptLanguagePlugin implements Langs.LanguagePlugin  {
  readonly language: string
  readonly iconClassName: string
  readonly editor: Langs.Editor<JavascriptState, JavascriptEvent>
  readonly datastoreURI:string

  constructor(datastoreURI:string) {
    this.language = "javascript"
    this.iconClassName= "fab fa-js-square"
    this.editor= javascriptEditor
    this.datastoreURI = datastoreURI
  }
  
  getDefaultCode(id:number):string {
    return "// This is a javascript cell. \n//var js" + id + " = [{'id':" + id + ", 'language':'javascript'}]"
  }

  async evaluate(context:Langs.EvaluationContext, node:Graph.Node) : Promise<Langs.EvaluationResult> {
    let jsnode = <Graph.JsNode>node
    let regex_global:RegExp = /^%global/;
    let regex_local:RegExp = /^%local/;

    async function putValue(variableName, hash, value, datastoreURI) : Promise<string> {
      let url = datastoreURI.concat("/"+hash).concat("/"+variableName)
      let headers = {'Content-Type': 'application/json'}
      try {
        var response = await axios.put(url, value, {headers: headers});
        return datastoreURI.concat("/"+hash).concat("/"+variableName)
        // return "http://wrattler_wrattler_data_store_1:7102".concat("/"+hash).concat("/"+variableName)
      }
      catch (error) {
        console.error(error);
        throw error
      }
    }

    async function putValues(values:{ (key:string) : any[] }, datastoreURI) : Promise<Values.ExportsValue> {
      try {
        var results : Values.ExportsValue = { kind:"exports", exports:{} }
        for (let value in values) {
          let dfString = JSON.stringify(values[value])
          let hash = Md5.hashStr(dfString)
          let df_url = await putValue(value, hash, dfString, datastoreURI)
          var exp : Values.DataFrame = {
            kind:"dataframe", 
            url: df_url, 
            data: new AsyncLazy(async () => values[value]), 
            preview:values[value].slice(0, 10)
          }
          results.exports[value] = exp
        }
        return results;
      }
      catch (error) {
        console.error(error);
        throw error
      }
    }

    switch(jsnode.kind) {
      case 'code':
        let returnArgs = "var __res = {};\n";
        let evalCode = "";
        let jsCodeNode = <Graph.JsCodeNode>node
        for (var e = 0; e < jsCodeNode.exportedVariables.length; e++) {
          var v = jsCodeNode.exportedVariables[e];
          returnArgs = returnArgs.concat("if (typeof(VAR)!='undefined') __res.VAR = VAR;\n".replace(/VAR/g, v));
        }
        returnArgs = returnArgs.concat("return __res;")
        let importedVars = "";
        var argDictionary:{[key: string]: any} = {}
        for (var i = 0; i < jsCodeNode.antecedents.length; i++) {
          let imported = <Graph.JsExportNode>jsCodeNode.antecedents[i]
          argDictionary[imported.variableName] = await (<Values.DataFrame>imported.value).data.getValue();
          importedVars = importedVars.concat("\nlet "+imported.variableName + " = args[\""+imported.variableName+"\"];");
        }
        let srcArray = jsCodeNode.source.split('\n')
        let strippedSrc = ''
        let importedFiles : Array<string> = [];
        for (let l = 0; l < srcArray.length; l++) {
          if (srcArray[l].match(regex_local)) {
            let resourceName = srcArray[l].split(' ')[1]
            importedFiles.push(resourceName)
          } else if (srcArray[l].match(regex_global)){
          }
          else {
            strippedSrc = strippedSrc.concat(srcArray[l]).concat('\n')
          }
        }
        
        for (let r = 0; r < context.resources.length; r++) {
          if ((context.resources[r].scope == 'global')&&(context.resources[r].language == 'javascript')) {
            importedFiles.push(context.resources[r].fileName)
          }
        }

        let importedResourceContent:string = ''
        for (let f = 0; f < importedFiles.length; f++) {
          importedResourceContent=importedResourceContent.concat(await Doc.getResourceContent(context.resourceServerUrl, importedFiles[f])).concat("\n")
        }

        evalCode = "(function f(addOutput, args) {\n\t " + importedVars + "\n" + importedResourceContent + "\n" +strippedSrc + "\n" + returnArgs + "\n})"
        // let values : { (key:string) : any[] } = eval(evalCode)(addOutput, argDictionary);
        let body = {"code": evalCode,
          "hash": jsnode.hash,
          "files" : importedFiles,
          "frames": importedVars}

        let response : {values:{ (key:string) : any[] }, outputs: any} = await getCachedOrEval(body, this.datastoreURI, argDictionary)
        let exports = await putValues(response.values, this.datastoreURI)
        for(let i = 0; i < response.outputs.length; i++) {
          var exp : Values.JavaScriptOutputValue = { kind:"jsoutput", render: response.outputs[i] }
          exports.exports["output" + i] = exp
        }
        return {kind: 'success', value: exports}
      case 'export':
        let jsExportNode = <Graph.JsExportNode>node
        let exportNodeName= jsExportNode.variableName
        let exportsValue = <Values.ExportsValue>jsExportNode.code.value
        // return exportsValue.exports[exportNodeName]
        return {kind: 'success', value: exportsValue.exports[exportNodeName]}
    }
  }

  parse (code:string): JavascriptBlockKind{
    return new JavascriptBlockKind(code);
  }
  
  async bind (context:Langs.BindingContext, block: Langs.Block):Promise<Langs.BindingResult> {
    let jsBlock = <JavascriptBlockKind>block
    return getCodeResourcesAndExports(context.cache, context.scope, jsBlock.source, context.resources);
  }

  save (block:Langs.Block) : string {
    let jsBlock:JavascriptBlockKind = <JavascriptBlockKind> block
    let content:string = ""
    content = content
      .concat("```javascript\n")
      .concat(jsBlock.source)
      .concat("\n")
      .concat("```\n")
    return content
  }
}

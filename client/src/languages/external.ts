import {h} from 'maquette';
import { Log } from "../common/log"
import * as Langs from '../definitions/languages'; 
import * as Graph from '../definitions/graph'; 
import * as Values from '../definitions/values'; 
import {createOutputPreview, createMonacoEditor} from '../editors/editor';
import {Md5} from 'ts-md5';
import axios from 'axios';
import {AsyncLazy} from '../common/lazy';
import * as Doc from '../services/documentService';

// ------------------------------------------------------------------------------------------------
// Helper functions for working with data store 
// ------------------------------------------------------------------------------------------------

async function getValue(blob, preview:boolean, datastoreURI:string) : Promise<any> {
  var pathname = new URL(blob).pathname;
  let headers = {'Accept': 'application/json'}
  let url = datastoreURI.concat(pathname)
  if (preview)
    url = url.concat("?nrow=10")
  try {
    Log.trace("external", "Fetching data frame: %s", url)
    let response = await axios.get(url, {headers: headers});
  
    Log.trace("external", "Got data frame (%s rows): %s", response.data.length, pathname)
    return response.data
  }
  catch (error) {
    throw error;
  }
}

async function getCachedOrEval(serviceUrl, body, datastoreURI) : Promise<any> {
  let cacheUrl = datastoreURI.concat("/" + body.hash).concat("/.cached")
  // try {
  //   let params = {headers: {'Accept': 'application/json'}}
  //   Log.trace("external", "Checking cached response: %s", cacheUrl)
  //   let response = await axios.get(cacheUrl, params)
  //   return response.data
  // } catch(e) {
  //  Log.trace("external", "Checking failed at external, calling eval (%s)", e)
    let params = { headers: {'Content-Type': 'application/json'} }        
    let result = await axios.post(serviceUrl.concat("/eval"), body, params)
    await axios.put(cacheUrl, result.data, params)
    return result.data
  //}
}

function parseScript(htmlResponse:string) {
  let scriptHeader = "<script type=\"text/javascript\">"
  console.log(htmlResponse.indexOf(scriptHeader))
  if (htmlResponse.indexOf(scriptHeader) > -1) {
    let script = htmlResponse.substring(htmlResponse.indexOf(scriptHeader)+scriptHeader.length, htmlResponse.indexOf("</script>"))
    let html = htmlResponse.substring(0,htmlResponse.indexOf(scriptHeader))
    html = html.concat(htmlResponse.substring(htmlResponse.indexOf("</script>")+9))
    return {"script":script, "html":html}
  }
  else {
    return {"script":"", "html":htmlResponse}
  }
}

function evalInlineScript(text:string) { 
  // var scr = document.createElement("script");
  // scr.innerHTML = text;
  // document.head.appendChild(scr);
  eval(text);
}

async function getEval(body, serviceURI, datastoreURI) : Promise<Langs.EvaluationResult> {  
  try {
    let response = await getCachedOrEval(serviceURI, body, datastoreURI);        
    var results : Values.ExportsValue = { kind:"exports", exports:{} }
    
    if (response.output.toString().length > 0){
      let printouts : Values.Printout = { kind:"printout", data:response.output.toString() }
      results.exports['console'] = printouts
    }
    
    for(let df of response.frames) {
      let exp : Values.DataFrame = 
        { kind:"dataframe", url:<string>df.url, 
          preview: await getValue(df.url, true, datastoreURI), // TODO: Just first X rows
          data: new AsyncLazy<any>(() => getValue(df.url,false,datastoreURI)) // TODO: This function is called later when JS calls data.getValue()
        };
      if (Array.isArray(exp.preview))
        results.exports[df.name] = exp
    }
    let figureIndex = 0;
    for(let df of response.figures) {
      let raw = await getValue(df.url,false,datastoreURI)
      let exp : Values.Figure = {kind:"figure", data: raw[0]['IMAGE']};
      results.exports['figure'+figureIndex.toString()] = exp
      figureIndex++;
    }
    
    if (response['html'])
      if (JSON.stringify(response.html) !=  "{}"){
        let parsed = parseScript(response.html.toString())
        if (parsed.script.length > 0)
          evalInlineScript(parsed.script)
        var output : ((id:string) => void) = function(f) {
          let element:HTMLElement | null= document.getElementById(f)
          if (element){
            // element.innerHTML = response.html.toString();
            element.innerHTML = parsed.html
            // element.onload = function() {loadInlineScript(parsed.script)}
            element.onload = function() {console.log("hll")}
          }
        };
        
        var exp : Values.JavaScriptOutputValue = { kind:"jsoutput", render: output }
        results.exports["output"] = exp
      }
    let evalResults:Langs.EvaluationResult = {kind: 'success', value: results} 
    return evalResults;
  }
  catch (error) {
    if (error.response != null) {
      let e = {message:<string>error.response.data.error}
      let evalResults:Langs.EvaluationResult = {kind: 'error', errors: [e]} 
      return evalResults
    }
    else {
      let e = {message:'Failed to evaluate'}
      let evalResults:Langs.EvaluationResult = {kind: 'error', errors: [e]} 
      return evalResults
    }
  }
}


// ------------------------------------------------------------------------------------------------
// External language (eg. Python, R) plugin
// ------------------------------------------------------------------------------------------------

/// A class that represents an external block. All blocks need to have 
/// `language` and "external" also keeps the source we edit and render


export class ExternalBlockKind implements Langs.Block {
  language : string;
  source : string;
  constructor(source:string, language: string) {
      this.language = language;
      this.source = source;
  }
}

export interface ExternalSwitchTabEvent {
  kind: "switchtab"
  index: number
}

export type ExternalEvent = ExternalSwitchTabEvent 

export type ExternalState = {
  id: number
  block: ExternalBlockKind
  tabID: number
}

export const ExternalEditor : Langs.Editor<ExternalState, ExternalEvent> = {
    
  initialize: (id:number, block:Langs.Block) => {  
      return { id: id, block: <ExternalBlockKind>block, tabID: 0}
  },

  update: (state:ExternalState, event:ExternalEvent) => {
    switch(event.kind) {
      case 'switchtab':
      {
        return { id: state.id, block: state.block, tabID: event.index }
      }
    }
    return state
  },

  render: (cell: Langs.BlockState, state:ExternalState, context:Langs.EditorContext<ExternalEvent>) => {    
    let previewButton = h('button', 
      { class:'preview-button', onclick:() => { 
          Log.trace("editor", "Evaluate button clicked in external language plugin")
          context.evaluate(cell.editor.id) } }, ["Evaluate!"] )
    let spinner = h('i', {id:'cellSpinner_'+cell.editor.id, class: 'fa fa-spinner fa-spin' }, [])
    let triggerSelect = (t:number) => context.trigger({kind:'switchtab', index: t})
    let preview = h('div', {class:'preview'}, [(cell.code.value==undefined) ? (cell.evaluationState=='pending')?spinner:previewButton : (createOutputPreview(cell, triggerSelect, state.tabID, <Values.ExportsValue>cell.code.value))]);
    Log.trace("render", "Source as passed to editor to render: %s", JSON.stringify(state.block.source))
    let code = createMonacoEditor(cell.code.language, state.block.source, cell, context)
    let errors = h('div', {}, [(cell.code.errors.length == 0) ? "" : cell.code.errors.map(err => {return h('p',{}, [err.message])})])
    let rendered = h('div', {key:"rendered_".concat(cell.editor.id.toString())}, [code, (cell.code.errors.length >0)?errors:preview])
    return rendered
  }
}

export class ExternalLanguagePlugin implements Langs.LanguagePlugin {
  readonly language: string;
  readonly iconClassName: string;
  readonly editor: Langs.Editor<ExternalState, ExternalEvent>;
  readonly serviceURI: string;
  readonly defaultCode : string;
  readonly regex_global:RegExp = /^%global/;
  readonly regex_local:RegExp = /^%local/;
  readonly datastoreURI: string;

  constructor(l: string, icon:string, serviceURI: string, code:string, datastoreUri: string) {
    this.language = l;
    this.iconClassName = icon;
    this.serviceURI = serviceURI;
    this.editor = ExternalEditor;
    this.defaultCode = code;
    this.datastoreURI = datastoreUri
  }

  getDefaultCode(id:number) {
    return this.defaultCode.replace(/\[ID\]/g, id.toString());
  }
  
  async evaluate(context:Langs.EvaluationContext, node:Graph.Node) : Promise<Langs.EvaluationResult> {
    let externalNode = <Graph.ExternalNode>node

    function findResourceURL(fileName): string {
      for (let f = 0; f < context.resources.length; f++) {
        if (context.resources[f].fileName==fileName) {
          return  context.resources[f].url
        }
      }
      return ''
    }

    switch(externalNode.kind) {
      case 'code': 
        let importedFrames : { name:string, url:string }[] = [];
        let importedFiles : Array<string> = [];
        for (var ant of externalNode.antecedents) {
          let imported = <Graph.ExportNode>ant
          importedFrames.push({ name: imported.variableName, url: (<Values.DataFrame>imported.value).url })
        }
        let src = externalNode.source.replace(/\r/g,'\n')
        
        let srcArray = src.split('\n')
        let strippedSrc = ''
        for (let l = 0; l < srcArray.length; l++) {
          if (srcArray[l].match(this.regex_local)) {
            let resourceName = srcArray[l].split(' ')[1]
            let resourceURL = findResourceURL(resourceName)
            if (resourceURL.length > 0){
              importedFiles.push(resourceURL)
            }  
          } else if (srcArray[l].match(this.regex_global)){
          }
          else {
            strippedSrc = strippedSrc.concat(srcArray[l]).concat('\n')
          }
        }

        for (let r = 0; r < context.resources.length; r++) {
          if ((context.resources[r].scope == 'global')&&(context.resources[r].language == externalNode.language)) {
            let resourceURL = findResourceURL(context.resources[r].fileName)
            if (resourceURL.length > 0){
              importedFiles.push(resourceURL)
            }  
          }
        }
        
        let body = {"code": strippedSrc,
          "hash": externalNode.hash,
          "files" : importedFiles,
          "frames": importedFrames}
        return await getEval(body, this.serviceURI, this.datastoreURI);
      case 'export':
        let exportNode = <Graph.ExternalExportNode>node
        let exportNodeName = exportNode.variableName
        let exportsValue = <Values.ExportsValue>exportNode.code.value
        if (exportsValue==null) {
          if (exportNode.errors.length > 0) {
            return {kind: 'error', errors: exportNode.errors} 
          }
          else {
            let errorMessage = "Fail to export".concat(exportNode.variableName);
            let graphError = {message: errorMessage}
            return {kind: 'error', errors: [graphError]} 
          }
        }
        else {
          return {kind: 'success', value: exportsValue.exports[exportNodeName]} 
        }
    }
  }

  parse (code:string) {
    return new ExternalBlockKind(code, this.language);
  }

  async bind (context:Langs.BindingContext, block: Langs.Block) : Promise<Langs.BindingResult> {
    let exBlock = <ExternalBlockKind>block
    let initialHash = Md5.hashStr(exBlock.source)
    let antecedents : Graph.Node[] = []
    let newResources : Array<Langs.Resource> = []
    function resourceExists(fileName):boolean{
      for (let r = 0; r < context.resources.length; r++) {
        if (context.resources[r].fileName == fileName)
          return true
      }
      return false
    }

    async function putResource(fileName:string, code: string, datastoreURI:string) : Promise<string> {
      let hash = Md5.hashStr(fileName)
      try {
        let url = datastoreURI.concat("/"+hash).concat("/"+fileName)
        // let url = "http://wrattler_wrattler_data_store_1:7102"
        let headers = {'Content-Type': 'text/html'}
        var response = await axios.put(url, code, {headers: headers});
        return url
          // return "http://wrattler_wrattler_data_store_1:7102".concat("/"+hash).concat("/"+variableName)
      }
      catch (error) {
        console.log(error)
        throw error;
      }
    }
    
    try {
      let url = this.serviceURI.concat("/exports")
      let src = exBlock.source.replace(/\r/g,'\n')
      let srcArray = src.split('\n')
      let strippedSrc = ''
      for (let l = 0; l < srcArray.length; l++) {
        if (srcArray[l].match(this.regex_global)){
          let resourceName = srcArray[l].split(' ')[1]
          if (!resourceExists(resourceName)) {
            let response = await Doc.getResourceContent(context.resourceServerUrl, resourceName)
            let newResource:Langs.Resource = {fileName:resourceName, language:this.language, scope: 'global', url:await putResource(resourceName, response,this.datastoreURI)}
            newResources.push(newResource)
          }
        }
        else if (srcArray[l].match(this.regex_local)) {
          let resourceName = srcArray[l].split(' ')[1]
          if (!resourceExists(resourceName)) {
            let response = await Doc.getResourceContent(context.resourceServerUrl, resourceName)
            let newResource:Langs.Resource = {fileName:resourceName, language:this.language, scope: 'local', url:await putResource(resourceName, response,this.datastoreURI)}
            newResources.push(newResource)
          }
        }
        else {
          strippedSrc = strippedSrc.concat(srcArray[l]).concat('\n')
        }
      }
      
      let body = 
        { "code": strippedSrc,
          "hash": initialHash,
          "frames": Object.keys(context.scope) }
      let headers = {'Content-Type': 'application/json'}
  
      let response = await axios.post(url, body, {headers: headers})
      // .then(response=> {
        let namesOfImports:Array<string> = []
        for (var n = 0 ; n < response.data.imports.length; n++) {
          if (namesOfImports.indexOf(response.data.imports[n]) < 0) {
            namesOfImports.push(response.data.imports[n])
            if (response.data.imports[n] in context.scope) {
              let antecedentNode = context.scope[response.data.imports[n]]
              antecedents.push(antecedentNode);
            }
          }
        }

        let allHash = Md5.hashStr(antecedents.map(a => a.hash).join("-") + exBlock.source)
        let initialNode:Graph.ExternalCodeNode = 
          { language:this.language, 
            antecedents:antecedents,
            exportedVariables:[],
            kind: 'code',
            value: null,
            hash: <string>allHash,
            source: exBlock.source,
            errors: []}
        let cachedNode = <Graph.ExternalCodeNode>context.cache.tryFindNode(initialNode)

        let namesOfExports:Array<string> = []
        let dependencies:Graph.ExternalExportNode[] = [];
        for (var n = 0 ; n < response.data.exports.length; n++) {
          if (namesOfExports.indexOf(response.data.exports[n]) < 0) {
            namesOfExports.push(response.data.exports[n])
            let exportNode:Graph.ExternalExportNode = {
                variableName: response.data.exports[n],
                value: null,
                language:this.language,
                code: cachedNode, 
                hash: <string>Md5.hashStr(allHash + response.data.exports[n]),
                kind: 'export',
                antecedents:[cachedNode],
                errors: []
                };
            let cachedExportNode = <Graph.ExternalExportNode>context.cache.tryFindNode(exportNode)
            dependencies.push(cachedExportNode) 
            cachedNode.exportedVariables.push(cachedExportNode.variableName)
          }
        }
        Log.trace("binding", "Binding external - hash: %s, dependencies: %s", allHash, cachedNode.antecedents.map(n => n.hash))
        return {code: cachedNode, exports: dependencies, resources:newResources};
   
    }
    catch (error) {
      let newError:Graph.Error = {message:error.response.data.error}
      let code = 
        { language:this.language, 
          antecedents:antecedents,
          exportedVariables:[],
          kind: 'code',
          value: null,
          hash: <string>Md5.hashStr(exBlock.source),
          source: exBlock.source,
          errors: [newError]}
      return {code: code, exports: [], resources:[]};
    }
  }

  save (block:Langs.Block) : string {
    let exBlock:ExternalBlockKind = <ExternalBlockKind> block
    let content:string = ""
    content = content
      .concat("```")
      .concat(exBlock.language)
      .concat("\n")
      .concat(exBlock.source)
      .concat("\n")
      .concat("```\n")
    return content
  }
}

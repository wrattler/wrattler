import {h} from 'maquette';
import { Log } from "../common/log"
import * as Langs from '../definitions/languages'; 
import * as Graph from '../definitions/graph'; 
import * as Values from '../definitions/values'; 
import {printPreview} from '../editors/preview'; 
import {createEditor} from '../editors/editor';
import {Md5} from 'ts-md5';
import axios from 'axios';

declare var DATASTORE_URI: string;

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
    let previewButton = h('button', { class:'preview-button', onclick:() => context.evaluate(cell) }, ["Evaluate"])
    let triggerSelect = (t:number) => context.trigger({kind:'switchtab', index: t})
    let preview = h('div', {class:'preview'}, [(cell.code.value==undefined) ? previewButton : (printPreview(cell.editor.id, triggerSelect, state.tabID, <Values.ExportsValue>cell.code.value))]);
    let code = createEditor(cell.code.language, state.block.source, cell, context)
    let errors = h('div', {}, [(cell.code.errors.length == 0) ? "" : cell.code.errors.map(err => {return h('p',{}, [err.message])})])
    return h('div', { }, [code, (cell.code.errors.length >0)?errors:preview])
  }
}

export class externalLanguagePlugin implements Langs.LanguagePlugin {
  readonly language: string;
  readonly editor: Langs.Editor<ExternalState, ExternalEvent>;
  readonly serviceURI: string;

  constructor(l: string, uri: string) {
    this.language = l;
    this.serviceURI = uri;
    this.editor = ExternalEditor;
  }

  async evaluate(node:Graph.Node) : Promise<Langs.EvaluationResult> {
    let externalNode = <Graph.ExternalNode>node

    async function getValue(blob) : Promise<Values.Value> {
      var pathname = new URL(blob).pathname;
      let headers = {'Content-Type': 'application/json'}
      let url = DATASTORE_URI.concat(pathname)
      try {
        Log.trace("data-store", "Fetching data frame: %s", pathname)
        let response = await axios.get(url, {headers: headers});
      
        Log.trace("data-store", "Got data frame (%s rows): %s", response.data.length, pathname)
        return response.data
      }
      catch (error) {
        throw error;
      }
    }
  
    async function getEval(body, serviceURI ) : Promise<Langs.EvaluationResult> {
      let url = serviceURI.concat("/eval")
      let headers = {'Content-Type': 'application/json'}
      try {
        let response = await axios.post(url, body, {headers: headers});        
        var results : Values.ExportsValue = { kind:"exports", exports:{} }
        
        if (response.data.output.toString().length > 0){
          let printouts : Values.Printout = { kind:"printout", data:response.data.output.toString() }
          results.exports['console'] = printouts
        }
        
        for(let df of response.data.frames) {
          let exp : Values.DataFrame = {kind:"dataframe", url:<string>df.url, data: await getValue(df.url)};
          if (Array.isArray(exp.data))
            results.exports[df.name] = exp
        }
        console.log(response.data)
        let figureIndex = 0;
        for(let df of response.data.figures) {
          let raw = await getValue(df.url)
          let exp : Values.Figure = {kind:"figure", data: raw[0]['IMAGE']};
          results.exports['figure'+figureIndex.toString()] = exp
          figureIndex++;
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
  
    switch(externalNode.kind) {
      case 'code': 
      console.log(externalNode)
        let importedFrames : { name:string, url:string }[] = [];
        for (var ant of externalNode.antecedents) {
          let imported = <Graph.ExportNode>ant
          importedFrames.push({ name: imported.variableName, url: (<Values.DataFrame>imported.value).url })
        }
        let src = externalNode.source
        let hash = Md5.hashStr(src)
        let body = {"code": src,
          "hash": hash,
          "frames": importedFrames}
        return await getEval(body, this.serviceURI);
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

  bind (scopeDictionary: Langs.ScopeDictionary, block: Langs.Block) : Promise<Langs.BindingResult> {
    let exBlock = <ExternalBlockKind>block
    let dependencies:Graph.ExternalExportNode[] = [];
    let node:Graph.ExternalCodeNode = {language:this.language, 
      antecedents:[],
      exportedVariables:[],
      kind: 'code',
      value: null,
      source: exBlock.source,
      errors: []}
    let url = this.serviceURI.concat("/exports")
    let hash = Md5.hashStr(exBlock.source)
    let body = {"code": exBlock.source,
      "hash": hash,
      "frames": Object.keys(scopeDictionary)
    }
    let headers = {'Content-Type': 'application/json'}
    async function getExports(language:string) {
      try {
        let response = await axios.post(url, body, {headers: headers});
        let namesOfExports:Array<string> = []
        for (var n = 0 ; n < response.data.exports.length; n++) {
          if (namesOfExports.indexOf(response.data.exports[n]) < 0) {
            namesOfExports.push(response.data.exports[n])
            let exportNode:Graph.ExternalExportNode = {
                variableName: response.data.exports[n],
                value: null,
                language:language,
                code: node, 
                kind: 'export',
                antecedents:[node],
                errors: []
                };
            dependencies.push(exportNode) 
            node.exportedVariables.push(exportNode.variableName)
          }
        }
        // console.log("Imp: "+JSON.stringify(response.data.imports))
        let namesOfImports:Array<string> = []
        for (var n = 0 ; n < response.data.imports.length; n++) {
          if (namesOfImports.indexOf(response.data.imports[n]) < 0) {
            namesOfImports.push(response.data.imports[n])
            if (response.data.imports[n] in scopeDictionary) {
              let antecedentNode = scopeDictionary[response.data.imports[n]]
              node.antecedents.push(antecedentNode);
            }
          }
        }
        // console.log(node)
        return {code: node, exports: dependencies};
      }
      catch (error) {
        console.error(error);
        node.errors.push(error)
        return {code: node, exports: []};
        // throw error
      }
    }
    return getExports(this.language)
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

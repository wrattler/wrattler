import {h} from 'maquette';
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
    let previewButton = h('button', { onclick:() => context.evaluate(cell) }, ["Preview"])
    let triggerSelect = (t:number) => context.trigger({kind:'switchtab', index: t})
    let preview = h('div', {}, [(cell.code.value==undefined) ? previewButton : (printPreview(cell.editor.id, triggerSelect, state.tabID, <Values.ExportsValue>cell.code.value))]);
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
        let response = await axios.get(url, {headers: headers});
        return response.data
      }
      catch (error) {
        console.error(error);
        throw error;
      }
    }
  
    async function getEval(body, serviceURI ) : Promise<Langs.EvaluationResult> {
      let url = serviceURI.concat("/eval")
      let headers = {'Content-Type': 'application/json'}
      try {
        let response = await axios.post(url, body, {headers: headers});
        // console.log(response)
        
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
        
        let evalResults:Langs.EvaluationResult = {kind: 'success', value: results} 
        return evalResults;
      }
      catch (error) {
        console.error(error);
        let evalResults:Langs.EvaluationResult = {kind: 'error', errors: [error]} 
        return evalResults
      }
    }
  
    switch(externalNode.kind) {
      case 'code': 
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
        let exportNodeName= exportNode.variableName
        let exportsValue = <Values.ExportsValue>exportNode.code.value
        let evalResults:Langs.EvaluationResult = {kind: 'success', value: exportsValue.exports[exportNodeName]} 
        //return exportsValue.exports[exportNodeName]
        return evalResults;
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
    console.log("Binding")
    async function getExports(language:string) {
      try {
        let response = await axios.post(url, body, {headers: headers});
        for (var n = 0 ; n < response.data.exports.length; n++) {
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
        for (var n = 0 ; n < response.data.imports.length; n++) {
          if (response.data.imports[n] in scopeDictionary) {
            let antecedentNode = scopeDictionary[response.data.imports[n]]
            node.antecedents.push(antecedentNode);
          }
        }
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
}

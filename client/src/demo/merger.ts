import * as Langs from '../definitions/languages'; 
import * as Graph from '../definitions/graph'; 
import * as Values from '../definitions/values'; 
import * as Editor from '../editors/editor'; 
import { h } from 'maquette';
import { Md5 } from 'ts-md5';
/*
import * as monaco from 'monaco-editor';
import marked from 'marked';
import { Value } from '../definitions/values';
import { Statement } from 'typescript';
import { Log } from '../common/log';
*/

interface MergerBlock extends Langs.Block {
  language : string
  output: string
  inputs: string[]
}

type MergerCheckEvent = { kind:'check', frame:string, selected:boolean }
type MergerNameEvent = { kind:'name', name:string }
type MergerEvent = MergerCheckEvent | MergerNameEvent

type MergerState = { 
  id: number
  block: MergerBlock
  selected: { [frame:string] : boolean }
  newName: string
}

const mergerEditor : Langs.Editor<MergerState, MergerEvent> = {
  initialize: (id:number, block:Langs.Block) => {  
    let mergerBlock = <MergerBlock>block
    var selected = {}
    for (let s of mergerBlock.inputs) selected[s] = true;
    return { id: id, block: <MergerBlock>block, selected:selected, newName:mergerBlock.output }
  },
  update: (state:MergerState, event:MergerEvent) => {
    switch(event.kind) {
      case 'check':
          var newSelected = { ...state.selected }
          newSelected[event.frame] = event.selected
          return {...state, selected:newSelected}
      case 'name':
          return {...state, newName:event.name}
    }
  },

  /*
  render: (cell:Langs.BlockState, state:MergerState, context:Langs.EditorContext<MergerEvent>) => {
    let source = state.newName + "=" + 
      Object.keys(state.selected).filter(s => state.selected[s]).join(",")
    let evalButton = h('button', { class:'preview-button', onclick:() => context.evaluate(cell) }, ["Evaluate"])
    return h('div', {}, [ 
      h('div', {key:'ed'}, [ Editor.createMonacoEditor("merger", source, cell, context) ]),
      h('div', {key:'prev'}, [
        (cell.code.value == null) ? evalButton : 
          Editor.createOutputPreview(cell, (_) => { }, 0, <Values.ExportsValue>cell.code.value)
      ])
    ]);
  }
  */

  render: (cell:Langs.BlockState, state:MergerState, context:Langs.EditorContext<MergerEvent>) => {
    let mergerNode = <MergerCodeNode>cell.code
    let source = state.newName + "=" + 
      Object.keys(state.selected).filter(s => state.selected[s]).join(",")
    return h('div', {}, [ 
      h('p', {}, [ "Choose data frames that you would like to merge:"] ),
      h('ul', {}, mergerNode.framesInScope.map(f => 
        h('li', { key:f }, [ 
          h('input', {id: "ch" + state.id + f, type: 'checkbox', checked: state.selected[f] ? true : false, onchange: (e) =>
            context.trigger({ kind:'check', frame:f, selected: (<any>e.target).checked })}, []), " ", 
          h('label', {for: "ch" + state.id + f}, [ f ]) 
        ]) 
      )),
      h('p', {}, ["Specify the name for the new merged data frame:"]),
      h('p', {}, [
        h('input', {key:'i1', type: 'text', value: state.newName, oninput: (e) =>
          context.trigger({ kind:'name', name:(<any>e.target).value }) }, []),
        h('input', {key:'i2', type: 'button', value: 'Rebind', onclick: () => 
          context.rebindSubsequent(cell, source) }, []),
        ( cell.code.value ? "" :
          h('input', {key:'i3', type: 'button', value: 'Evaluate', onclick: () => 
            context.evaluate(cell.editor.id) }, []) )            
      ])
    ])
  }
}

interface MergerCodeNode extends Graph.Node {
  kind: 'code'
  framesInScope: string[]
  output: string
  inputs: string[]
}

interface MergerExportNode extends Graph.ExportNode {
  kind: 'export'
  mergerNode: MergerCodeNode
}

type MergerNode = MergerCodeNode | MergerExportNode

export const mergerLanguagePlugin : Langs.LanguagePlugin = {
  language: "merger",
  iconClassName: "fa fa-object-group",
  editor: mergerEditor,
  getDefaultCode: (id:number) => "",
  parse: (code:string) : MergerBlock => {
    console.log("PARSE", code)
    let [outName, inputs] = code.split('=')
    return ({ language: "merger", output: outName, inputs: inputs?inputs.split(','):[] })
  },

  bind: async (context: Langs.BindingContext, block: Langs.Block) : Promise<Langs.BindingResult> => {
    let mergerBlock = <MergerBlock>block    
    let ml = mergerLanguagePlugin

    let ants = mergerBlock.inputs.map(inp => context.scope[inp])
    let node:MergerNode = 
      { kind: 'code',
        language: ml.language, antecedents: ants,
        hash: <string>Md5.hashStr(JSON.stringify(ml.save(block))),
        output: mergerBlock.output, inputs: mergerBlock.inputs,
        value: null, errors: [],
        framesInScope: Object.keys(context.scope) }
    
    var exps : MergerExportNode[] = []
    if (mergerBlock.output != "" && mergerBlock.inputs.length > 0) {
      let exp: MergerExportNode = 
        { kind: 'export',
          language: ml.language, antecedents: [node],
          hash: <string>Md5.hashStr(JSON.stringify(ml.save(block))),
          variableName: mergerBlock.output, 
          mergerNode: node,
          value: null, errors: [] }
      exps.push(exp);
    }

    return { code: node, exports: exps, resources: [] };
  },
  evaluate: async (context:Langs.EvaluationContext, node:Graph.Node) : Promise<Langs.EvaluationResult> => {
    let mergerNode = <MergerNode>node
    switch(mergerNode.kind) {
      case 'code':
        let vals = mergerNode.antecedents.map(n => <Values.KnownValue>n.value)
        let merged = await mergeDataFrames(mergerNode.output, mergerNode.hash, vals)      
        let res : { [key:string]: Values.KnownValue }= {}
        res[mergerNode.output] = merged
        let exps : Values.ExportsValue = { kind:"exports", exports: res }
        return { kind: "success", value: exps }
      case 'export':
        let expsVal = <Values.ExportsValue>mergerNode.mergerNode.value
        return { kind: "success", value: expsVal.exports[mergerNode.mergerNode.output] }
    }
  },

  save: (block:Langs.Block) => {
    let mergerBlock = <MergerBlock>block
    return mergerBlock.output + "=" + mergerBlock.inputs.join(",")
  },
}

import axios from 'axios';
import { AsyncLazy } from '../common/lazy';

declare var DATASTORE_URI: string;

async function putValue(variableName:string, hash:string, value:any[]) : Promise<string> {
  let url = DATASTORE_URI.concat("/" + hash).concat("/" + variableName)
  let headers = {'Content-Type': 'application/json'}
  await axios.put(url, value, {headers: headers});
  return url
}

async function mergeDataFrames(variableName:string, hash:string,
    vals:Values.KnownValue[]) : Promise<Values.DataFrame> {
  var allData : any[] = []
  for(let v of vals) {
    if (v.kind=='dataframe')
      allData = allData.concat(await v.data.getValue())
  }
  
  let lazyData = new AsyncLazy<any[]>(async () => allData)
  let preview = allData.slice(0, 100)

  let url = await putValue(variableName, hash, allData)
  return { kind: "dataframe", url: url, data: lazyData, preview: preview }
}
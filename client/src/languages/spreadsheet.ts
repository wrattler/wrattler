
import { h, VNode } from 'maquette';
import * as Langs from '../definitions/languages'; 
import * as Graph from '../definitions/graph'; 
import _ from 'lodash';
import { Md5 } from 'ts-md5';
import * as Values from '../definitions/values'; 
import { Log } from '../common/log';
import { updateArrayBindingPattern } from 'typescript';

type Position = {row:number, col: string}

interface SpreadsheetBlock extends Langs.Block {
  language : string
}

type SpreadsheetState = { 
  id: number
  block: SpreadsheetBlock
  Cols : Array<String>,
  Rows: Array<number>
  Active: Position | null
  Cells: Map<Position, string>
}

type CellSelectedEvent = { kind: 'selected', pos: Position}
type CellEditedEvent = { kind: 'edited', pos: Position}
type SpreadsheetEvent = CellSelectedEvent | CellEditedEvent

const spreadsheetEditor : Langs.Editor<SpreadsheetState, SpreadsheetEvent> = {
  initialize: (id:number, block:Langs.Block) => {  
    return {
      id: id,
      block: block,
      Cols : 'abcdefghijk'.split(''),
      Rows:  _.range(0,5),
      Active: null,
      Cells: new Map()
    }
  }, 
  update: (state:SpreadsheetState, event:SpreadsheetEvent) => {
    Log.trace("spreadsheet","Spreadsheet being updated: "+JSON.stringify(event))
    switch (event.kind) {
      case 'edited': 
        return state;
      case 'selected':
        return {...state, Active: event.pos}
    }
  },
  render: (cell:Langs.BlockState, state:SpreadsheetState, context:Langs.EditorContext<SpreadsheetEvent>) => {
    let rowsComponents:Array<any> = []
    let headerComponents:Array<any> = []
    // for this table, create headers
    let numRows = 5
    let colHeaders: Array<string> = ' abcdefghijk'.split('')
    let rowHeaders = _.range(0,numRows)

    for (let c = 0; c < colHeaders.length; c++) {
      headerComponents.push(h('th',{key: "spreadsheetColumnHeader"+c, class:"spreadsheet-th"}, [colHeaders[c]]))
    }
    rowsComponents.push(h('tr',{key: "spreadsheetColHeader"},[headerComponents]))
 
    function renderEditor(pos:Position): VNode{
      let inputComponent:VNode =  h('input', {key:"spreadsheetInput"+pos.row.toString()+pos.col,
      type: "text"},[])
      let editorComponent:VNode =  h('td', {key: "spreadsheetColumn"+pos.row.toString()+pos.col, 
          class:  "spreadsheet-td input", 
          onchange:()=>{
            Log.trace("spreadsheet","Cell is edited")
          }}, [inputComponent])
      Log.trace("spreadsheet","New editor "+JSON.stringify(editorComponent))
      return editorComponent
    }

    function renderView(pos:Position){
      let viewComponent:VNode;
      if (pos.col == " ")
        viewComponent = h('th', { key: "spreadsheetRowHeader"+pos.row.toString()+pos.col, 
          class:"spreadsheet-th"}, [pos.row.toString()])
      else {
        let displayComponent:VNode =  h('p', {key:"spreadsheetDisplay"+pos.row.toString()+pos.col},["..."])
        viewComponent = h('td', {key: "spreadsheetColumn"+pos.row.toString()+pos.col, 
          class: "spreadsheet-td", 
          onclick:()=>{
            Log.trace("spreadsheet","Cell is clicked")
            context.trigger({kind:"selected", pos: pos})
          }}, [displayComponent])
      }
      return viewComponent
    }

    function renderCell(pos:Position, state: SpreadsheetState):VNode {
      if ((state.Active != null) && 
        (state.Active.row == pos.row) && 
        (state.Active.col == pos.col)) {
        Log.trace("spreadsheet", "Active state position: ".concat(JSON.stringify(state.Active)))
        return renderEditor(pos)
      }
      else {
        return renderView(pos)
      }
    }

    for (let row = 0; row < numRows; row++) {
      let columnsComponents:Array<any> = []
      for (let col = 0; col < colHeaders.length; col++) {
        columnsComponents.push(renderCell({row: row, col: colHeaders[col]}, state))
      }
      rowsComponents.push(h('tr',{key: "spreadsheetRow"+row},[columnsComponents]))
    }
    console.log(state.Active)
    return h('table', {class:'spreadsheet-table'},[rowsComponents]);
  }
}

export const spreadsheetLanguagePlugin : Langs.LanguagePlugin = {
  language: "spreadsheet",
  iconClassName: "fas fa-file-spreadsheet",
  editor: spreadsheetEditor,
  getDefaultCode: (id:number) => "",
  parse: (code:string) : SpreadsheetBlock => {
    return ({ language: "spreadsheet"})
  },

  bind: async (context: Langs.BindingContext, block: Langs.Block) : Promise<Langs.BindingResult> => {
    let sl = spreadsheetLanguagePlugin
    let node:Graph.Node = { 
      language: sl.language, 
      antecedents: [],
      hash: <string>Md5.hashStr(JSON.stringify(sl.save(block))),
      value: null, 
      errors: [],
    }
    return { code: node, exports: [], resources: [] };
  },
  evaluate: async (context:Langs.EvaluationContext, node:Graph.Node) : Promise<Langs.EvaluationResult> => {
    Log.trace("spreadsheet","Spreadsheet being evaluated")
    let val:Values.Printout = {kind:"printout", data:"Eval-ed spreadsheet node"}
    return { kind: "success", value: val }
  },

  save: (block:Langs.Block) => {
    let spreadsheetBlock = <SpreadsheetBlock>block
    return spreadsheetBlock.language
  },
}

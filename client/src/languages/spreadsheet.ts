
import { h, VNode } from 'maquette';
import * as Langs from '../definitions/languages'; 
import * as Graph from '../definitions/graph'; 
import _ from 'lodash';
import { Md5 } from 'ts-md5';
import * as Values from '../definitions/values'; 
import { Log } from '../common/log';
import { updateArrayBindingPattern } from 'typescript';
// import { Position } from 'monaco-editor';

type Position = {row:number, col: string}

interface SpreadsheetBlock extends Langs.Block {
  language : string
}

type SpreadsheetState = { 
  id: number
  block: SpreadsheetBlock
  Cols : Array<string>,
  Rows: Array<number>
  Active: Position | null
  Cells: Map<Position, string>
}

type CellSelectedEvent = { kind: 'selected', pos: Position}
type CellEditedEvent = { kind: 'edited', pos: Position}
type SpreadsheetEvent = CellSelectedEvent | CellEditedEvent

const spreadsheetEditor : Langs.Editor<SpreadsheetState, SpreadsheetEvent> = {
  
  initialize: (id:number, block:Langs.Block) => {  
    let newState = {
      id: id,
      block: block,
      Cols : ' ABCDEFG'.split(''),
      Rows:  _.range(0,3),
      Active: null,
      Cells: new Map<Position, string>()
    }
    newState.Cols.forEach(col => {
      newState.Rows.forEach(row => {
        // Log.trace('spreadsheet', "Setting contents at init: ".concat(row.toString().concat(col)))
        newState.Cells.set({row:row, col:col}, row.toString().concat(col))
      });
    });

    return newState
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
    
    for (let c = 0; c < state.Cols.length; c++) {
      headerComponents.push(h('th',{key: "spreadsheetColumnHeader"+c, class:"spreadsheet-th"}, [state.Cols[c]]))
    }
    rowsComponents.push(h('tr',{key: "spreadsheetColHeader"},[headerComponents]))
 
    function renderEditor(pos:Position): VNode{
      let inputComponent:VNode =  h('input', {key:"spreadsheetInput"+pos.row.toString()+pos.col+cell.editor.id,
      type: "text"},[])
      let editorComponent:VNode =  h('td', {key: "spreadsheetColumn"+pos.row.toString()+pos.col+cell.editor.id, 
          class:  "spreadsheet-td input", 
          onchange:()=>{
            Log.trace("spreadsheet","Cell is edited")
          }}, [inputComponent])
      return editorComponent
    }

    function renderView(state: SpreadsheetState, positionKey:IteratorResult<Position>){
      let viewComponent:VNode;
      let pos = positionKey.value
      if (pos.col == " ")
        viewComponent = h('th', { key: "spreadsheetRowHeader"+pos.row.toString()+pos.col, 
          class:"spreadsheet-th"}, [pos.row.toString()])
      else {
        let value:string|undefined = state.Cells.get(pos)
        let displayComponent:VNode =  h('p', 
          {key:"spreadsheetDisplay"+pos.row.toString()+pos.col+cell.editor.id},
          [value==undefined? "...":value])
        viewComponent = h('td', {key: "spreadsheetColumn"+pos.row.toString()+pos.col+cell.editor.id, 
          class: "spreadsheet-td", 
          onclick:()=>{
            Log.trace("spreadsheet","Cell is clicked")
            context.trigger({kind:"selected", pos: pos})
          }}, [displayComponent])
      }
      return viewComponent
    }

    function renderCell(positionKey:IteratorResult<Position>, state: SpreadsheetState):VNode {
      let pos = positionKey.value
      if ((state.Active != null) && 
        (state.Active.row == pos.row) && 
        (state.Active.col == pos.col)) {
        Log.trace("spreadsheet", "Active state position: ".concat(JSON.stringify(state.Active)))
        return renderEditor(pos)
      }
      else {
        return renderView(state, positionKey)
      }
    }

    function getKey(pos:Position, state:SpreadsheetState):IteratorResult<Position> | undefined {
      let keys = state.Cells.keys()
      for (let k = 0; k < state.Cells.size; k++) {
        let key:IteratorResult<Position> = keys.next()
        if ((key.value.col == pos.col) && (key.value.row == pos.row)) 
          return key
      }
      return undefined
    }

    for (let row = 1; row <= state.Rows.length; row++) {
      let columnsComponents:Array<any> = []
      for (let col = 0; col < state.Cols.length; col++) {
        let key = getKey({row: row, col: state.Cols[col]}, state)
        if (key != undefined)
          columnsComponents.push(renderCell(key, state))
      }
      rowsComponents.push(h('tr',{key: "spreadsheetRow"+row+cell.editor.id},[columnsComponents]))
    }
      
    return h('table', {key: "spreadsheet"+cell.editor.id, class:'spreadsheet-table'},[rowsComponents]);
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

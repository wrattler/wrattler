
import { h, VNode, createProjector } from 'maquette';
import * as Langs from '../definitions/languages'; 
import * as Graph from '../definitions/graph'; 
import _ from 'lodash';
import { Md5 } from 'ts-md5';
import * as Values from '../definitions/values'; 
import { Log } from '../common/log';
import axios from 'axios';
// import { Position } from 'monaco-editor';

type Position = {row:number, col: string}

interface SpreadsheetBlock extends Langs.Block {
  language : string
}

type SpreadsheetState = { 
  id: number
  block: SpreadsheetBlock
  ColIndices: Array<string>,
  RowIndices: Array<number>
  Cols : Array<string>,
  Rows: Array<number>
  Active: Position | null
  Cells: Map<string, string>
}

interface SpreadsheetCodeNode extends Graph.Node {
  kind: 'code',
  framesInScope: Langs.ScopeDictionary
}

type SpreadsheetInput = { url:string }

interface SpreadsheetBlock extends Langs.Block {
  language: string
  dataframe: SpreadsheetInput
}

type CellSelectedEvent = { kind: 'selected', pos: Position}
type CellEditedEvent = { kind: 'edited', pos: Position}
type SpreadsheetEvent = CellSelectedEvent | CellEditedEvent

async function getValue(preview:boolean, url:string) : Promise<any> {
  let headers = {'Accept': 'application/json'}
  if (preview)
    url = url.concat("?nrow=10")
  try {
    let response = await axios.get(url, {headers: headers});
    return response.data
  }
  catch (error) {
    throw error;
  }
}

const spreadsheetEditor : Langs.Editor<SpreadsheetState, SpreadsheetEvent> = {
  initialize: (id:number, block:Langs.Block) => {  
    let spreadsheetBlock = <SpreadsheetBlock> block
    if (spreadsheetBlock.dataframe.url.length == 0){
      let newState = {
        id: id,
        block: spreadsheetBlock,
        ColIndices: [],
        RowIndices: [],
        Cols : [],
        Rows:  [],
        Active: null,
        Cells: new Map()
      }
      newState.Cols.forEach(col => {
        newState.Rows.forEach(row => {
          let position:Position = {row:row, col:col}
          newState.Cells.set(JSON.stringify(position), "")
        });
      });
      Log.trace('spreadsheet', "New State initialised (default)")
      return newState
    }
    else {
      let source = [{"id": 11, "language": "javascript"}, {"id": 12, "language": "javascript"}]
      let colNames = Object.keys(source[0])
      let newState = {
        id: id,
        block: <SpreadsheetBlock>block,
        ColIndices: 'XABCDEFG'.substr(0, colNames.length+1).split(''),
        RowIndices:  _.range(0,source.length+2),
        Cols : colNames,
        Rows:  _.range(0,source.length+2),
        Active: null,
        Cells: new Map()
      }
      newState.RowIndices.forEach((row, rIndex) => {
        newState.ColIndices.forEach((col, cIndex) => {
          // Log.trace('spreadsheet', "Row[%s] Col[%s]: %s", row, col, row.toString().concat(col.toString()))
          let position:Position = {row:row, col:col}
          let value:string = " "
          if ((rIndex == 0) && (col == 'X'))
            value = ' '
          else if (rIndex == 0)
            value = col
          else if (rIndex == 1) {
            let colName: string | undefined = newState.Cols[cIndex-1]
            if (colName)
              value = colName
            else 
              value = rIndex.toString()
          }
          else if (col == 'X')
            value = rIndex.toString()
          else {
            let colName = newState.Cols[cIndex-1]
            value = source[rIndex-2][colName]
          }  
          // Log.trace('spreadsheet', "Position [%s]: %s", JSON.stringify(position), value)
          newState.Cells.set(JSON.stringify(position), value)
        });
      });
      return newState
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
  render: (cell:Langs.BlockState, state:SpreadsheetState, context:Langs.EditorContext<SpreadsheetEvent>):VNode => {
    let spreadsheetNode = <SpreadsheetCodeNode>cell.code

    function renderTable(){
      Log.trace('spreadsheet', "Rendering Table: %s", JSON.stringify(state))
      let rowsComponents:Array<any> = []
      let headerComponents:Array<any> = []
      let colComponents:Array<any> = []
    
      for (let c = 0; c < state.ColIndices.length; c++) {
        let position:Position = {row:0, col:state.ColIndices[c]}
        let headerValue:string | undefined = state.Cells.get(JSON.stringify(position))
        if (headerValue)
          headerComponents.push(h('th',{key: "spreadsheetColumnHeader"+c, class:"spreadsheet-th"}, [headerValue]))
      }
      rowsComponents.push(h('tr',{key: "spreadsheetColHeader"},[headerComponents]))

      for (let r = 1; r < state.RowIndices.length; r++) {
        colComponents = []
        for (let c = 0; c < state.ColIndices.length; c++) {
          let position:Position = {row:state.RowIndices[r], col:state.ColIndices[c]}
          let cellValue:string | undefined = state.Cells.get(JSON.stringify(position))
          if (cellValue)
          {
            Log.trace('spreadsheet', "Position [%s]: %s", JSON.stringify(position), cellValue)
            let tableCell:VNode = h('td',{
              key: "spreadsheetColumn"+r+c, 
              class:"spreadsheet-td",
              onclick:() => {
                        Log.trace("spreadsheet","Cell is clicked")
                        // context.trigger({kind:"selected", pos: position})
                      }
              }, 
              [cellValue.toString()])
            console.log(tableCell)
            colComponents.push(tableCell)
          }
          else {
            colComponents.push(h('td',{key: "spreadsheetColumn"+r+c, class:"spreadsheet-td"}, [" "]))
          }
        };
        rowsComponents.push(h('tr',{key: "spreadsheetRow"+r, class:"spreadsheet-tr"},[colComponents]))
      }
      
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

      // function renderView(state: SpreadsheetState, positionKey:IteratorResult<Position>){
      //   let viewComponent:VNode;
      //   let pos = positionKey.value
      //   if (pos.col == " ")
      //     viewComponent = h('th', { key: "spreadsheetRowHeader"+pos.row.toString()+pos.col, 
      //       class:"spreadsheet-th"}, [pos.row.toString()])
      //   else {
      //     let value:string|undefined = state.Cells.get(pos)
      //     let displayComponent:VNode =  h('p', 
      //       {key:"spreadsheetDisplay"+pos.row.toString()+pos.col+cell.editor.id},
      //       [value==undefined? "...":value])
      //     viewComponent = h('td', {key: "spreadsheetColumn"+pos.row.toString()+pos.col+cell.editor.id, 
      //       class: "spreadsheet-td", 
      //       onclick:()=>{
      //         Log.trace("spreadsheet","Cell is clicked")
      //         context.trigger({kind:"selected", pos: pos})
      //       }}, [displayComponent])
      //   }
      //   return viewComponent
      // }

      // function renderCell(positionKey:IteratorResult<Position>, state: SpreadsheetState):VNode {
      //   let pos = positionKey.value
      //   if ((state.Active != null) && 
      //     (state.Active.row == pos.row) && 
      //     (state.Active.col == pos.col)) {
      //     Log.trace("spreadsheet", "Active state position: ".concat(JSON.stringify(state.Active)))
      //     return renderEditor(pos)
      //   }
      //   else {
      //     return renderView(state, positionKey)
      //   }
      // }

      // function getKey(pos:Position, state:SpreadsheetState):IteratorResult<Position> | undefined {
      //   let keys = state.Cells.keys()
      //   for (let k = 0; k < state.Cells.size; k++) {
      //     let key:IteratorResult<Position> = keys.next()
      //     if ((key.value.col == pos.col) && (key.value.row == pos.row)) 
      //       return key
      //   }
      //   return undefined
      // }

      let table:VNode =  h('table', {id: "spreadsheet-table"+cell.editor.id, key: "spreadsheet-table"+cell.editor.id, class:'spreadsheet-table'},[rowsComponents]);
      return table
    }
    
    let dataframeKeys:Array<string> = Object.keys(spreadsheetNode.framesInScope)
    let selectedDataFrame:string = "" 
    let frameSelector:VNode = 
      h('div', {}, [ 
        h('span', {}, [ "Input: " ]), 
        h('select', 
          { 
            onchange:(e) => {
              selectedDataFrame = (<any>e.target).value
              let selectedFrameValue = spreadsheetNode.framesInScope[selectedDataFrame].value
              if (selectedFrameValue != null) {
                let selectedFrame = <Values.DataFrame>selectedFrameValue
                context.rebindSubsequent(cell,selectedFrame.url)
              }
              else { 
                context.rebindSubsequent(cell,"")
              }
            } 
          }, 
          [""].concat(dataframeKeys).map(f =>
            h('option', { key:f, value:f}, [f==""?"(no frame selected)":f]) )) ])
      return h('div', {id:"spreadsheet"+cell.editor.id, key: "spreadsheet"+cell.editor.id}, [frameSelector,renderTable()])
  }
}

export class spreadsheetLanguagePlugin implements Langs.LanguagePlugin 
{
  readonly language: string = "spreadsheet"
  readonly iconClassName: string = "fas fa-file-spreadsheet"
  readonly editor: Langs.Editor<Langs.EditorState, any> = spreadsheetEditor
  readonly datastoreURI: string;

  constructor (language: string,iconClassName:string, datastoreUri: string) {
    this.datastoreURI = datastoreUri
    this.language = language
    this.iconClassName = iconClassName
  }

  getDefaultCode (id:number) {
    return ""
  }
  
  parse (url:string) : Langs.Block {
    // Log.trace('spreadsheet', "Parse Spreadsheet for url: %s", JSON.stringify(url))
    let block:SpreadsheetBlock = { language: "spreadsheet", dataframe:{url: url}}
    return block
  }

  async bind (context: Langs.BindingContext, block: Langs.Block) : Promise<Langs.BindingResult> {
    let ssBlock = <SpreadsheetBlock> block
    Log.trace("spreadsheet", "Bind spreadsheet block: %s", JSON.stringify(ssBlock))
    let node:SpreadsheetCodeNode = { 
      kind: 'code',
      language: this.language, 
      hash: <string>Md5.hashStr(JSON.stringify(this.save(block))),
      antecedents: [],
      value: null, 
      errors: [],
      framesInScope: context.scope
    }
    
    // Log.trace("spreadsheet", "Context.scope: %s", JSON.stringify(context.scope))
    return { code: node, exports: [], resources: [] };
  }

  async evaluate (context:Langs.EvaluationContext, node:Graph.Node) : Promise<Langs.EvaluationResult> {
    Log.trace("spreadsheet","Spreadsheet being evaluated")
    let val:Values.Printout = {kind:"printout", data:"Eval-ed spreadsheet node"}
    return { kind: "success", value: val }
  }

  save (block:Langs.Block) {
    let spreadsheetBlock = <SpreadsheetBlock>block
    return spreadsheetBlock.language
  }
}

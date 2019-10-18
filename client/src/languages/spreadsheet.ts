
import { h } from 'maquette';
import * as Langs from '../definitions/languages'; 
import * as Graph from '../definitions/graph'; 
import _ from 'lodash';
import { Md5 } from 'ts-md5';
import * as Values from '../definitions/values'; 

type Position = [string, number]

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

type SpreadsheetEvent = { 
}

const spreadsheetEditor : Langs.Editor<SpreadsheetState, SpreadsheetEvent> = {
  initialize: (id:number, block:Langs.Block) => {  
    return {
      id: id,
      block: block,
      Cols : 'abcdefghijk'.split(''),
      Rows:  _.range(0,10),
      Active: null,
      Cells: new Map()
    }
  }, 
  update: (state:SpreadsheetState) => {
    return state
  },
  render: () => {
    return h('p.output', {}, ["Hello World!"])
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
    let val:Values.Printout = {kind:"printout", data:"Eval-ed spreadsheet node"}
    return { kind: "success", value: val }
  },

  save: (block:Langs.Block) => {
    let spreadsheetBlock = <SpreadsheetBlock>block
    return spreadsheetBlock.language
  },
}

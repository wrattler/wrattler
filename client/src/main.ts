/** @hidden */

/** This comment is needed so that TypeDoc parses the above one correctly */
import { fsHello } from "./demos/fsdemo";
import { jsHello } from "./demos/jsdemo";
import { tsHello } from "./demos/tsdemo";

// fsHello();
// jsHello();
// tsHello();

// ------------------------------------------------------------------------------------------------
// Imports
// ------------------------------------------------------------------------------------------------

import {h,createProjector,VNode} from 'maquette';
import * as Langs from './languages'; 
import * as Graph from './graph';
import { markdownLanguagePlugin } from './languagePlugins/markdown/markdownPlugin'
import { javascriptLanguagePlugin } from './languagePlugins/javascript/javascriptPlugin'
import { pythonLanguagePlugin } from './languagePlugins/python/pythonPlugin'
require('./editor.css');
declare var TWO: string;



// ------------------------------------------------------------------------------------------------
// Main notebook rendering code
// ------------------------------------------------------------------------------------------------

var languagePlugins : { [language: string]: Langs.LanguagePlugin; } = { };
languagePlugins["markdown"] = markdownLanguagePlugin;
languagePlugins["javascript"] = javascriptLanguagePlugin;
languagePlugins["python"] = pythonLanguagePlugin;
var scopeDictionary : { [variableName: string]: Graph.ExportNode} = { };

// A sample document is just an array of records with cells. Each 
// cell has a language and source code (here, just Markdown):
// 1. create 2 blocks, 1 py dataframe, 1 js read dataframe length
let documents = 
  [ 
    // {"language": "markdown", 
    //  "source": "# Testing Markdown\n1. Edit this block \n2. Shift+Enter to convert to *Markdown*"},
     {"language": "javascript",
     "source": "var a = 1;"},
     {"language": "javascript",
      "source": "var c = a+1;"},
    // {"language": "python",
    // "source": "a = 1;"},
    // {"language": "javascript",
    //   "source": "var c = a + 1; var d = a;"}
    {
      "language": "python",
      "source": "df = pd.DataFrame({\"a\":[\"1\",\"2\",\"3\"],\"b\":[\"4\",\"5\",\"6\"]})"
    },
    {
      "language": "javascript",
      "source": "var length = df.length"
    }
  ]

interface NotebookAddEvent { kind:'add', id: number }
interface NotebookRemoveEvent { kind:'remove', id: number }
interface NotebookBlockEvent { kind:'block', id:number, event:any }
interface NotebookRefreshEvent { kind:'refresh' }
// interface NotebookSourceChange { kind:'sourceChange' }
interface NotebookSourceChange { kind:'rebind', block: Langs.BlockState, newSource: string}
type NotebookEvent = NotebookAddEvent | NotebookRemoveEvent | NotebookBlockEvent | NotebookRefreshEvent | NotebookSourceChange

type NotebookState = {
  cells: Langs.BlockState[]
}

// console.log(TWO);
// Create an initial notebook state by parsing the sample document
let index = 0
let blockStates = documents.map(cell => {
  let languagePlugin = languagePlugins[cell.language]; // TODO: Error handling
  let block = languagePlugin.parse(cell.source);
  let editor:Langs.EditorState = languagePlugin.editor.initialize(index++, block); 
  return {editor: editor, code: null, exports: []};  
})
let state : NotebookState = { cells: blockStates };

function bindCell (cell:Langs.BlockState): Promise<{code: Graph.Node, exports: Graph.ExportNode[]}>{
  let languagePlugin = languagePlugins[cell.editor.block.language]
  return languagePlugin.bind(scopeDictionary, cell.editor.block);
}

// function clearCell (cell:Langs.BlockState): void{
//   cell.exports = [];
//   cell.code.value = {};
// }

async function bindAllCells() {
  for (var c = 0; c < state.cells.length; c++) {
    let aCell = state.cells[c]
    let {code, exports} = await bindCell(aCell);
    aCell.code = code
    aCell.exports = exports
    for (var e = 0; e < exports.length; e++ ) {
      let exportNode = exports[e];
      scopeDictionary[exportNode.variableName] = exportNode;
    }
    console.log(aCell)
    console.log(Object.keys(scopeDictionary))
  }
}

async function rebindSubsequentCells(cell:Langs.BlockState, newSource: string) {
  for (var b=0; b < state.cells.length; b++) {
    if (state.cells[b].editor.id >= cell.editor.id) {
      let languagePlugin = languagePlugins[state.cells[b].editor.block.language]
      let block = state.cells[b].editor.block;
      if (state.cells[b].editor.id == cell.editor.id) {
        block = languagePlugin.parse(newSource);
        console.log(block)
      }
      let id = state.cells[b].editor.id;
      let editor:Langs.EditorState = languagePlugin.editor.initialize(id, block); 
      let newBlock:Langs.BlockState = {editor: editor, code: null, exports: []};  
      var index = state.cells.indexOf(state.cells[b]);
      for (var e = 0; e < state.cells[b].exports.length; e++) {
        let oldExport:Graph.ExportNode = <Graph.ExportNode>state.cells[b].exports[e];
        delete scopeDictionary[oldExport.variableName];
      }
      if (index !== -1) {
        state.cells[index] = newBlock;
      }
    }
  }
  console.log(state.cells);
  for (var b=0; b < state.cells.length; b++) {
    if (state.cells[b].editor.id >= cell.editor.id) {
      let aCell = state.cells[b]
      let {code, exports} = await bindCell(aCell);
      aCell.code = code
      aCell.exports = exports
      for (var e = 0; e < exports.length; e++ ) {
        let exportNode = exports[e];
        scopeDictionary[exportNode.variableName] = exportNode;
      }
    }
  }
  console.log(state.cells);
}

bindAllCells()

// Get the #paper element and create maquette renderer
let paperElement = document.getElementById('paper');
let maquetteProjector = createProjector();


async function evaluate(node:Graph.Node) {
  if ((node.value)&&(Object.keys(node.value).length > 0)) return ;
  // return doAntecedents(node.antecedents).then(()=>{
  //   let languagePlugin = languagePlugins[node.language]
  //   node.value = await languagePlugin.evaluate(node);
  //   console.log("Received value:"+JSON.stringify(node.value));
  //   return true;
  // })
  node.antecedents.forEach(evaluate);
  //let a = await Promise.all(node.antecedents.map(ant => {console.log("Eval:"+JSON.stringify((<Graph.JsExportNode>ant).variableName));evaluate(ant)}))
  // console.log("Promises: "+ JSON.stringify(a));
  let languagePlugin = languagePlugins[node.language]
  node.value = await languagePlugin.evaluate(node);
  console.log("Received value: "+JSON.stringify(node.value));
  return;
}

function render(trigger:(NotebookEvent) => void, state:NotebookState) {

  let nodes = state.cells.map(cell => {
    // The `context` object is passed to the render function. The `trigger` method
    // of the object can be used to trigger events that cause a state update. 
    let context : Langs.EditorContext<any> = {
      trigger: (event:any) => 
        trigger({ kind:'block', id:cell.editor.id, event:event }),

      evaluate: (block:Langs.BlockState) => {
        return evaluate(block.code).then(()=>{
          console.log("Going to evaluate exports:")
          block.exports.forEach(evaluate)
          trigger({ kind:'refresh' })
        })
      },

      // sourceChange
      // rebind all blocks after this one
      rebindSubsequent: (block:Langs.BlockState, newSource: string) => {
        trigger({kind: 'rebind', block: block, newSource: newSource})
      } 
    }
  
    let plugin = languagePlugins[cell.editor.block.language]
    // let vnode = plugin.editor.render(state.editor, context)
    let vnode = plugin.editor.render(cell, cell.editor, context)
    let c_language = h('p', {style: 'float:left'}, [cell.editor.block.language] )
    let c_add = h('i', {id:'add_'+cell.editor.id, class: 'fas fa-plus control', onclick:()=>trigger({kind:'add', id:cell.editor.id})});
    let c_delete = h('i', {id:'remove_'+cell.editor.id, class: 'far fa-trash-alt control', onclick:()=>trigger({kind:'remove', id:cell.editor.id})});
    let controls = h('div', {class:'controls'}, [c_language, c_add, c_delete])
    return h('div', {class:'cell', key:cell.editor.id}, [
        h('div', [controls]),vnode
      ]
    );
  }); 

  return h('div', {class:'container-fluid', id:'paper'}, [nodes])
}

function update(state:NotebookState, evt:NotebookEvent) {
  function spliceCell (cells:Langs.BlockState[], newCell: Langs.BlockState, idOfAboveBlock: number) {
    return cells.map (cell => 
      { 
        if (cell.editor.id === idOfAboveBlock) {
          return [cell, newCell];
        }
        else {
          return [cell]
        }
      }).reduce ((a,b)=> a.concat(b));
  }
  function removeCell (cells:Langs.BlockState[], idOfSelectedBlock: number) {
    return cells.map (cell => 
      { 
        if (cell.editor.id === idOfSelectedBlock) {
          return [];
        }
        else {
          return [cell]
        }
      }).reduce ((a,b)=> a.concat(b));
  }

  
  switch(evt.kind) {
    case 'block': {
      let newCells = state.cells.map(state => {
        if (state.editor.id != evt.id) 
          return state
        else
        { 
          return {
            editor: languagePlugins[state.editor.block.language].editor.update(state.editor, evt.event) , 
            code: state.code, 
            exports: state.exports
          };
        }
      })
      return { cells: newCells };
    }
    case 'add': {
      let newId = index++;
      let newDocument = { "language": "javascript", 
                          "source": "var z = "+newId};
      let newPlugin = languagePlugins[newDocument.language]; 
      let newBlock = newPlugin.parse(newDocument.source);
      let editor:Langs.EditorState = newPlugin.editor.initialize(newId, newBlock);  
      let cell:Langs.BlockState = {editor: editor, code: undefined, exports: []}
      bindCell(cell)
      return {cells: spliceCell(state.cells, cell, evt.id)};
    }

    case 'refresh':
      return state;

    case 'remove':
      return {cells: removeCell(state.cells, evt.id)};
    
    case 'rebind': {
      // console.log("Rebind in update: "+JSON.stringify(evt))
      rebindSubsequentCells(evt.block, evt.newSource);
      return state;
    }

  }
}

function updateAndRender(event:NotebookEvent) {
  state = update(state, event)
  maquetteProjector.scheduleRender()
}

maquetteProjector.replace(paperElement, () => render(updateAndRender, state));
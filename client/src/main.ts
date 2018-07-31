// Demos showing how to import files from different languages
// (we will need this later, but for now, this is just a demo)
import { fsHello } from "./demos/fsdemo";
import { jsHello } from "./demos/jsdemo";
import { tsHello } from "./demos/tsdemo";

fsHello();
jsHello();
tsHello();

// ------------------------------------------------------------------------------------------------
// Imports
// ------------------------------------------------------------------------------------------------

import {h,createProjector,VNode} from 'maquette';
import * as Langs from './languages'; 
import * as Graph from './graph';
import { markdownLanguagePlugin } from './languagePlugins/markdown/markdownPlugin'
import { javascriptLanguagePlugin } from './languagePlugins/javascript/javascriptPlugin'
require('./editor.css');


// ------------------------------------------------------------------------------------------------
// Main notebook rendering code
// ------------------------------------------------------------------------------------------------

var languagePlugins : { [language: string]: Langs.LanguagePlugin; } = { };
languagePlugins["markdown"] = markdownLanguagePlugin;
languagePlugins["javascript"] = javascriptLanguagePlugin;

var scopeDictionary : { [variableName: string]: Graph.ExportNode} = { };

// A sample document is just an array of records with cells. Each 
// cell has a language and source code (here, just Markdown):
let documents = 
  [ 
    // {"language": "markdown", 
    //  "source": "# Testing Markdown\n1. Edit this block \n2. Shift+Enter to convert to *Markdown*"},
    {"language": "javascript",
      "source": "var a = 1; \nlet b = 2; a+b;"},
    {"language": "javascript",
      "source": "var c = a+1"},
    {"language": "javascript",
      "source": "var d = (b+c)*2"}  
    ]

interface NotebookAddEvent { kind:'add', id: number }
interface NotebookRemoveEvent { kind:'remove', id: number }
interface NotebookBlockEvent { kind:'block', id:number, event:any }
interface NotebookRefreshEvent { kind:'refresh' }
type NotebookEvent = NotebookAddEvent | NotebookRemoveEvent | NotebookBlockEvent | NotebookRefreshEvent

type NotebookState = {
  cells: Langs.BlockState[]
}


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
  // cell.code = code
  // cell.exports = exports
  // add loop through exports and add them into scope dictionary here
  // scopeDictionary[exportNode.variableName] = exportNode;
}

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
  }
}

bindAllCells()

// state.cells.forEach(bindCell)

// console.log(scopeDictionary);
// console.log(state.cells);

// Get the #paper element and create maquette renderer
let paperElement = document.getElementById('paper');
let maquetteProjector = createProjector();

function evaluate(node:Graph.Node) {
  // console.log("evaluating:"+JSON.stringify(node));
  let languagePlugin = languagePlugins[node.language]
  node.value = languagePlugin.evaluate(node);
  console.log(node);
  // TODO: If node has value, we are done
  // Otherwise, evalaute all antecedents
  // Call appropriate language plugin to evaluate node
  //   .. and set node.value to what the language plugin returns
}

function render(trigger:(NotebookEvent) => void, state:NotebookState) {

  let nodes = state.cells.map(cell => {

    // The `context` object is passed to the render function. The `trigger` method
    // of the object can be used to trigger events that cause a state update. 
    let context : Langs.EditorContext<any> = {
      trigger: (event:any) => 
        trigger({ kind:'block', id:cell.editor.id, event:event }),

      evaluate: (block:Langs.BlockState) => {
        evaluate(block.code)
        block.exports.forEach(evaluate)
          trigger({ kind:'refresh' })
      }
    }
    let plugin = languagePlugins[cell.editor.block.language]
    // let vnode = plugin.editor.render(state.editor, context)
    let vnode = plugin.editor.render(cell, cell.editor, context)
    let c_add = h('i', {id:'add_'+cell.editor.id, class: 'fas fa-plus control', onclick:()=>trigger({kind:'add', id:cell.editor.id})});
    let c_delete = h('i', {id:'remove_'+cell.editor.id, class: 'far fa-trash-alt control', onclick:()=>trigger({kind:'remove', id:cell.editor.id})});
    let controls = h('div', {class:'controls'}, [c_add, c_delete])
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
  }
}

function updateAndRender(event:NotebookEvent) {
  state = update(state, event)
  maquetteProjector.scheduleRender()
}

maquetteProjector.replace(paperElement, () => render(updateAndRender, state));
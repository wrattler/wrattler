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
import { markdownLanguagePlugin } from './languagePlugins/markdown/markdownPlugin'
import { javascriptLanguagePlugin } from './languagePlugins/javascript/javascriptPlugin'
require('./editor.css');

// ------------------------------------------------------------------------------------------------
// Main notebook rendering code
// ------------------------------------------------------------------------------------------------

var languagePlugins : { [language: string]: Langs.LanguagePlugin; } = { };
languagePlugins["markdown"] = markdownLanguagePlugin;
languagePlugins["javascript"] = javascriptLanguagePlugin;

// A sample document is just an array of records with cells. Each 
// cell has a language and source code (here, just Markdown):
let documents = 
  [ {"language": "markdown", 
     "source": "# Testing Markdown\n1. Edit this block \n2. Shift+Enter to convert to *Markdown*"},
    {"language": "javascript",
      "source": "let x = 1; \n x*2;\n"},
    {"language": "javascript",
      "source": "function add(x,y) { return x+y };\n add(2,2)"} 
    ]

interface NotebookAddEvent { kind:'add', id: number }
interface NotebookRemoveEvent { kind:'remove', id: number }
interface NotebookBlockEvent { kind:'block', id:number, event:any }
type NotebookEvent = NotebookAddEvent | NotebookRemoveEvent | NotebookBlockEvent

type NotebookState = {
  cells: Langs.EditorState[]
}

// Create an initial notebook state by parsing the sample document
let index = 0
let cellStates = documents.map(cell => {
  let plugin = languagePlugins[cell.language]; // TODO: Error handling
  let block = plugin.parse(cell.source);
  return plugin.editor.initialize(index++, block);  
})
let state : NotebookState = { cells: cellStates };

// Get the #paper element and create maquette renderer
let paperElement = document.getElementById('paper');
let maquetteProjector = createProjector();

function render(trigger:(NotebookEvent) => void, state:NotebookState) {

  let nodes = state.cells.map(state => {

    // The `context` object is passed to the render function. The `trigger` method
    // of the object can be used to trigger events that cause a state update. 
    let context : Langs.EditorContext<any> = {
      trigger: (event:any) => trigger({ kind:'block', id:state.id, event:event })
    }
    let plugin = languagePlugins[state.block.language]
    let vnode = plugin.editor.render(state, context)
    let c_add = h('i', {id:'add_'+state.id, class: 'fas fa-plus control', onclick:()=>trigger({kind:'add', id:state.id})});
    let c_delete = h('i', {id:'remove_'+state.id, class: 'far fa-trash-alt control', onclick:()=>trigger({kind:'remove', id:state.id})});
    let controls = h('div', {class:'controls'}, [c_add, c_delete])
    return h('div', {class:'cell', key:state.id}, [
        h('div', [controls]),vnode
      ]
    );
  }); 

  return h('div', {class:'container-fluid', id:'paper'}, [nodes])
}

function update(state:NotebookState, evt:NotebookEvent) {
  function spliceCell (cells:Langs.EditorState[], newCell: Langs.EditorState, idOfAboveBlock: number) {
    return cells.map (cell => 
      { 
        if (cell.id === idOfAboveBlock) {
          return [cell, newCell];
        }
        else {
          return [cell]
        }
      }).reduce ((a,b)=> a.concat(b));
  }
  function removeCell (cells:Langs.EditorState[], idOfSelectedBlock: number) {
    return cells.map (cell => 
      { 
        if (cell.id === idOfSelectedBlock) {
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
      if (state.id != evt.id) return state
        else return languagePlugins[state.block.language].editor.update(state, evt.event)
      })
      return { cells: newCells };
    }
    case 'add': {
      let newId = index++;
      let newDocument = {"language": "markdown", 
      "source": "### Add new block: "+newId};
      let newPlugin = languagePlugins[newDocument.language]; 
      let newBlock = newPlugin.parse(newDocument.source);
      let cell:Langs.EditorState = newPlugin.editor.initialize(newId, newBlock);  
      return {cells: spliceCell(state.cells, cell, evt.id)};
    }
    case 'remove':
      return {cells: removeCell(state.cells, evt.id)};
  }
}

function updateAndRender(event:NotebookEvent) {
  state = update(state, event)
  maquetteProjector.scheduleRender()
}

maquetteProjector.replace(paperElement, () => render(updateAndRender, state));
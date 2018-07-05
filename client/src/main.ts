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

type BlockState = {
  editor: Langs.EditorState
  code: Graph.Node
  exports: Graph.Node[]
}
type NotebookState = {
  cells: BlockState[]
}

// Create an initial notebook state by parsing the sample document
let index = 0
let blockStates = documents.map(cell => {
  let plugin = languagePlugins[cell.language]; // TODO: Error handling
  let block = plugin.parse(cell.source);
  let editor:Langs.EditorState = plugin.editor.initialize(index++, block); 
  let code:Graph.Node = {language: cell.language, antecedents: []}
  let exports:Graph.Node[] = [];
  return {editor: editor, code: code, exports: exports};  
})
let state : NotebookState = { cells: blockStates };

// Get the #paper element and create maquette renderer
let paperElement = document.getElementById('paper');
let maquetteProjector = createProjector();

function render(trigger:(NotebookEvent) => void, state:NotebookState) {

  let nodes = state.cells.map(state => {

    // The `context` object is passed to the render function. The `trigger` method
    // of the object can be used to trigger events that cause a state update. 
    let context : Langs.EditorContext<any> = {
      trigger: (event:any) => trigger({ kind:'block', id:state.editor.id, event:event })
    }
    let plugin = languagePlugins[state.editor.block.language]
    let vnode = plugin.editor.render(state.editor, context)
    let c_add = h('i', {id:'add_'+state.editor.id, class: 'fas fa-plus control', onclick:()=>trigger({kind:'add', id:state.editor.id})});
    let c_delete = h('i', {id:'remove_'+state.editor.id, class: 'far fa-trash-alt control', onclick:()=>trigger({kind:'remove', id:state.editor.id})});
    let controls = h('div', {class:'controls'}, [c_add, c_delete])
    return h('div', {class:'cell', key:state.editor.id}, [
        h('div', [controls]),vnode
      ]
    );
  }); 

  return h('div', {class:'container-fluid', id:'paper'}, [nodes])
}

function update(state:NotebookState, evt:NotebookEvent) {
  function spliceCell (cells:BlockState[], newCell: BlockState, idOfAboveBlock: number) {
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
  function removeCell (cells:BlockState[], idOfSelectedBlock: number) {
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
      let newDocument = {"language": "markdown", 
      "source": "### Add new block: "+newId};
      let newPlugin = languagePlugins[newDocument.language]; 
      let newBlock = newPlugin.parse(newDocument.source);
      let editor:Langs.EditorState = newPlugin.editor.initialize(newId, newBlock);  
      let code:Graph.Node = {language: newDocument.language, antecedents: []}
      let exports:Graph.Node[] = [];
      let cell:BlockState = {editor: editor, code: code, exports: exports}
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
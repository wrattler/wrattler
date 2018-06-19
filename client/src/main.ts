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
// import $ from 'jquery'
// import "bootstrap"
const s = require('./editor.css');



// ------------------------------------------------------------------------------------------------
// Main notebook rendering code
// ------------------------------------------------------------------------------------------------

var languagePlugins : { [language: string]: Langs.LanguagePlugin; } = { };
languagePlugins["markdown"] = markdownLanguagePlugin;

// A sample document is just an array of records with cells. Each 
// cell has a language and source code (here, just Markdown):
let documents = 
  [ {"language": "markdown", 
     "source": "# Testing Markdown\n1. Edit this block \n2. Shift+Enter to convert to *Markdown*"}, 
    {"language": "markdown", 
     "source": "## More testing\nThis is _some more_ `markdown`!"},
    {"language": "markdown", 
     "source": "## And more testing\nThis is _not_ `markdown`!"}, ]

// A state of the notebook is currently just an array of states of the 
// individual cells. In the future, this will need to include the state
// of other GUI elements such as the '+' and 'x' menus.
type NotebookState = {
  cells: Langs.EditorState[]
}

// Create an initial notebook state by parsing the sample document
let index = 0
let cellStates = documents.map(cell => {
  let plugin = languagePlugins[cell.language]; // TODO: Error handling
  let block = plugin.parse(cell.source);
  console.log("Created cell with index %O", index)
  return plugin.editor.initialize(index++, block);  
})
let state : NotebookState = { cells: cellStates };

// Get the #paper element and create maquette renderer
let paperElement = document.getElementById('paper');
let maquetteProjector = createProjector();

function render(state:NotebookState) {
  let nodes = state.cells.map(state => {

    // The `context` object is passed to the render function. The `trigger` method
    // of the object can be used to trigger events that cause a state update. 
    let context : Langs.EditorContext<any> = {
      trigger: (event:any) => updateState(state.id, event)
    }
    let plugin = languagePlugins[state.block.language]
    let vnode = plugin.editor.render(state, context)
    // let block = h('h2', ["Block " + state.id.toString()])
    let control_add = h('i', {class: 'fas fa-plus control'})
    let control_delete = h('i', {class: 'far fa-trash-alt control'})
    let control_up = h('i', {class: 'fas fa-arrow-up control'})
    let control_down = h('i', {class: 'fas fa-arrow-down control'})
    let controls = h('div', {class:'controls'}, [control_add, control_delete, control_up, control_down])
    // let divOfBlock = h('div',{id:'paper2'},[block,vnode])
    // let divOfBlocks = h('div',{id:'paper'},[divOfBlock]);
    // return divOfBlocks;
    console.log(state);
    return h('div', {class:'cell'}, [
        // h('h2', ["Block " + state.id.toString() +" : "+state.block.language]),vnode
        h('div', [controls]),vnode
      ]
    );
  }); 

  return h('div', {id:'paper'}, [nodes])
}

/// This is called from `markdownEditor` via the `context.trigger` call 
/// (when the user clicks on the edit button or hits Shift+Enter to update
/// Markdown). It replaces the blobal `state` and tells maquette to
/// re-render the notebook at some point soon.
function updateState(id:number, event:any) {
  console.log("Triggering event %O for cell ID %O", event, id)
  let newCells = state.cells.map(state => {
    if (state.id != id) return state
    else return languagePlugins[state.block.language].editor.update(state, event)
  })
  state = { cells: newCells }
  maquetteProjector.scheduleRender()
}

maquetteProjector.replace(paperElement, () => render(state));
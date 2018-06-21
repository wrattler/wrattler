// Demos showing how to import files from different languages
// (we will need this later, but for now, this is just a demo)
// import { fsHello } from "./demos/fsdemo";
// import { jsHello } from "./demos/jsdemo";
// import { tsHello } from "./demos/tsdemo";

// fsHello();
// jsHello();
// tsHello();

// ------------------------------------------------------------------------------------------------
// Imports
// ------------------------------------------------------------------------------------------------

import {h,createProjector,VNode} from 'maquette';
import * as Langs from './languages'; 
import { markdownLanguagePlugin, MarkdownBlockKind } from './languagePlugins/markdown/markdownPlugin'
require('./editor.css');

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
    // {"language": "markdown", 
    //  "source": "## More testing\nThis is _some more_ `markdown`!"},
    // {"language": "markdown", 
    //  "source": "## And more testing\nThis is _not_ `markdown`!"}, 
    ]

// A state of the notebook is currently just an array of states of the 
// individual cells. In the future, this will need to include the state
// of other GUI elements such as the '+' and 'x' menus.
type NotebookState = {
  cells: Langs.EditorState[]
}

let updateCellId = (cells: Langs.EditorState[], cell: Langs.EditorState, id:number): Langs.EditorState[] => {
  let temp = cells.slice(0);
  let index = cells.indexOf(cell);
  temp[index].id=id;
  return temp;
  // // console.log(cells.splice(index, 0, newCell))
  // // console.log(cells.slice(index+1))

  // return [
  //   ...cells.slice(0, index),
  //   // <any>Object.assign({}, cell, {id}),
  //   ...cells.splice(index, 0, newCell),
  //   ...cells.slice(index)
  // ]
};

let insertCell = (cells: Langs.EditorState[], cell: Langs.EditorState, index: number): Langs.EditorState[] =>{
  let temp = cells.slice(0);
  temp.splice(index,0,cell);
  return temp;
}

let removeCell = (cells: Langs.EditorState[], cell: Langs.EditorState ): Langs.EditorState[] => {
  let index = cells.indexOf(cell);
  return [
    ...cells.slice(0, index),
    ...cells.slice(index + 1)
  ];
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

  let parseId = (id:string):number => {
    let splitArray = id.split("_")
    return +splitArray[splitArray.length-1];
  }

  function updateCellIndices () {
    let index:number = 0;
    for (let cell of state.cells) {
      state.cells=updateCellId(state.cells, cell, index)
      index++;
    }
  }

  function removeClickHandler (evt) {
    // let currentId = evt.path[0].id;
    let currentId = parseId(evt.path[0].id)
    let cell = state.cells[currentId];
    state.cells = removeCell(state.cells, cell);
    updateCellIndices()
    
  }

  function addClickHandler (evt) {
    let currentId = parseId(evt.path[0].id)
    let newId = currentId+1;
    let newDocument = {"language": "markdown", 
     "source": "### Add new block at position: "+newId};
    let newPlugin = languagePlugins[newDocument.language]; 
    let newBlock = newPlugin.parse(newDocument.source);
    
    let cell:Langs.EditorState = newPlugin.editor.initialize(newId, newBlock);  
    state.cells = insertCell(state.cells, cell, newId);
    
    updateCellIndices();
  }

  let nodes = state.cells.map(state => {

    // The `context` object is passed to the render function. The `trigger` method
    // of the object can be used to trigger events that cause a state update. 
    let context : Langs.EditorContext<any> = {
      trigger: (event:any) => updateState(state.id, event)
    }
    let plugin = languagePlugins[state.block.language]
    let vnode = plugin.editor.render(state, context)
    let c_add = h('i', {id:'add_'+state.id, class: 'fas fa-plus control', onclick:addClickHandler});
    let c_delete = h('i', {id:'remove_'+state.id, class: 'far fa-trash-alt control', onclick:removeClickHandler})
    let controls = h('div', {class:'controls'}, [c_add, c_delete])
    // console.log(state);
    return h('div', {class:'cell', key:state.id}, [
        // h('h2', ["Block " + state.id.toString() +" : "+state.block.language]),vnode
        h('div', [controls]),vnode
      ]
    );
  }); 

  return h('div', {class:'container-fluid', id:'paper'}, [nodes])
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
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

import * as monaco from 'monaco-editor';
import {h,createProjector,VNode} from 'maquette';
import marked from 'marked';
import * as Langs from './languages'; 

const s = require('./editor.css');


// ------------------------------------------------------------------------------------------------
// Markdown plugin
// ------------------------------------------------------------------------------------------------

/// A class that represents a Markdown block. All blocks need to have 
/// `language` and Markdown also keeps the Markdown source we edit and render
class MarkdownBlockKind implements Langs.BlockKind {
  language : string;
  source : string;
  constructor(source:string) {
    this.language = "markdown";
    this.source = source;
  }
}

/// The `MarkdownEvent` type is a discriminated union that represents events
/// that can happen in the Markdown editor. We have two events - one is to switch
/// to edit mode and the other is to switch to view mode. The latter carries a 
/// new value of the Markdown source code after user did some editing.
interface MarkdownEditEvent { kind:'edit' }
interface MarkdownUpdateEvent { kind:'update', source:string }
type MarkdownEvent = MarkdownEditEvent | MarkdownUpdateEvent

/// The state of the Markdown editor keeps the current block (which all editor
/// states need to do) and also whether we are currently editing it or not.
type MarkdownState = {
  id: number
  block: MarkdownBlockKind
  editing: boolean
}

const markdownEditor : Langs.Editor<MarkdownState, MarkdownEvent> = {
  initialize: (id:number, block:Langs.BlockKind) => {  
    return { id: id, block: <MarkdownBlockKind>block, editing: false }
  },

  update: (state:MarkdownState, event:MarkdownEvent) => {
    switch(event.kind) {
      case 'edit': 
        console.log("Markdown: Switch to edit mode!")
        return { id: state.id, block: state.block, editing: true }
      case 'update': 
        console.log("Markdown: Set code to:\n%O", event.source);
        let newBlock = markdownLanguagePlugin.parse(event.source)
        return { id: state.id, block: <MarkdownBlockKind>newBlock, editing: false }
    }
  },

  render: (state:MarkdownState, context:Langs.EditorContext<MarkdownEvent>) => {

    // The render function returns a pair with VNode that represents the rendered content
    // and a function (handler) that is called after the VNode is materialized and actual
    // HTML DOM nodes that we can access using `document.getElementById` are created.
    //
    // The `context` parameter defines `context.trugger` function. We can call this to 
    // trigger events (i.e. `MarkdownEvent` values). When we trigger an event, the main 
    // loop will call our `update` function to get new state of the editor and it will then
    // re-render the editor (we do not need to do any extra work here!)
    if (!state.editing) {

      // If we are not in edit mode, we just render a VNode and return no-op handler
      let node = h('div', [
        h('p', {innerHTML: marked(state.block.source) }, []),
        h('button', { onclick: () => context.trigger({kind:'edit'}) }, ["Edit"])
      ] )
      return [node, () => { }]

    } else {

      // If we are in edit mode, we return a node with a unique ID together with 
      // a handler that creates monaco editor once the node is actually created.
      let node = h('div', [
        h('div', { style: "height:100px", id: "editor_" + state.id.toString() }, [ ])
      ] )
      let handler = () => { 
        let el = document.getElementById("editor_" + state.id.toString());
        console.log("Got editor element: %O. Initialized? %O" , el, el.dataset["initialized"])

        // After we create the editor, we mark the node as "initialized" using `el.dataset`.
        // This guarantees that we will not recreate monaco editor if we re-render the notebook
        // (when re-render was caused by an event in some other cell of the notebook)
        if (el.dataset["initialized"] != "true") {
          el.dataset["initialized"] = "true";
          let editor = monaco.editor.create(el, {
            value: state.block.source,
            language: 'markdown',
            scrollBeyondLastLine: false,
            theme:'vs',
          });                

          let alwaysTrue = editor.createContextKey('alwaysTrue', true);
          let myBinding = editor.addCommand(monaco.KeyCode.Enter | monaco.KeyMod.Shift,function (e) {
            let code = editor.getModel().getValue(monaco.editor.EndOfLinePreference.LF)
            context.trigger({kind: 'update', source: code})
          }, 'alwaysTrue');
        }
      }
      return [node, handler]
    }
  }
}

const markdownLanguagePlugin : Langs.LanguagePlugin = {
  language: "markdown",
  editor: markdownEditor,
  parse: (code:string) => {
    return new MarkdownBlockKind(code);
  }
}


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

// This is a mutable array that we use to collect handlers that need
// to be called after maquette renders VDom node and creates real HTML DOM
// nodes (the handlers then create Monaco editors)
let postRenderHandlers : (() => void)[] = []

function render(state:NotebookState) {
  postRenderHandlers = []
  let nodes = state.cells.map(state => {

    // The `context` object is passed to the render function. The `trigger` method
    // of the object can be used to trigger events that cause a state update. The
    // state update then updates the global `state` variable, re-renders the 
    // Notebook using `renderNow` and runs all the `postRenderHandlers` afterwards.
    let context : Langs.EditorContext<any> = {
      trigger: (event:any) => updateState(state.id, event)
    }
    let plugin = languagePlugins[state.block.language]
    let [vnode, handler] = plugin.editor.render(state, context)
    postRenderHandlers.push(handler)

    return h('div', [
      h('h2', ["Block " + state.id.toString()]),
      vnode
    ]);
  })  
  return h('div', nodes);
}

/// This is called from `markdownEditor` via the `context.trigger` call (when the 
/// user clicks on the edit button or hits Shift+Enter to update Markdown). It replaces
/// the blobal `state` and re-renders notebook immediately.
function updateState(id:number, event:any) {
  console.log("Triggering event %O for cell ID %O", event, id)
  let newCells = state.cells.map(state => {
    if (state.id != id) return state
    else return languagePlugins[state.block.language].editor.update(state, event)
  })
  state = { cells: newCells }
  rerenderNotebook()
}

/// Called from `updateState`, this function re-renders the notebook (now) using
/// maquette and then invokes all post-render handlers to create Monaco editors
function rerenderNotebook() {
  maquetteProjector.renderNow()
  console.log("Rerendered notebook. Collected %O handlers.", postRenderHandlers.length)
  postRenderHandlers.map(handler => handler());
  postRenderHandlers = [];
}

maquetteProjector.replace(paperElement, () => render(state));
/** @hidden */

/** This comment is needed so that TypeDoc parses the above one correctly */
import {h,createProjector} from 'maquette'
import { Log } from "./common/log"
import * as Langs from './definitions/languages'
import * as Graph from './definitions/graph'
import { markdownLanguagePlugin } from './languages/markdown'
import { javascriptLanguagePlugin } from './languages/javascript'
import { externalLanguagePlugin } from './languages/external'
// import { gammaLangaugePlugin } from "./languages/gamma/plugin"

import * as Docs from './services/documentService'

// ------------------------------------------------------------------------------------------------
// Notebook user interface state and event type
// ------------------------------------------------------------------------------------------------

interface NotebookAddEvent { kind:'add', id: number, language:string }
interface NotebookToggleAddEvent { kind:'toggleadd', id: number }
interface NotebookRemoveEvent { kind:'remove', id: number }
interface NotebookBlockEvent { kind:'block', id:number, event:any }
interface NotebookRefreshEvent { kind:'refresh' }
interface NotebookSourceChange { kind:'rebind', block: Langs.BlockState, newSource: string}

type NotebookEvent = 
  NotebookAddEvent | NotebookToggleAddEvent | NotebookRemoveEvent | 
  NotebookBlockEvent | NotebookRefreshEvent | NotebookSourceChange

type LanguagePlugins = { [lang:string] : Langs.LanguagePlugin }

type NotebookState = {
  contentChanged: (newContent:string) => void,
  languagePlugins: LanguagePlugins
  cells: Langs.BlockState[]  
  counter: number
  expandedMenu : number
  cache: Graph.NodeCache
}

let paperElementID:string='paper'
 
// ------------------------------------------------------------------------------------------------
// Helper functions for binding nodes
// ------------------------------------------------------------------------------------------------

function bindCell (cache:Graph.NodeCache, scope:Langs.ScopeDictionary, 
    editor:Langs.EditorState, languagePlugins:LanguagePlugins): 
    Promise<{code: Graph.Node, exports: Graph.ExportNode[]}>{
  let languagePlugin = languagePlugins[editor.block.language]
  return languagePlugin.bind(cache, scope, editor.block);
}

async function bindAllCells(cache:Graph.NodeCache, editors:Langs.EditorState[], languagePlugins:LanguagePlugins) {
  var scope : Langs.ScopeDictionary = { };
  var newCells : Langs.BlockState[] = []
  for (var c = 0; c < editors.length; c++) {
    let editor = editors[c]
    let {code, exports} = await bindCell(cache, scope, editor, languagePlugins);
    var newCell = { editor:editor, code:code, exports:exports }
    for (var e = 0; e < exports.length; e++ ) {
      let exportNode = exports[e];
      scope[exportNode.variableName] = exportNode;
    }
    newCells.push(newCell)
  }
  return newCells;
}

async function updateAndBindAllCells
    (state:NotebookState, cell:Langs.BlockState, newSource: string): Promise<NotebookState> {
  Log.trace("Binding", "Begin rebinding subsequent cells %O %s", cell, newSource)
  var index = state.counter;
  let editors = state.cells.map(c => {
    let lang = state.languagePlugins[c.editor.block.language]
    if (c.editor.id == cell.editor.id) {
      let block = lang.parse(newSource);
      let editor:Langs.EditorState = lang.editor.initialize(index++, block);
      return editor;
    }
    else return c.editor;
  });
  let newCells = await bindAllCells(state.cache, editors, state.languagePlugins);
  return { cache:state.cache, cells:newCells, counter:index, contentChanged:state.contentChanged,
    expandedMenu:state.expandedMenu, languagePlugins: state.languagePlugins };
}

async function evaluate(node:Graph.Node, languagePlugins:LanguagePlugins) {
  if (node.value && (Object.keys(node.value).length > 0)) return;
  for(var ant of node.antecedents) await evaluate(ant, languagePlugins);

  let languagePlugin = languagePlugins[node.language]
  let source = (<any>node).source ? (<any>node).source.substr(0, 100) + "..." : "(no source)"
  Log.trace("evaluation","Evaluating %s node: %s", node.language, source)
  let evalResult = await languagePlugin.evaluate(node);
  Log.trace("evaluation","Evaluated %s node. Result: %O", node.language, node.value)
  switch(evalResult.kind) {
    case "success":
      node.value = evalResult.value;
      break;
    case "error":
      node.errors = evalResult.errors;
      break;
  }
}

// ------------------------------------------------------------------------------------------------
// Render and update functions
// ------------------------------------------------------------------------------------------------

function render(trigger:(evt:NotebookEvent) => void, state:NotebookState) {
  let nodes = state.cells.map(cell => {
    // The `context` object is passed to the render function. The `trigger` method
    // of the object can be used to trigger events that cause a state update.
    let context : Langs.EditorContext<any> = {
      trigger: (event:any) =>
        trigger({ kind:'block', id:cell.editor.id, event:event }),

      evaluate: async (block:Langs.BlockState) => {
        await evaluate(block.code, state.languagePlugins)
        for(var exp of block.exports) await evaluate(exp, state.languagePlugins)
        trigger({ kind:'refresh' })
      },

      rebindSubsequent: (block:Langs.BlockState, newSource: string) => {
        trigger({kind: 'rebind', block: block, newSource: newSource})
      }
    }

    let plugin = state.languagePlugins[cell.editor.block.language]
    let content = plugin.editor.render(cell, cell.editor, context)
    let icon = plugin.iconClassName;
    
    let icons = h('div', {class:'icons'}, [
      h('i', {id:'cellIcon_'+cell.editor.id, class: icon }, []),
      h('span', {}, [cell.editor.block.language] )
    ])

    let langs = Object.keys(state.languagePlugins).map(lang =>
        h('a', {
            key:"add-" + lang,
            onclick:()=>trigger({kind:'add', id:cell.editor.id, language:lang})},
          [ h('i', {'class':'fa fa-plus'}), lang ]))
      .concat(
        h('a', {
            key:"cancel",
            onclick:()=>trigger({kind:'toggleadd', id:-1})},
          [h('i', {'class':'fa fa-times'}), "cancel"]))

    let cmds = [
      h('a', {key:"add", onclick:()=>trigger({kind:'toggleadd', id:cell.editor.id})},[h('i', {'class':'fa fa-plus'}), "add below"]),
      h('a', {key:"remove", onclick:()=>trigger({kind:'remove', id:cell.editor.id})},[h('i', {'class':'fa fa-times'}), "remove this"])
    ]

    let tools = state.expandedMenu == cell.editor.id ? langs : cmds;
    let controls = h('div', {class:'controls'}, tools)

    let controlsBar = h('div', {class:'controls-bar'}, [controls])
    let iconsBar = h('div', {class:'icons-bar'}, [icons])
    let contentBar = h('div', {class:'content-bar'}, [content])
    let langIndex = Object.keys(state.languagePlugins).indexOf(cell.editor.block.language) % 5;
    return h('div', {class:'cell cell-c' + langIndex, key:cell.editor.id}, [
        iconsBar, contentBar, controlsBar
      ]
    );
  });
  Log.trace('main', "Re-Creating notebook for id '%s'", paperElementID)
  return h('div', {class:'container-fluid', id:paperElementID}, [nodes])
}

async function update(state:NotebookState, evt:NotebookEvent) : Promise<NotebookState> {

  function spliceEditor (editors:Langs.EditorState[], newEditor: Langs.EditorState, idOfAboveBlock: number) {
    return editors.map (editor => {
        if (editor.id === idOfAboveBlock) return [editor, newEditor];
        else return [editor]
      }).reduce ((a,b)=> a.concat(b));
  }

  function removeCell (cells:Langs.BlockState[], idOfSelectedBlock: number) {
    return cells.map (cell => {
        if (cell.editor.id === idOfSelectedBlock) return [];
        else return [cell]
      }).reduce ((a,b)=> a.concat(b));
  }
  
  switch(evt.kind) {
    case 'block': {
      let newCells = state.cells.map(cellState => 
        (cellState.editor.id != evt.id) ? cellState :
          { editor: state.languagePlugins[cellState.editor.block.language].editor.update(cellState.editor, evt.event),
            code: cellState.code, exports: cellState.exports })
      return { cache:state.cache, counter: state.counter, cells: newCells, contentChanged:state.contentChanged,
        expandedMenu: state.expandedMenu, languagePlugins: state.languagePlugins };
    }

    case 'toggleadd':
      return { cache: state.cache, counter: state.counter, cells: state.cells, 
        expandedMenu: evt.id, languagePlugins: state.languagePlugins, contentChanged:state.contentChanged };

    case 'add': {
      let newId = state.counter + 1;
      let lang = state.languagePlugins[evt.language];
      let newDocument = { "language": evt.language, "source": lang.getDefaultCode(newId) };
      let newBlock = lang.parse(newDocument.source);
      let editor = lang.editor.initialize(newId, newBlock);
      let newEditors = spliceEditor(state.cells.map(c => c.editor), editor, evt.id)
      let newCells = await bindAllCells(state.cache, newEditors, state.languagePlugins)
      return {cache:state.cache, counter: state.counter+1, expandedMenu:-1, 
        cells: newCells, languagePlugins: state.languagePlugins, contentChanged:state.contentChanged };
    }

    case 'refresh':
      return state;

    case 'remove':
      return {cache:state.cache, counter: state.counter, 
        languagePlugins: state.languagePlugins, contentChanged: state.contentChanged,
        expandedMenu:state.expandedMenu, cells: removeCell(state.cells, evt.id)};

    case 'rebind':
      let newState = await updateAndBindAllCells(state, evt.block, evt.newSource);
      state.contentChanged(saveDocument(newState))
      return newState
  }
}

// ------------------------------------------------------------------------------------------------
// Helper functions for creating notebooks
// ------------------------------------------------------------------------------------------------

async function initializeCells(elementID:string, counter: number, editors:Langs.EditorState[], 
    languagePlugins:LanguagePlugins, contentChanged:(newContent:string) => void) {
  let maquetteProjector = createProjector();
  let paperElement = document.getElementById(elementID);
  paperElementID = elementID;
  Log.trace('main', "Looking for element %s", paperElementID)
  let elementNotFoundError:string = "Missing paper element: "+elementID
  if (!paperElement) throw elementNotFoundError
  
  var cache = createNodeCache()
  var cells = await bindAllCells(cache, editors, languagePlugins);
  var state : NotebookState = {cache:cache, counter:counter, cells:cells, 
    contentChanged: contentChanged, expandedMenu:-1, languagePlugins:languagePlugins}

  function updateAndRender(event:NotebookEvent) {
    update(state, event).then(newState => {
      state = newState
      maquetteProjector.scheduleRender()
    });
  }

  maquetteProjector.replace(paperElement, () =>
    render(updateAndRender, state))
}

function loadNotebook(documents:Docs.DocumentElement[], languagePlugins:LanguagePlugins) {
  let index = 0
  let blockStates = documents.map(cell => {
    let languagePlugin = languagePlugins[cell.language]; // TODO: Error handling
    let block = languagePlugin.parse(cell.source);
    let editor:Langs.EditorState = languagePlugin.editor.initialize(index++, block);
    return editor;
  })
  return { counter: index, editors: blockStates };
}


function saveDocument(state:NotebookState): string {
  let content:string = ""
  for (let cell of state.cells) {
    let plugin = state.languagePlugins[cell.editor.block.language];
    let cellContent = plugin.save(cell.editor.block);
    content = content.concat(cellContent)
  }
  return content;
}

function createNodeCache() : Graph.NodeCache {
  let nodeCache = { }
  return {
    tryFindNode : (node:Graph.Node) => {
      let key = [ node.language, node.hash ].concat(node.antecedents.map(a => a.hash)).join(",")
      if (typeof(nodeCache[key]) == "undefined")
        nodeCache[key] = node;
      return nodeCache[key];
    }
  }
}

// ------------------------------------------------------------------------------------------------
// Render and update functions
// ------------------------------------------------------------------------------------------------

declare var PYTHONSERVICE_URI: string;
declare var RSERVICE_URI: string;
declare var RACKETSERVICE_URI: string;

interface WrattlerNotebook {
  getDocumentContent() : string
  addDocumentContentChanged(handler:(newContent:string) => void) : void
}

class Wrattler {
  getDefaultLanguages() : LanguagePlugins {
    var languagePlugins : LanguagePlugins = { };
    let pyCode =  "# This is a python cell \n# py[ID] = pd.DataFrame({\"id\":[\"[ID]\"], \"language\":[\"python\"]})";
    let rCode = "# This is an R cell \n r[ID] <- data.frame(id = [ID], language =\"r\")";
    let rcCode = ";; This is a Racket cell [ID]\n";
    
    languagePlugins["markdown"] = markdownLanguagePlugin;
    languagePlugins["javascript"] = javascriptLanguagePlugin;    
    languagePlugins["python"] = new externalLanguagePlugin("python", "fab fa-python", PYTHONSERVICE_URI, pyCode);
    languagePlugins["r"] = new externalLanguagePlugin("r", "fab fa-r-project", RSERVICE_URI, rCode);
    languagePlugins["racket"] = new externalLanguagePlugin("racket", "fa fa-question-circle", RACKETSERVICE_URI, rcCode);    
    return languagePlugins;
  }

  async createNamedNotebook(elementID:string, languagePlugins:LanguagePlugins) : Promise<WrattlerNotebook> {
    return this.createNotebook(elementID, await Docs.getNamedDocumentContent(), languagePlugins);
  }
  
  async createNotebook(elementID:string, content:string, languagePlugins:LanguagePlugins) : Promise<WrattlerNotebook> {
    Log.trace("main", "Creating notebook for id '%s'", elementID)
    let documents = await Docs.getDocument(content);
    var {counter, editors} = loadNotebook(documents, languagePlugins);

    var currentContent = content;
    var handlers : ((newContent:string) => void)[] = [];
    function contentChanged(newContent:string) { 
      currentContent = newContent; 
      for(var h of handlers) h(currentContent);
    }

    initializeCells(elementID, counter, editors, languagePlugins, contentChanged);
    return {
      getDocumentContent : () => currentContent,
      addDocumentContentChanged : (h:(newContent:string) => void) => handlers.push(h)
    }
  }
}

/*
export async function initializeNotebook(elementID:string) {
  Log.trace('main',"Init notebook with ID: %s", elementID)
  let documents = await getNamedDocument();
  var {counter, editors} = await loadNotebook(documents);
  initializeCells(elementID, counter, editors)
};
*/

(<any>window).wrattler = new Wrattler();

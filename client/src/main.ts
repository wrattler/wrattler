/** @hidden */

/** This comment is needed so that TypeDoc parses the above one correctly */
import {h,createProjector} from 'maquette'
import { Log } from "./common/log"
import * as State from './definitions/state'
import * as Langs from './definitions/languages'
import * as Graph from './definitions/graph'
import { markdownLanguagePlugin } from './languages/markdown'
import { javascriptLanguagePlugin } from './languages/javascript'
import { externalLanguagePlugin } from './languages/external'
// import { gammaLangaugePlugin } from "./languages/gamma/plugin"
import { getNamedDocument, getDocument, DocumentElement, saveDocument } from './services/documentService'
import { stat } from 'fs';

declare var PYTHONSERVICE_URI: string;
declare var RSERVICE_URI: string;
declare var RACKETSERVICE_URI: string;

// ------------------------------------------------------------------------------------------------
// Main notebook rendering code
// ------------------------------------------------------------------------------------------------

var languagePlugins : { [language: string]: Langs.LanguagePlugin; } = { };
languagePlugins["markdown"] = markdownLanguagePlugin;
languagePlugins["javascript"] = javascriptLanguagePlugin;
languagePlugins["python"] = new externalLanguagePlugin("python", PYTHONSERVICE_URI);
languagePlugins["r"] = new externalLanguagePlugin("r", RSERVICE_URI);
languagePlugins["racket"] = new externalLanguagePlugin("racket", RACKETSERVICE_URI);
// languagePlugins["thegamma"] = gammaLangaugePlugin;

interface NotebookAddEvent { kind:'add', id: number, language:string }
interface NotebookToggleAddEvent { kind:'toggleadd', id: number }
interface NotebookRemoveEvent { kind:'remove', id: number }
interface NotebookBlockEvent { kind:'block', id:number, event:any }
interface NotebookRefreshEvent { kind:'refresh' }
interface NotebookSourceChange { kind:'rebind', block: Langs.BlockState, newSource: string}
type NotebookEvent = NotebookAddEvent | NotebookToggleAddEvent | NotebookRemoveEvent | NotebookBlockEvent | NotebookRefreshEvent | NotebookSourceChange
let documentContent:string;

function bindCell (cache:Graph.NodeCache, scope:Langs.ScopeDictionary, editor:Langs.EditorState): Promise<{code: Graph.Node, exports: Graph.ExportNode[]}>{
  let languagePlugin = languagePlugins[editor.block.language]
  return languagePlugin.bind(cache, scope, editor.block);
}


async function bindAllCells(cache:Graph.NodeCache, editors:Langs.EditorState[]) {
  var scope : Langs.ScopeDictionary = { };
  var newCells : Langs.BlockState[] = []
  for (var c = 0; c < editors.length; c++) {
    let editor = editors[c]
    let {code, exports} = await bindCell(cache, scope, editor);
    var newCell = { editor:editor, code:code, exports:exports }
    for (var e = 0; e < exports.length; e++ ) {
      let exportNode = exports[e];
      scope[exportNode.variableName] = exportNode;
    }
    newCells.push(newCell)
  }
  return newCells;
}

async function updateAndBindAllCells(state:State.NotebookState, cell:Langs.BlockState, newSource: string) : Promise<State.NotebookState> {
  Log.trace("Binding", "Begin rebinding subsequent cells %O %s", cell, newSource)
  var index = state.counter;
  let editors = state.cells.map(c => {
    let lang = languagePlugins[c.editor.block.language]
    if (c.editor.id == cell.editor.id) {
      let block = lang.parse(newSource);
      let editor:Langs.EditorState = lang.editor.initialize(index++, block);
      return editor;
    }
    else return c.editor;
  });
  let newCells = await bindAllCells(state.cache, editors);
  return { cache:state.cache, cells:newCells, counter:index, expandedMenu:state.expandedMenu };
}

async function evaluate(node:Graph.Node) {
  if ((node.value)&&(Object.keys(node.value).length > 0)) return;
  for(var ant of node.antecedents) await evaluate(ant);

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
 return;

}

function render(trigger:(evt:NotebookEvent) => void, state:State.NotebookState) {
  let nodes = state.cells.map(cell => {
    // The `context` object is passed to the render function. The `trigger` method
    // of the object can be used to trigger events that cause a state update.
    let context : Langs.EditorContext<any> = {
      trigger: (event:any) =>
        trigger({ kind:'block', id:cell.editor.id, event:event }),

      evaluate: async (block:Langs.BlockState) => {
        await evaluate(block.code)
        for(var exp of block.exports) await evaluate(exp)
        trigger({ kind:'refresh' })

      },

      rebindSubsequent: (block:Langs.BlockState, newSource: string) => {
        trigger({kind: 'rebind', block: block, newSource: newSource})
      }
    }

    let plugin = languagePlugins[cell.editor.block.language]
    let content = plugin.editor.render(cell, cell.editor, context)
    let icon = ""

    switch (cell.editor.block.language) {
      case 'python':
        icon = 'fab fa-python'
        break
      case 'javascript':
        icon = 'fab fa-js-square'
        break
      case 'r':
        icon = 'fab fa-r-project'
        break
      case 'markdown':
        icon = 'fa fa-arrow-down'
        break
      default:
        icon = 'fa fa-question-circle'
        break
    }

    let icons = h('div', {class:'icons'}, [
      h('i', {id:'cellIcon_'+cell.editor.id, class: icon }, []),
      h('span', {}, [cell.editor.block.language] )
    ])

    let langs = Object.keys(languagePlugins).map(lang =>
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
    let langIndex = Object.keys(languagePlugins).indexOf(cell.editor.block.language) % 5;
    return h('div', {class:'cell cell-c' + langIndex, key:cell.editor.id}, [
        iconsBar, contentBar, controlsBar
      ]
    );
  });

  return h('div', {class:'container-fluid', id:'paper'}, [nodes])
}

async function update(state:State.NotebookState, evt:NotebookEvent) : Promise<State.NotebookState> {
  function spliceEditor (editors:Langs.EditorState[], newEditor: Langs.EditorState, idOfAboveBlock: number) {
    return editors.map (editor =>
      {
        if (editor.id === idOfAboveBlock) {
          return [editor, newEditor];
        }
        else {
          return [editor]
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
      let newCells = state.cells.map(state =>
        (state.editor.id != evt.id) ? state :
          { editor: languagePlugins[state.editor.block.language].editor.update(state.editor, evt.event) ,
            code: state.code, exports: state.exports })
      return { cache:state.cache, counter: state.counter, cells: newCells, expandedMenu: state.expandedMenu };
    }

    case 'toggleadd':
      return { cache: state.cache, counter: state.counter, cells: state.cells, expandedMenu: evt.id };

    case 'add': {
      let newId = state.counter + 1;
      let newDocument = { "language": evt.language, "source": ""};
      switch (evt.language) {
        case 'python': {
          newDocument.source = "# This is a python cell \n# py"+newId+" = pd.DataFrame({\"id\":[\""+newId+"\"], \"language\":[\"python\"]})";
          break;
        }
        case 'markdown': {
          newDocument.source = "Md"+newId+": This is a markdown cell.";
          break
        }
        case 'r': {
          newDocument.source = "# This is an R cell \n r"+newId+" <- data.frame(id = "+newId+", language =\"r\")";
          break
        }
        case 'racket': {
          newDocument.source = ";; This is a Racket cell \n";
          break
        }
        case 'javascript': {
          newDocument.source = "// This is a javascript cell. \n//var js"+newId+" = [{'id':"+newId+", 'language':'javascript'}]";
          break
        }
      }
      let lang = languagePlugins[newDocument.language];
      let newBlock = lang.parse(newDocument.source);
      let editor = lang.editor.initialize(newId, newBlock);
      let newEditors = spliceEditor(state.cells.map(c => c.editor), editor, evt.id)
      let newCells = await bindAllCells(state.cache, newEditors)
      return {cache:state.cache, counter: state.counter+1, expandedMenu:-1, cells: newCells};
    }

    case 'refresh':
      return state;

    case 'remove':
      return {cache:state.cache, counter: state.counter,  expandedMenu:state.expandedMenu, cells: removeCell(state.cells, evt.id)};

    case 'rebind':
      let newState = await updateAndBindAllCells(state, evt.block, evt.newSource);
      if ((<any>window).documentContentChanged)
        (<any>window).documentContentChanged(saveDocument(newState))
      return newState
  }
}

async function loadNotebookState() : Promise<{ counter:number, editors:Langs.EditorState[] }> {
  let documents = await getNamedDocument();
  return loadNotebook(documents);
}

async function loadNotebookContent(content:string) : Promise<{ counter:number, editors:Langs.EditorState[] }> {
  let documents = await getDocument(content);
  return loadNotebook(documents);
}

function loadNotebook(documents:DocumentElement[]) {
  let index = 0
  let blockStates = documents.map(cell => {
    let languagePlugin = languagePlugins[cell.language]; // TODO: Error handling
    let block = languagePlugin.parse(cell.source);
    let editor:Langs.EditorState = languagePlugin.editor.initialize(index++, block);
    return editor;
  })
  return { counter: index, editors: blockStates };
}

export async function initializeNotebook(elementID:string) {
  Log.trace('main',"Init notebook with ID: %s", elementID)
  var {counter, editors} = await loadNotebookState();
  initializeCells(elementID, counter, editors)
};

export async function initializeNotebookJupyterLab(elementID:string, content:string) {
  var {counter, editors} = await loadNotebookContent(content);
  initializeCells(elementID, counter, editors)
};


let nodeCache = { }

let cache : Graph.NodeCache = {
  tryFindNode : (node:Graph.Node) => {
    let key = [ node.language, node.hash ].concat(node.antecedents.map(a => a.hash)).join(",")
    if (typeof(nodeCache[key]) == "undefined")
      nodeCache[key] = node;
    return nodeCache[key];
  }
}

async function initializeCells(elementID:string, counter: number, editors:Langs.EditorState[] ) {
  let maquetteProjector = createProjector();
  let paperElement = document.getElementById(elementID);
  if (!paperElement) throw "Missing paper element!"

  var cells = await bindAllCells(cache, editors);
  var state = {cache:cache, counter:counter, cells:cells, expandedMenu:-1}

  function updateAndRender(event:NotebookEvent) {
    update(state, event).then(newState => {
      state = newState
      maquetteProjector.scheduleRender()
    });
  }

  maquetteProjector.replace(paperElement, () =>
    render(updateAndRender, state))
}

export function exportDocumentContent():string {
  // console.log("Exporting document content")
  return documentContent
}

(<any>window).exportDocumentContent = exportDocumentContent;
(<any>window).initializeNotebook = initializeNotebook;
(<any>window).initializeNotebookJupyterLab = initializeNotebookJupyterLab;

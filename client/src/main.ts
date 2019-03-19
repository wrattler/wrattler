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

// ------------------------------------------------------------------------------------------------
// Main notebook rendering code
// ------------------------------------------------------------------------------------------------

var languagePlugins : { [language: string]: Langs.LanguagePlugin; } = { };
languagePlugins["markdown"] = markdownLanguagePlugin;
languagePlugins["javascript"] = javascriptLanguagePlugin;
languagePlugins["python"] = new externalLanguagePlugin("python", PYTHONSERVICE_URI);
languagePlugins["r"] = new externalLanguagePlugin("r", RSERVICE_URI);
// languagePlugins["thegamma"] = gammaLangaugePlugin;
<<<<<<< Updated upstream
var scopeDictionary : { [variableName: string]: Graph.ExportNode} = { };
=======
>>>>>>> Stashed changes

interface NotebookAddEvent { kind:'add', id: number, language:string }
interface NotebookRemoveEvent { kind:'remove', id: number }
interface NotebookBlockEvent { kind:'block', id:number, event:any }
interface NotebookRefreshEvent { kind:'refresh' }
interface NotebookSourceChange { kind:'rebind', block: Langs.BlockState, newSource: string}
type NotebookEvent = NotebookAddEvent | NotebookRemoveEvent | NotebookBlockEvent | NotebookRefreshEvent | NotebookSourceChange
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

function render(trigger:(NotebookEvent) => void, state:State.NotebookState) {

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
    let vnode = plugin.editor.render(cell, cell.editor, context)
    let icon = ""
    
    switch (cell.editor.block.language) {
      case 'python':
        icon = 'icon fab fa-python fa-2x'
        break
      case 'javascript':
        icon = 'icon fab fa-js-square fa-2x'
        break
      case 'r':
        icon = 'icon fab fa-r-project fa-2x'
        break
      case 'markdown':
        icon = 'icon fas fa-arrow-down fa-2x'
        break
      default:
        icon = 'icon far fa-question-circle fa-2x'
        break
    }

    let c_icon = h('i', {id:'cellIcon_'+cell.editor.id, class: icon }, [])
    let c_language = h('p', {style: 'float:left'}, [cell.editor.block.language] )

    let c_addPy = h('button', {id:'addPy_'+cell.editor.id, class:"add-button", onclick:()=>trigger({kind:'add', id:cell.editor.id, language:"python"})},["*.py"]);
    let c_addMd = h('button', {id:'addMd_'+cell.editor.id, class:"add-button", onclick:()=>trigger({kind:'add', id:cell.editor.id, language:"markdown"})},["*.md"]);
    let c_addJs = h('button', {id:'addJs_'+cell.editor.id, class:"add-button", onclick:()=>trigger({kind:'add', id:cell.editor.id, language:"javascript"})},["*.js"]);
    let c_addR = h('button', {id:'addR_'+cell.editor.id, class:"add-button", onclick:()=>trigger({kind:'add', id:cell.editor.id,language:"r"})},["*.r"]);

    let c_delete = h('button', {id:'remove_'+cell.editor.id, class: 'far fa-trash-alt delete', onclick:()=>trigger({kind:'remove', id:cell.editor.id})});
    let controls = h('div', {class:'controls vertical-center'}, [c_addMd, c_addPy, c_addR, c_addJs, c_delete])
    let controlsBar = h('div', {class:'controlsBar'}, [c_icon, controls])
    return h('div', {class:'cell', key:cell.editor.id}, [
        h('div', [controlsBar]),vnode
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

    case 'add': {
      let newId = state.counter + 1;
      let newDocument = { "language": evt.language,
                          "source": ""};
                          
      switch (evt.language) {
        case 'python': {
          newDocument.source = "# This is a python cell \n# py"+newId+" = pd.DataFrame({\"id\":[\""+newId+"\"], \"language\":[\"python\"]})";
          // newDocument.source =  newDocument.source.concat('\n# nick = pd.DataFrame({"name":["Nick"], "age":[20], "mood":"tired"})')
          break;
        } 
        case 'markdown': {
          newDocument.source = "Md"+newId+": This is a markdown cell.";
          break
        } 
        case 'r': {
          newDocument.source = "# This is an R cell \n r"+newId+" <- data.frame(id = "+newId+", language =\"r\")";
          // newDocument.source =  newDocument.source.concat('\n# camilla <- data.frame(name = "camilla", age=17, mood="apprehensive")')
          break
        }
        case 'javascript': {
          newDocument.source = "// This is a javascript cell. \n//var js"+newId+" = [{'id':"+newId+", 'language':'javascript'}]";
          // newDocument.source =  newDocument.source.concat('\n// var may = [{"name":"may", "age":40, "mood":"terrified"}]')
          break
        } 
      }
      console.log(newDocument)
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


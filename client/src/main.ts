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
var scopeDictionary : { [variableName: string]: Graph.ExportNode} = { };

interface NotebookAddEvent { kind:'add', id: number, language:string }
interface NotebookRemoveEvent { kind:'remove', id: number }
interface NotebookBlockEvent { kind:'block', id:number, event:any }
interface NotebookRefreshEvent { kind:'refresh' }
interface NotebookSourceChange { kind:'rebind', block: Langs.BlockState, newSource: string}
type NotebookEvent = NotebookAddEvent | NotebookRemoveEvent | NotebookBlockEvent | NotebookRefreshEvent | NotebookSourceChange
let documentContent:string;

function bindCell (editor:Langs.EditorState): Promise<{code: Graph.Node, exports: Graph.ExportNode[]}>{
  let languagePlugin = languagePlugins[editor.block.language]
  return languagePlugin.bind(scopeDictionary, editor.block);
}

async function bindAllCells(editors:Langs.EditorState[]) {
  var newCells : Langs.BlockState[] = []
  for (var c = 0; c < editors.length; c++) {
    let editor = editors[c]
    let {code, exports} = await bindCell(editor);
    var newCell = { editor:editor, code:code, exports:exports }
    for (var e = 0; e < exports.length; e++ ) {
      let exportNode = exports[e];
      scopeDictionary[exportNode.variableName] = exportNode;
    }
    newCells.push(newCell)
  }
  return newCells;
}

async function rebindSubsequentCells(state:State.NotebookState, cell:Langs.BlockState, newSource: string) {
  Log.trace("Binding", "Begin rebinding subsequent cells %O %s", cell, newSource)
  for (var b=0; b < state.cells.length; b++) {
    // if (state.cells[b].editor.id >= cell.editor.id) {
      let languagePlugin = languagePlugins[state.cells[b].editor.block.language]
      let block = state.cells[b].editor.block;
      if (state.cells[b].editor.id == cell.editor.id) {
        block = languagePlugin.parse(newSource);
      }
      let id = state.cells[b].editor.id;
      let editor:Langs.EditorState = languagePlugin.editor.initialize(id, block);
      var index = state.cells.indexOf(state.cells[b]);
      for (var e = 0; e < state.cells[b].exports.length; e++) {
        let oldExport:Graph.ExportNode = <Graph.ExportNode>state.cells[b].exports[e];
        delete scopeDictionary[oldExport.variableName];
      }
      if (index !== -1) {
        let newBlock:Langs.BlockState = {editor: editor, code: state.cells[b].code, exports: state.cells[b].exports};
        state.cells[index] = newBlock;
      }
    // }
  }
  for (var b=0; b < state.cells.length; b++) {
    
      let aCell = state.cells[b]
      let {code, exports} = await bindCell(aCell.editor);
      aCell.code = code
      aCell.exports = exports
      for (var e = 0; e < exports.length; e++ ) {
        let exportNode = exports[e];
        scopeDictionary[exportNode.variableName] = exportNode;
      }
  }
  Log.trace("Binding", "Finish rebinding subsequent cells")
  return state;
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
      return { counter: state.counter, cells: newCells };
    }
    case 'add': {
      let newId = state.counter + 1;
      let newDocument = { "language": evt.language,
                          "source": ""};
                          
      switch (evt.language) {
        case 'python': {
          newDocument.source = "# This is a python cell \n# py"+newId+" = pd.DataFrame({\"id\":[\""+newId+"\"], \"language\":[\"python\"]})";
          newDocument.source =  newDocument.source.concat('\n# nick = pd.DataFrame({"name":["Nick"], "age":[20], "mood":"tired"})')
          break;
        } 
        case 'markdown': {
          newDocument.source = newId+": This is a markdown cell.";
          break
        } 
        case 'r': {
          newDocument.source = "# This is an R cell \n r"+newId+" <- data.frame(id = "+newId+", language =\"r\")";
          newDocument.source =  newDocument.source.concat('\n# camilla <- data.frame(name = "camilla", age=17, mood="apprehensive")')
          break
        }
        case 'javascript': {
          newDocument.source = "// This is a javascript cell. \n//var js"+newId+" = [{'id':"+newId+", 'language':'javascript'}]";
          newDocument.source =  newDocument.source.concat('\n// var may = [{"name":"may", "age":40, "mood":"terrified"}]')
          break
        } 
      }
      console.log(newDocument)
      let newPlugin = languagePlugins[newDocument.language];
      let newBlock = newPlugin.parse(newDocument.source);
      let editor:Langs.EditorState = newPlugin.editor.initialize(newId, newBlock);
      let {code, exports} = await bindCell(editor);
      let cell:Langs.BlockState = {editor: editor, code: code, exports: exports}
      return {counter: state.counter+1, cells: spliceCell(state.cells, cell, evt.id)};
    }

    case 'refresh':
      return state;

    case 'remove':
      return {counter: state.counter, cells: removeCell(state.cells, evt.id)};

    case 'rebind': 
      let newState = await rebindSubsequentCells(state, evt.block, evt.newSource);
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

async function initializeCells(elementID:string, counter: number, editors:Langs.EditorState[] ) {
  let maquetteProjector = createProjector();
  let paperElement = document.getElementById(elementID);
  if (!paperElement) throw "Missing paper element!"

  var cells = await bindAllCells(editors);
  var state = {counter:counter, cells:cells}

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


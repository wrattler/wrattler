/** @hidden */

/** This comment is needed so that TypeDoc parses the above one correctly */
import {h,createProjector,VNode} from 'maquette'
import { Log } from "./common/log"
import * as Langs from './definitions/languages'
import * as Graph from './definitions/graph'
import { markdownLanguagePlugin } from './languages/markdown'
import { javascriptLanguagePlugin } from './languages/javascript'
import { externalLanguagePlugin } from './languages/external'
import { gammaLangaugePlugin } from "./languages/gamma/plugin"
import { getSampleDocument } from './services/documentService'

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
languagePlugins["thegamma"] = gammaLangaugePlugin;
var scopeDictionary : { [variableName: string]: Graph.ExportNode} = { };

interface NotebookAddEvent { kind:'add', id: number }
interface NotebookRemoveEvent { kind:'remove', id: number }
interface NotebookBlockEvent { kind:'block', id:number, event:any }
interface NotebookRefreshEvent { kind:'refresh' }
// interface NotebookSourceChange { kind:'sourceChange' }
interface NotebookSourceChange { kind:'rebind', block: Langs.BlockState, newSource: string}
type NotebookEvent = NotebookAddEvent | NotebookRemoveEvent | NotebookBlockEvent | NotebookRefreshEvent | NotebookSourceChange

type NotebookState = {
  cells: Langs.BlockState[]
  counter: number
}


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

async function rebindSubsequentCells(state:NotebookState, cell:Langs.BlockState, newSource: string) {
  for (var b=0; b < state.cells.length; b++) {
    if (state.cells[b].editor.id >= cell.editor.id) {
      let languagePlugin = languagePlugins[state.cells[b].editor.block.language]
      let block = state.cells[b].editor.block;
      if (state.cells[b].editor.id == cell.editor.id) {
        block = languagePlugin.parse(newSource);
        console.log(block)
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
    }
  }
  console.log(state.cells);
  for (var b=0; b < state.cells.length; b++) {
    if (state.cells[b].editor.id >= cell.editor.id) {
      let aCell = state.cells[b]
      let {code, exports} = await bindCell(aCell.editor);
      aCell.code = code
      aCell.exports = exports
      for (var e = 0; e < exports.length; e++ ) {
        let exportNode = exports[e];
        scopeDictionary[exportNode.variableName] = exportNode;
      }
    }
  }
  console.log(state.cells);
  return state;
}

async function evaluate(node:Graph.Node) {
  if ((node.value)&&(Object.keys(node.value).length > 0)) return;
  for(var ant of node.antecedents) await evaluate(ant);

  let languagePlugin = languagePlugins[node.language]
  node.value = await languagePlugin.evaluate(node);
  // console.log("Received value: "+JSON.stringify(node.value));
  return;
}

function render(trigger:(NotebookEvent) => void, state:NotebookState) {

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

      // sourceChange
      // rebind all blocks after this one
      rebindSubsequent: (block:Langs.BlockState, newSource: string) => {
        trigger({kind: 'rebind', block: block, newSource: newSource})
      }
    }

    let plugin = languagePlugins[cell.editor.block.language]
    // let vnode = plugin.editor.render(state.editor, context)
    let vnode = plugin.editor.render(cell, cell.editor, context)
    let c_language = h('p', {style: 'float:left'}, [cell.editor.block.language] )
    let c_add = h('i', {id:'add_'+cell.editor.id, class: 'fas fa-plus control', onclick:()=>trigger({kind:'add', id:cell.editor.id})});
    let c_delete = h('i', {id:'remove_'+cell.editor.id, class: 'far fa-trash-alt control', onclick:()=>trigger({kind:'remove', id:cell.editor.id})});
    let controls = h('div', {class:'controls'}, [c_language, c_add, c_delete])
    return h('div', {class:'cell', key:cell.editor.id}, [
        h('div', [controls]),vnode
      ]
    );
  });

  return h('div', {class:'container-fluid', id:'paper'}, [nodes])
}

async function update(state:NotebookState, evt:NotebookEvent) : Promise<NotebookState> {
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

  // console.log(state);
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
      let newDocument = { "language": "python",
                          "source": "var z = "+newId};
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

    case 'rebind': {
      // console.log("Rebind in update: "+JSON.stringify(evt))
      return await rebindSubsequentCells(state, evt.block, evt.newSource);
    }

  }
}

async function loadNotebookState() : Promise<{ counter:number, editors:Langs.EditorState[] }> {
  let documents = await getSampleDocument();

  // Create an initial notebook state by parsing the sample document
  let index = 0
  let blockStates = documents.map(cell => {
    let languagePlugin = languagePlugins[cell.language]; // TODO: Error handling
    let block = languagePlugin.parse(cell.source);
    let editor:Langs.EditorState = languagePlugin.editor.initialize(index++, block);
    return editor;
  })
  return { counter: index, editors: blockStates };
}

async function initializeNotebook() {
  let maquetteProjector = createProjector();
  let paperElement = document.getElementById('paper');
  if (!paperElement) throw "Missing paper element!"

  var {counter, editors} = await loadNotebookState();
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
};

initializeNotebook()

Log.trace("test1","hi1 %O", {"a":123})
Log.trace("test2","hi2 %O", {"a":123})
Log.trace("test3","hi3 %O", {"a":123})
Log.trace("test1","hi4 %s", {"a":123})
Log.trace("test2","hi5 %s", {"a":123})

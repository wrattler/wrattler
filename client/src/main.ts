/** @hidden */

/** This comment is needed so that TypeDoc parses the above one correctly */
import {h,createProjector,VNode} from 'maquette'
import { Log } from "./common/log"
import * as Langs from './definitions/languages'
import * as Graph from './definitions/graph'
import { markdownLanguagePlugin } from './languages/markdown'
import { javascriptLanguagePlugin } from './languages/javascript'
import { pythonLanguagePlugin } from './languages/python'
import { apiPlugin } from './languages/rPython'
import { gammaLangaugePlugin } from "./languages/gamma/plugin"

declare var PYTHONSERVICE_URI: string;
declare var RSERVICE_URI: string;

// ------------------------------------------------------------------------------------------------
// Main notebook rendering code
// ------------------------------------------------------------------------------------------------


var languagePlugins : { [language: string]: Langs.LanguagePlugin; } = { };
languagePlugins["markdown"] = markdownLanguagePlugin;
languagePlugins["javascript"] = javascriptLanguagePlugin;
languagePlugins["python"] = new apiPlugin("python", PYTHONSERVICE_URI);
languagePlugins["r"] = new apiPlugin("r", RSERVICE_URI);
languagePlugins["thegamma"] = gammaLangaugePlugin;
var scopeDictionary : { [variableName: string]: Graph.ExportNode} = { };

// A sample document is just an array of records with cells. Each 
// cell has a language and source code (here, just Markdown):
// 1. create 2 blocks, 1 py dataframe, 1 js read dataframe length
let documents = 
  [ 
    // { "language": "markdown", "source": "First, we create one frame in JavaScript:" },
    // { "language": "javascript", "source": "var one = [{'name':'Joe', 'age':50}]" },
    // { "language": "markdown", "source": "Second, we create one frame in Python:" },
    { "language": "python", "source": 'one = pd.DataFrame({"name":["Joe"], "age":[52]})' },
    { "language": "python", "source": 'two = pd.DataFrame({"name":["Jim"], "age":[51]})' },
    { "language": "r", "source": 'joinR <- rbind(one,two) ' },
    // { "language": "javascript"}
    // { "language": "markdown", "source": "Now, test if we can access both from JavaScript" },
    // { "language": "javascript", "source": "var joinJs = one.concat(two)"},
    // { "language": "markdown", "source": "Similarly, test if we can access both from Python" },
    // { "language": "python", "source": "joinPy = one.append(two); joinPyFlip = two.append(one)"},
    // { "language": "thegamma", "source": "1+2"} 
  ]

interface NotebookAddEvent { kind:'add', id: number }
interface NotebookRemoveEvent { kind:'remove', id: number }
interface NotebookBlockEvent { kind:'block', id:number, event:any }
interface NotebookRefreshEvent { kind:'refresh' }
// interface NotebookSourceChange { kind:'sourceChange' }
interface NotebookSourceChange { kind:'rebind', block: Langs.BlockState, newSource: string}
type NotebookEvent = NotebookAddEvent | NotebookRemoveEvent | NotebookBlockEvent | NotebookRefreshEvent | NotebookSourceChange

type NotebookState = {
  cells: Langs.BlockState[]
}

// Create an initial notebook state by parsing the sample document
let index = 0
let blockStates = documents.map(cell => {
  let languagePlugin = languagePlugins[cell.language]; // TODO: Error handling
  let block = languagePlugin.parse(cell.source);
  let editor:Langs.EditorState = languagePlugin.editor.initialize(index++, block); 
  return {editor: editor, code: null, exports: []};  
})
let state : NotebookState = { cells: blockStates };

function bindCell (cell:Langs.BlockState): Promise<{code: Graph.Node, exports: Graph.ExportNode[]}>{
  let languagePlugin = languagePlugins[cell.editor.block.language]
  return languagePlugin.bind(scopeDictionary, cell.editor.block);
}

async function bindAllCells() {
  var newCells = []
  for (var c = 0; c < state.cells.length; c++) {
    let aCell = state.cells[c]
    let {code, exports} = await bindCell(aCell);
    var newCell = { editor:aCell.editor, code:code, exports:exports }
    for (var e = 0; e < exports.length; e++ ) {
      let exportNode = exports[e];
      scopeDictionary[exportNode.variableName] = exportNode;
    }
    newCells.push(newCell)
  }
  state.cells = newCells;
}

async function rebindSubsequentCells(cell:Langs.BlockState, newSource: string) {
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
      let newBlock:Langs.BlockState = {editor: editor, code: null, exports: []};  
      var index = state.cells.indexOf(state.cells[b]);
      for (var e = 0; e < state.cells[b].exports.length; e++) {
        let oldExport:Graph.ExportNode = <Graph.ExportNode>state.cells[b].exports[e];
        delete scopeDictionary[oldExport.variableName];
      }
      if (index !== -1) {
        state.cells[index] = newBlock;
      }
    }
  }
  console.log(state.cells);
  for (var b=0; b < state.cells.length; b++) {
    if (state.cells[b].editor.id >= cell.editor.id) {
      let aCell = state.cells[b]
      let {code, exports} = await bindCell(aCell);
      aCell.code = code
      aCell.exports = exports
      for (var e = 0; e < exports.length; e++ ) {
        let exportNode = exports[e];
        scopeDictionary[exportNode.variableName] = exportNode;
      }
    }
  }
  console.log(state.cells);
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

function update(state:NotebookState, evt:NotebookEvent) {
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
      return { cells: newCells };
    }
    case 'add': {
      let newId = index++;
      let newDocument = { "language": "python", 
                          "source": "var z = "+newId};
      let newPlugin = languagePlugins[newDocument.language]; 
      let newBlock = newPlugin.parse(newDocument.source);
      let editor:Langs.EditorState = newPlugin.editor.initialize(newId, newBlock);  
      let cell:Langs.BlockState = {editor: editor, code: undefined, exports: []}
      bindCell(cell)
      return {cells: spliceCell(state.cells, cell, evt.id)};
    }

    case 'refresh':
      return state;

    case 'remove':
      return {cells: removeCell(state.cells, evt.id)};
    
    case 'rebind': {
      // console.log("Rebind in update: "+JSON.stringify(evt))
      rebindSubsequentCells(evt.block, evt.newSource);
      return state;
    }

  }
}

let maquetteProjector = createProjector();
let paperElement = document.getElementById('paper');

function updateAndRender(event:NotebookEvent) {
  state = update(state, event)
  maquetteProjector.scheduleRender()
}

bindAllCells().then(() =>
  maquetteProjector.replace(paperElement, () => render(updateAndRender, state))
);


 
Log.trace("test1","hi1 %O", {"a":123})
Log.trace("test2","hi2 %O", {"a":123})
Log.trace("test3","hi3 %O", {"a":123})
Log.trace("test1","hi4 %s", {"a":123})
Log.trace("test2","hi5 %s", {"a":123})

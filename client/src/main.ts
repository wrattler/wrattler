/** @hidden */

/** This comment is needed so that TypeDoc parses the above one correctly */
import { h,createProjector, VNode } from 'maquette'
import { Log } from "./common/log"
import * as Langs from './definitions/languages'
import * as Graph from './definitions/graph'
import * as Docs from './services/documentService'
import { editor } from 'monaco-editor';

// ------------------------------------------------------------------------------------------------
// Notebook user interface state and event type
// ------------------------------------------------------------------------------------------------

interface NotebookAddEvent { kind:'add', id: number, language:string }
interface NotebookMoveEvent { kind:'move', cell: Langs.BlockState, direction:"up"|"down"}
interface NotebookToggleAddEvent { kind:'toggleadd', id: number }
interface NotebookRemoveEvent { kind:'remove', id: number }
interface NotebookBlockEvent { kind:'block', id:number, event:any }
interface NotebookUpdateTriggerEvalEvent { kind:'evaluate', id:number }
interface NotebookUpdateEvalStateEvent { kind:'evalstate', hash:string, newState:"pending" | "done" }
interface NotebookSourceChange { kind:'rebind', block: Langs.BlockState, newSource: string}

type NotebookEvent =
  NotebookAddEvent | NotebookToggleAddEvent | NotebookRemoveEvent | NotebookUpdateTriggerEvalEvent |
  NotebookBlockEvent | NotebookUpdateEvalStateEvent | NotebookSourceChange | NotebookMoveEvent

type LanguagePlugins = { [lang:string] : Langs.LanguagePlugin }

type NotebookState = {
  contentChanged: (newContent:string) => void,
  languagePlugins: LanguagePlugins
  cells: Langs.BlockState[]
  counter: number
  expandedMenu : number
  cache: Graph.NodeCache
  resourceServerUrl: string
  resources:Array<Langs.Resource>
}

let paperElementID:string='paper'
// ------------------------------------------------------------------------------------------------
// Helper functions for binding nodes
// ------------------------------------------------------------------------------------------------

function bindCell (cache:Graph.NodeCache,
  scope:Langs.ScopeDictionary,
  editor:Langs.EditorState,
  languagePlugins:LanguagePlugins,
  resourceServerUrl:string,
  resources:Array<Langs.Resource>): Promise<{code: Graph.Node, exports: Graph.ExportNode[], resources: Array<Langs.Resource>}>{
  let languagePlugin = languagePlugins[editor.block.language]
  return languagePlugin.bind({ resourceServerUrl:resourceServerUrl, cache:cache, scope:scope, resources:resources }, editor.block);
}

async function bindAllCells(cache:Graph.NodeCache, editors:Langs.EditorState[], languagePlugins:LanguagePlugins, resourceServerUrl:string, stateresources: Array<Langs.Resource>) {
  var scope : Langs.ScopeDictionary = { };
  var newCells : Langs.BlockState[] = []
  let updatedResources: Array<Langs.Resource> = []
  for (var c = 0; c < editors.length; c++) {
    let editor = editors[c]
    let {code, exports, resources} = await bindCell(cache, scope, editor, languagePlugins, resourceServerUrl, updatedResources);
    updatedResources = updatedResources.concat(resources)
    var newCell:Langs.BlockState = { editor:editor, code:code, exports:exports, evaluationState: "unevaluated"}
    for (var e = 0; e < exports.length; e++ ) {
      let exportNode = exports[e];
      scope[exportNode.variableName] = exportNode;
    }
    newCells.push(newCell)
  }
  return {newCells: newCells, updatedResources: updatedResources};
}

async function updateAndBindAllCells (state:NotebookState, cell:Langs.BlockState, newSource: string, resourceServerUrl:string): Promise<NotebookState> {
  Log.trace("binding", "Begin rebinding subsequent cells %O %s", cell, newSource)
  let editors = state.cells.map(c => {
    let lang = state.languagePlugins[c.editor.block.language]
    if (c.editor.id == cell.editor.id) {
      let block = lang.parse(newSource);
      let editor:Langs.EditorState = lang.editor.initialize(c.editor.id, block);
      return editor;
    }
    else return c.editor;
  });
  let {newCells, updatedResources} = await bindAllCells(state.cache, editors, state.languagePlugins, resourceServerUrl, state.resources);
  return { ...state, cells:newCells, resources:updatedResources };
}

async function evaluate(node:Graph.Node, languagePlugins:LanguagePlugins, resourceServerUrl:string, resources:Array<Langs.Resource>, triggerEvalStateEvent) {
  if (node.value && (Object.keys(node.value).length > 0)) return;

  triggerEvalStateEvent(node.hash,"pending")

  for(var ant of node.antecedents) await evaluate(ant, languagePlugins, resourceServerUrl, resources, triggerEvalStateEvent);

  let languagePlugin = languagePlugins[node.language]
  // let source = (<any>node).source ? (<any>node).source.substr(0, 100) + "..." : "(no source)"
  // Log.trace("editor","Evaluating %s node: %s", node.language, source)
  let evalResult = await languagePlugin.evaluate({resourceServerUrl:resourceServerUrl, resources:resources}, node);
  // Log.trace("evaluation","Evaluated %s node. Result: %O", node.language, node.value)
  switch(evalResult.kind) {
    case "success":
      node.value = evalResult.value;
      break;
    case "error":
      node.errors = evalResult.errors;
      break;
  }

  triggerEvalStateEvent(node.hash, "done")
}

// ------------------------------------------------------------------------------------------------
// Render and update functions
// ------------------------------------------------------------------------------------------------

function render(trigger:(evt:NotebookEvent) => void, state:NotebookState) {
  Log.trace("render", "Rendering %d cells", state.cells.length)
  setTimeout(function(){ }, 3000);
  function renderControlsBar() {
    let langs = Object.keys(state.languagePlugins).map(lang =>
      h('a', {
          key:"add-" + lang,
          onclick:()=>trigger({kind:'add', id:-1, language:lang})},
        [ h('i', {'class':'fa fa-plus'}), lang ]))

    let cmds = [
      h('a', {key:"add", onclick:()=>trigger({kind:'toggleadd', id:-1})},[h('i', {'class':'fa fa-plus'}), "add below"]),
    ]

    let tools = state.expandedMenu == -1 ? langs : cmds;
    let controls = h('div', {class:'controls'}, tools)

    return h('div', {id: "controls_default", class:'controls-bar', key:"controls_default"}, [controls])
  }
  
  let defaultControl:VNode = h('div', {id: 'add_default', class:'cell cell-c-default', key: 'add_default'}, [
    renderControlsBar()
  ]);

  let nodes:Array<VNode> = state.cells.map(cell => {
    let context : Langs.EditorContext<any> = {
      trigger: (event:any) =>
        trigger({ kind:'block', id:cell.editor.id, event:event }),
      evaluate: (blockId:number) => 
        trigger({ kind:'evaluate', id:blockId }),
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

    let move = h('div', {class:'move'}, [
      h('i', {
        id:'moveUp_'+cell.editor.id, 
        class: 'fa fa-arrow-up', 
        onclick:()=>{trigger({ kind:'move', cell: cell, direction:"up" })}
      }, []),
      h('i', {
        id:'moveDown_'+cell.editor.id, 
        class: 'fa fa-arrow-down',
        onclick:()=>{trigger({ kind:'move', cell: cell, direction:"down"})}
      }, []),
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
    let controlsBar = h('div', {class:'controls-bar', key:"controls_"+cell.editor.id}, [controls])
    let iconsBar = h('div', {class:'icons-bar', key:"icons_"+cell.editor.id}, [icons, move])
    let contentBar = h('div', {class:'content-bar', key:"content_"+cell.editor.id}, [content])

    let langIndex = Object.keys(state.languagePlugins).indexOf(cell.editor.block.language) % 5;
    return h('div', {class:'cell cell-c' + langIndex, key:cell.editor.id}, [
        iconsBar, contentBar, controlsBar
      ]
    );
  });

  
  return h('div', {class:'container-fluid', id:paperElementID}, [defaultControl, nodes])
}

async function update(trigger:(evt:NotebookEvent) => void,
    state:NotebookState, evt:NotebookEvent) : Promise<NotebookState> {

  Log.trace("main", "Updating with event: %s", evt.kind)
  function spliceEditor (editors:Langs.EditorState[], newEditor: Langs.EditorState, idOfAboveBlock: number) {
    let newEditorState:Langs.EditorState[] = []
    if (idOfAboveBlock > -1) {
      newEditorState = editors.map (editor => {
        if (editor.id === idOfAboveBlock) return [editor, newEditor];
        else return [editor]
      }).reduce ((a,b)=> a.concat(b));
      return newEditorState
    }
    else {
      newEditorState = editors.map (editor => {
        if (editor.id === 0) return [newEditor,editor];
        else return [editor]
      }).reduce ((a,b)=> a.concat(b));
    }
    return newEditorState
  }

  function moveUpEditor (editors: Langs.EditorState[], selectedEditor: Langs.EditorState) {
    let newEditors = editors.map(es => es);
    for(let i = 0; i < editors.length; i++) {
      if (editors[i].id == selectedEditor.id && i != 0) {
        newEditors[i] = editors[i-1];
        newEditors[i-1] = editors[i];
      }
    }
    return newEditors;
  }

  function moveDownEditor (editors: Langs.EditorState[], selectedEditor: Langs.EditorState) {
    let newEditors = editors.map(es => es);
    for(let i = 0; i < editors.length; i++) {
      if (editors[i].id == selectedEditor.id && i != editors.length-1) {
        newEditors[i] = editors[i+1];
        newEditors[i+1] = editors[i];
      }
    }
    return newEditors;
  }

  function removeCell (cells:Langs.BlockState[], idOfSelectedBlock: number) {
    return cells.map (cell => {
        if (cell.editor.id === idOfSelectedBlock) return [];
        else return [cell]
      }).reduce ((a,b)=> a.concat(b));
  }

  switch(evt.kind) {
    case 'block': {
      let newCells:Langs.BlockState[] = state.cells.map(cellState => {
        if (cellState.editor.id != evt.id)
          return cellState
        else {
          var newCell:Langs.BlockState = { editor: state.languagePlugins[cellState.editor.block.language].editor.update(cellState.editor, evt.event),
             code:cellState.code, exports:exports, evaluationState: "unevaluated"}
          return newCell
        }
      })
      return {...state, cells: newCells}
      // return { cache:state.cache, 
      //   counter: state.counter, 
      //   cells: newCells, 
      //   contentChanged:state.contentChanged,
      //   expandedMenu: state.expandedMenu, 
      //   languagePlugins: state.languagePlugins, 
      //   resources: state.resources };
    }

    case 'evalstate':
      let newCells:Langs.BlockState[] = state.cells.map(cellState => {
        if (cellState.code.hash != evt.hash)
          return cellState
        else {
          var newCell:Langs.BlockState = { 
            editor: cellState.editor,
            code:cellState.code, 
            exports:cellState.exports, 
            evaluationState: evt.newState}
          return newCell
        }
      })
      return {...state, cells: newCells}
      // return { cache:state.cache, 
      //   counter: state.counter, 
      //   cells: newCells, 
      //   contentChanged:state.contentChanged,
      //   expandedMenu: state.expandedMenu, 
      //   languagePlugins: state.languagePlugins, 
      //   resources: state.resources };

    case 'toggleadd':
      return {...state, expandedMenu: evt.id};

    case 'move': {
      let newEditors: Langs.EditorState[] = []
      if ((state.cells[0].editor.id == evt.cell.editor.id) && (evt.direction == 'up')) 
        return {...state};

      if ((state.cells[state.cells.length-1].editor.id == evt.cell.editor.id) && (evt.direction == 'down')) 
        return {...state};
      
      if (evt.direction == 'up')
        newEditors = moveUpEditor(state.cells.map(c => c.editor), evt.cell.editor)
      else 
        newEditors = moveDownEditor(state.cells.map(c => c.editor), evt.cell.editor)

      let {newCells, updatedResources} = await bindAllCells(state.cache, newEditors, state.languagePlugins, state.resourceServerUrl, state.resources)
      return {...state, cells: newCells, resources: updatedResources};
    }

    case 'add': {
      Log.trace('main', "Adding cell")
      let newId = state.counter + 1;
      let lang = state.languagePlugins[evt.language];
      let newDocument = { "language": evt.language, "source": lang.getDefaultCode(newId) };
      let newBlock = lang.parse(newDocument.source);
      let editor = lang.editor.initialize(newId, newBlock);
      let newEditors = spliceEditor(state.cells.map(c => c.editor), editor, evt.id)
      Log.trace('main', "Spliced editor: %O", newEditors)      
      let {newCells, updatedResources} = await bindAllCells(state.cache, newEditors, state.languagePlugins, state.resourceServerUrl, state.resources)
      state.resources = state.resources.concat(updatedResources)
      newCells.map(c => {
        Log.trace('main', "New cell: %O", c.editor.block)
      })
      return {...state, counter: newId, expandedMenu:-1, cells: newCells, resources: state.resources}
    }

    case 'remove':
      return {...state, cells: removeCell(state.cells, evt.id) };

    case 'evaluate':
      let triggerEvalStateEvent = (hash, newState) =>
        trigger({kind:'evalstate', hash:hash, newState})
      let doEvaluate = async (block:Langs.BlockState) => {
        await evaluate(block.code, state.languagePlugins, state.resourceServerUrl, state.resources, triggerEvalStateEvent)
        for(var exp of block.exports) await evaluate(exp, state.languagePlugins, state.resourceServerUrl, state.resources, triggerEvalStateEvent)
      }
      let blocks = state.cells.filter(b => b.editor.id == evt.id)
      if (blocks.length > 0) doEvaluate(blocks[0]); 
      else Log.error("main", "Tried to evaluate block that has been removed")
      return state;

    case 'rebind':
      let newState = await updateAndBindAllCells(state, evt.block, evt.newSource, state.resourceServerUrl);
      state.contentChanged(saveDocument(newState))
      Log.trace('jupyter',"This will trigger a render in Jupyter")
      return newState
  }
}

// ------------------------------------------------------------------------------------------------
// Helper functions for creating notebooks
// ------------------------------------------------------------------------------------------------

async function initializeCells(elementID:string, counter: number, editors:Langs.EditorState[],
    languagePlugins:LanguagePlugins, resourceServerUrl:string, contentChanged:(newContent:string) => void) {
  let maquetteProjector = createProjector();
  let paperElement = document.getElementById(elementID);
  paperElementID = elementID;
  Log.trace('main', "Looking for a element %s", paperElementID)
  let elementNotFoundError:string = "Missing paper element: "+elementID
  if (!paperElement) throw elementNotFoundError

  var cache = createNodeCache()
  var resources:Array<Langs.Resource> = []
  var {newCells, updatedResources} = await bindAllCells(cache, editors, languagePlugins, resourceServerUrl, resources);
  resources = updatedResources
  var state : NotebookState = {cache:cache, counter:counter, cells:newCells, resourceServerUrl:resourceServerUrl,
    contentChanged: contentChanged, expandedMenu:-1, languagePlugins:languagePlugins, resources: resources}

  var events : NotebookEvent[] = []
  var handling = false;

  function trigger(event:NotebookEvent) {
    Log.trace("main", "Triggering event: %s", event.kind )
    events.push(event)
    processEvents()
  }

  function processEvents() {
    Log.trace("main", "Processing events (%s). First of kind: %s", 
      events.length, events.length>0?events[0].kind:"N/A")
    if (events.length > 0 && !handling) {
      handling = true;
      let event = events[0]
      events = events.slice(1)
      update(trigger, state, event).then(newState => {
        state = newState
        handling = false;
        state.cells.map(c => Log.trace('main', "Cell: %O ", c.editor.block ))
        if (events.length > 0) processEvents()
        else maquetteProjector.scheduleRender()
      });
    }
  }

  maquetteProjector.replace(paperElement, () => render(trigger, state))
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

export {
  LanguagePlugins, 
  loadNotebook, 
  initializeCells
}
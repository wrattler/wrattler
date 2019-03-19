import * as monaco from 'monaco-editor';
import {h,createProjector,VNode} from 'maquette';
import marked from 'marked';
import * as Langs from '../definitions/languages'; 
import * as Graph from '../definitions/graph'; 
import { Value } from '../definitions/values';
import { Statement } from 'typescript';

// ------------------------------------------------------------------------------------------------
// Markdown plugin
// ------------------------------------------------------------------------------------------------

/// A class that represents a Markdown block. All blocks need to have 
/// `language` and Markdown also keeps the Markdown source we edit and render

class MarkdownBlockKind implements Langs.Block {
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
    initialize: (id:number, block:Langs.Block) => {  
      return { id: id, block: <MarkdownBlockKind>block, editing: false }
    },
  
    update: (state:MarkdownState, event:MarkdownEvent) => {
      switch(event.kind) {
        case 'edit': 
          return { id: state.id, block: state.block, editing: true }
        case 'update': 
          let newBlock = markdownLanguagePlugin.parse(event.source)
          return { id: state.id, block: <MarkdownBlockKind>newBlock, editing: false }
      }
    },
    
  
    render: (cell: Langs.BlockState, state:MarkdownState, context:Langs.EditorContext<MarkdownEvent>) => {
      // The `context` parameter defines `context.trigger` function. We can call this to 
      // trigger events (i.e. `MarkdownEvent` values). When we trigger an event, the main 
      // loop will call our `update` function to get new state of the editor and it will then
      // re-render the editor (we do not need to do any extra work here!)
      state = <MarkdownState>state;
      if (!state.editing) {
        // If we are not in edit mode, we just render a VNode and return no-op handler
        return h('div', {}, [
          h('p', {innerHTML: marked(state.block.source), onclick:() => context.trigger({kind:'edit'})}, ["Edit"]),
          // h('button', { onclick: () => context.trigger({kind:'edit'}) }, ["Edit"])
        ] )
  
      } else {
        let numLines = 0;
        let lastHeight = 75;
        let afterCreateHandler = (el) => { 
          let ed = monaco.editor.create(el, {
            value: state.block.source,
            language: 'markdown',
            scrollBeyondLastLine: false,
            theme:'vs',
            minimap: { enabled: false },
            overviewRulerLanes: 0,
            lineDecorationsWidth: "0ch",
            fontSize: 14,
            fontFamily: 'Roboto Mono',
            lineNumbersMinChars: 2,
            lineHeight: 20,
            lineNumbers: "on",
            scrollbar: {
              verticalHasArrows: true,
              horizontalHasArrows: true,
              vertical: 'none',
              horizontal: 'none'
            }        
          });    
          numLines = ed['viewModel'].lines.lines.length;
  
          let alwaysTrue = ed.createContextKey('alwaysTrue', true);
          let myBinding = ed.addCommand(monaco.KeyCode.Enter | monaco.KeyMod.Shift,function (e) {
            let code = ed.getModel().getValue(monaco.editor.EndOfLinePreference.LF)
            context.trigger({kind: 'update', source: code})
          }, 'alwaysTrue');

          let resizeEditor = () => {
            let lines = ed['viewModel'].lines.lines.length
            let zoneHeight = 0.0 //match previewService with Some ps -> ps.ZoneHeight | _ -> 0.0
            let height = lines > 3 ? lines * 20.0 + zoneHeight : 50;
            // console.log(lines);
            // console.log(height);
            if ((height !== lastHeight) && (height > 75)){
              lastHeight = height
              // console.log(el.clientWidth);
              let width = el.clientWidth
              // let dim:IDimension = {width: el.style.clientWidth, height: height}
              ed.layout({width: width, height: height})
              el.style.height = height+"px";
              el.style.width = width+"px";
              // console.log(el.style.height);
            } 
          }
          ed.getModel().onDidChangeContent(resizeEditor);
          resizeEditor();
          
          // el.setHeight("100px");
        }
        return h('div', {}, [
          // h('div', { style: "height:"+heightRequired+"px", id: "editor_" + state.id.toString(), afterCreate:afterCreateHandler }, [ ])
          h('div', { id: "editor_" + state.id.toString(), afterCreate:afterCreateHandler }, [ ])
        ] )      
      }
    }
  }
  
  export const markdownLanguagePlugin : Langs.LanguagePlugin = {
    language: "markdown",
    editor: markdownEditor,
    parse: (code:string) => {
      return new MarkdownBlockKind(code);
    },
    bind: async (code: Langs.Block) : Promise<Langs.BindingResult> => {
      let node:Graph.Node = {
        language:"markdown", 
        antecedents:[],
        value: null,
        errors: []
      }
      return {code: node, exports: []};
    },
    evaluate: async (node:Graph.Node) : Promise<Langs.EvaluationResult> => {
      return { kind: "success", value: { kind: "nothing" } };
    },
    save: (block:Langs.Block) => {
      let mdBlock:MarkdownBlockKind = <MarkdownBlockKind> block
      return mdBlock.source.concat("\n")
    },
  }

  
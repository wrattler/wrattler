import * as monaco from 'monaco-editor';
import {h,createProjector,VNode} from 'maquette';
import marked from 'marked';
import * as Langs from '../../languages'; 

const s = require('./editor.css');

// ------------------------------------------------------------------------------------------------
// Markdown plugin
// ------------------------------------------------------------------------------------------------

/// A class that represents a Markdown block. All blocks need to have 
/// `language` and Markdown also keeps the Markdown source we edit and render

export class MarkdownBlockKind implements Langs.BlockKind {
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
  
      // The `context` parameter defines `context.trugger` function. We can call this to 
      // trigger events (i.e. `MarkdownEvent` values). When we trigger an event, the main 
      // loop will call our `update` function to get new state of the editor and it will then
      // re-render the editor (we do not need to do any extra work here!)
      if (!state.editing) {
  
        // If we are not in edit mode, we just render a VNode and return no-op handler
        return h('div', [
          h('p', {innerHTML: marked(state.block.source) }, []),
          h('button', { onclick: () => context.trigger({kind:'edit'}) }, ["Edit"])
        ] )
  
      } else {
        let afterCreateHandler = (el) => { 
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
        return h('div', [
          h('div', { style: "height:100px", id: "editor_" + state.id.toString(), afterCreate:afterCreateHandler }, [ ])
        ] )      
      }
    }
  }
  
  export const markdownLanguagePlugin : Langs.LanguagePlugin = {
    language: "markdown",
    editor: markdownEditor,
    parse: (code:string) => {
      return new MarkdownBlockKind(code);
    }
  }
  
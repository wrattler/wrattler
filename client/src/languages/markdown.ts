import * as monaco from 'monaco-editor';
import {h} from 'maquette';
import marked from 'marked';
import * as Langs from '../definitions/languages';
import * as Graph from '../definitions/graph';
import { Md5 } from 'ts-md5';

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

  function createMonaco(el, source, context) {
    let ed = monaco.editor.create(el, {
      value: source,
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
        vertical: 'hidden',
        horizontal: 'hidden'
      }
    });

    ed.createContextKey('alwaysTrue', true);
    ed.addCommand(monaco.KeyCode.Enter | monaco.KeyMod.Shift,function (e) {
      let model = ed.getModel()
      if (model) {
        let code = model.getValue(monaco.editor.EndOfLinePreference.LF)
        context.trigger({kind: 'update', source: code})
      }
    }, 'alwaysTrue');

    return ed;
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

      // Log.trace("main", "Rendering markdown content: %s", JSON.stringify(cell.code) )
      // The `context` parameter defines `context.trigger` function. We can call this to
      // trigger events (i.e. `MarkdownEvent` values). When we trigger an event, the main
      // loop will call our `update` function to get new state of the editor and it will then
      // re-render the editor (we do not need to do any extra work here!)
      state = <MarkdownState>state;

      if (!state.editing) {
        // If we are not in edit mode, we just render a VNode and return no-op handler
        // Log.trace("editor", "Creating Monaco editor for id: %s (code: %s)", cell.editor.id, state.block.source.replace(/[\n\r]/g," ").substr(0,100))
        return h('p', {id: "viewer_" + cell.editor.id.toString(),
            innerHTML: marked(state.block.source),
            onclick:() => context.trigger({kind:'edit'})}, ["Edit"])

      } else {
        let lastHeight = 100;
        let lastWidth = 0
        let afterCreateHandler = (el) => {
          // Log.trace("editor", "Creating Monaco editor for id: %s (code: %s)", el.id, state.block.source.replace(/[\n\r]/g," ").substr(0,100))
          let ed = createMonaco(el, state.block.source, context)
          let resizeEditor = () => {
            let model = ed.getModel()
            if (model) {
              let lines = model.getValue(monaco.editor.EndOfLinePreference.LF, false).split('\n').length
              let height = lines * 20.0;
              let width = el.clientWidth

              if (height !== lastHeight || width !== lastWidth) {
                lastHeight = height
                lastWidth = width
                ed.layout({width:width, height:height})
                el.style.height = height + "px"
              }
            }
          }
          let model = ed.getModel()
          if (model) model.onDidChangeContent(resizeEditor);
          resizeEditor();
        }
        return h('div', { id: "editor_" + cell.editor.id.toString(), afterCreate:afterCreateHandler }, [ ])

      }
    }
  }

  export const markdownLanguagePlugin : Langs.LanguagePlugin = {
    language: "markdown",
    iconClassName: "fa fa-arrow-down",
    editor: markdownEditor,
    getDefaultCode: (id:number) => " ",
    parse: (code:string) => {
      return new MarkdownBlockKind(code);
    },
    bind: async (context: Langs.BindingContext, block: Langs.Block) : Promise<Langs.BindingResult> => {
      let mdBlock:MarkdownBlockKind = <MarkdownBlockKind> block
      let node:Graph.Node = {
        language:"markdown",
        antecedents:[],
        hash:<string>Md5.hashStr(mdBlock.source),
        value: null,
        errors: []
      }
      return {code: node, exports: [], resources:[]};
    },
    evaluate: async (context:Langs.EvaluationContext, node:Graph.Node) : Promise<Langs.EvaluationResult> => {
      return { kind: "success", value: { kind: "nothing" } };
    },
    save: (block:Langs.Block) => {
      let mdBlock:MarkdownBlockKind = <MarkdownBlockKind> block
      return mdBlock.source.concat("\n")
    },
  }

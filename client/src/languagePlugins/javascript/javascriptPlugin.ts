import * as monaco from 'monaco-editor';
import {h,createProjector,VNode} from 'maquette';
import marked from 'marked';
import * as Langs from '../../languages'; 

//const s = require('./editor.css');

// ------------------------------------------------------------------------------------------------
// Markdown plugin
// ------------------------------------------------------------------------------------------------

/// A class that represents a Markdown block. All blocks need to have 
/// `language` and Markdown also keeps the Markdown source we edit and render

class JavascriptBlockKind implements Langs.BlockKind {
    language : string;
    source : string;
    constructor(source:string) {
      this.language = "javascript";
      this.source = source;
    }
  }
  

  interface JavascriptEditEvent { kind:'edit' }
  interface JavascriptUpdateEvent { kind:'update', source:string }
  type JavascriptEvent = JavascriptEditEvent | JavascriptUpdateEvent
  
  type JavascriptState = {
    id: number
    block: JavascriptBlockKind
    editing: boolean
  }

  function evaluate(code)  {
    return eval(code)
  }
  
  const javascriptEditor : Langs.Editor<JavascriptState, JavascriptEvent> = {
    initialize: (id:number, block:Langs.BlockKind) => {  
      return { id: id, block: <JavascriptBlockKind>block, editing: false }
    },
  
    update: (state:JavascriptState, event:JavascriptEvent) => {
      switch(event.kind) {
        case 'edit': 
          console.log("Javascript: Switch to edit mode!")
          return { id: state.id, block: state.block, editing: true }
        case 'update': 
          console.log("Javascript: Set code to:\n%O", event.source);
          let newBlock = javascriptLanguagePlugin.parse(event.source)
          return { id: state.id, block: <JavascriptBlockKind>newBlock, editing: false }
      }
    },
    
  
    render: (state:JavascriptState, context:Langs.EditorContext<JavascriptEvent>) => {

      let lastHeight = 75;
      let results = h('div', {}, [
        h('p', {style: "height:75px; position:relative", innerHTML: evaluate(state.block.source), onclick:() => context.trigger({kind:'edit'})}, ["Edit"]),
      ]);
 
      let afterCreateHandler = (el) => { 
        let ed = monaco.editor.create(el, {
          value: state.block.source,
          language: 'javascript',
          scrollBeyondLastLine: false,
          theme:'vs',
          scrollbar: {
            verticalHasArrows: true,
            horizontalHasArrows: true,
            vertical: 'visible',
            horizontal: 'visible',
            verticalScrollbarSize: 17,
            horizontalScrollbarSize: 17,
            arrowSize: 30
          }
        });    

        let alwaysTrue = ed.createContextKey('alwaysTrue', true);
        let myBinding = ed.addCommand(monaco.KeyCode.Enter | monaco.KeyMod.Shift,function (e) {
          let code = ed.getModel().getValue(monaco.editor.EndOfLinePreference.LF)
          context.trigger({kind: 'update', source: code})
        }, 'alwaysTrue');

        let resizeEditor = () => {
          let lines = ed['viewModel'].lines.lines.length
          let zoneHeight = 0.0 //match previewService with Some ps -> ps.ZoneHeight | _ -> 0.0
          let height = lines > 3 ? lines * 20.0 + zoneHeight : 50;
          if ((height !== lastHeight) && (height > 75)){
            lastHeight = height
            let width = el.clientWidth
            ed.layout({width: width, height: height})
            el.style.height = height+"px";
            el.style.width = width+"px";
          } 
        }
        ed.getModel().onDidChangeContent(resizeEditor);
        resizeEditor();
      }
      let code = h('div', { style: "height:"+lastHeight+"px; padding-top: 20px;", id: "editor_" + state.id.toString(), afterCreate:afterCreateHandler }, [ ])

      console.log(code);
      return h('div', {}, [code, results])
    }
  }
  
  export const javascriptLanguagePlugin : Langs.LanguagePlugin = {
    language: "javascript",
    editor: javascriptEditor,
    parse: (code:string) => {
      return new JavascriptBlockKind(code);
    }
  }
  
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
      // console.log(state)
      
  
      // The `context` parameter defines `context.trugger` function. We can call this to 
      // trigger events (i.e. `MarkdownEvent` values). When we trigger an event, the main 
      // loop will call our `update` function to get new state of the editor and it will then
      // re-render the editor (we do not need to do any extra work here!)
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
            language: 'javascript',
            // scrollBeyondLastLine: false,
            theme:'vs',
            scrollbar: {
              // Subtle shadows to the left & top. Defaults to true.
              useShadows: false,
          
              // Render vertical arrows. Defaults to false.
              verticalHasArrows: true,
              // Render horizontal arrows. Defaults to false.
              horizontalHasArrows: true,
          
              // Render vertical scrollbar.
              // Accepted values: 'auto', 'visible', 'hidden'.
              // Defaults to 'auto'
              vertical: 'visible',
              // Render horizontal scrollbar.
              // Accepted values: 'auto', 'visible', 'hidden'.
              // Defaults to 'auto'
              horizontal: 'visible',
          
              verticalScrollbarSize: 17,
              horizontalScrollbarSize: 17,
              arrowSize: 30
            }
          });    
          numLines = ed['viewModel'].lines.lines.length;
          console.log(numLines);
  
          let alwaysTrue = ed.createContextKey('alwaysTrue', true);
          let myBinding = ed.addCommand(monaco.KeyCode.Enter | monaco.KeyMod.Shift,function (e) {
            let code = ed.getModel().getValue(monaco.editor.EndOfLinePreference.LF)
            context.trigger({kind: 'update', source: code})
          }, 'alwaysTrue');

          let resizeEditor = () => {
            console.log("changed");
            let lines = ed['viewModel'].lines.lines.length
            let zoneHeight = 0.0 //match previewService with Some ps -> ps.ZoneHeight | _ -> 0.0
            let height = lines > 3 ? lines * 20.0 + zoneHeight : 50;
            console.log(lines);
            console.log(height);
            if ((height !== lastHeight) && (height > 75)){
              lastHeight = height
              console.log(el.clientWidth);
              let width = el.clientWidth
              // let dim:IDimension = {width: el.style.clientWidth, height: height}
              ed.layout({width: width, height: height})
              el.style.height = height+"px";
              el.style.width = width+"px";
              console.log(el.style.height);
            } 
          }
          ed.getModel().onDidChangeContent(resizeEditor);
          resizeEditor();

          // el.setHeight("100px");
        }
        return h('div', {}, [
          // h('div', { style: "height:"+heightRequired+"px", id: "editor_" + state.id.toString(), afterCreate:afterCreateHandler }, [ ])
          h('div', { style: "height:75px", id: "editor_" + state.id.toString(), afterCreate:afterCreateHandler }, [ ])
        ] )      
      }
    }
  }
  
  export const javascriptLanguagePlugin : Langs.LanguagePlugin = {
    language: "javascript",
    editor: javascriptEditor,
    parse: (code:string) => {
        // let x = 1;
        // let res = eval("x*2");
        // console.log(res)
        // return new JavascriptBlockKind(""+res);
        console.log(code);
      return new JavascriptBlockKind(code);
    }
  }
  
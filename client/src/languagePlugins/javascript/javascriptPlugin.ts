import * as monaco from 'monaco-editor';
import {h,createProjector,VNode} from 'maquette';
// import marked from 'marked';
import * as Langs from '../../languages'; 
import * as Graph from '../../graph'; 

const ts = require('typescript');

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
  
// this is test code
  function getAbstractTree(source: string) {
    let tsSourceFile = ts.createSourceFile(
      __filename,
      source,
      ts.ScriptTarget.Latest
    );
  
    console.log(tsSourceFile.statements);
    let tree = [];
    for (var n=0; n < tsSourceFile.statements.length; n++){
      let node = tsSourceFile.statements[n];
      // console.log(node)
      switch (node.kind) {
        case 212: {
            tree.push({
              kind: 212,
              name: node.declarationList.declarations[0].name,
              initializer: node.declarationList.declarations[0].initializer
            });
          break
        }
        case 214: {
          tree.push({
            kind: 214,
            expression: node.expression});
          break;
        }
      }
    }
    return tree;
  }
  // getAbstractTree("let x = 1; let y = 2");

// end test code
  interface JavascriptEditEvent { kind:'edit' }
  interface JavascriptUpdateEvent { kind:'update', source:string }
  type JavascriptEvent = JavascriptEditEvent | JavascriptUpdateEvent
  
  type JavascriptState = {
    id: number
    block: JavascriptBlockKind
    editing: boolean
  }

  function evaluate(code)  {
    // return eval(code)
    return code
  }
  
  const javascriptEditor : Langs.Editor<JavascriptState, JavascriptEvent> = {
    initialize: (id:number, block:Langs.BlockKind) => {  
      return { id: id, block: <JavascriptBlockKind>block, editing: false }
    },
  
    update: (state:JavascriptState, event:JavascriptEvent) => {
      switch(event.kind) {
        case 'edit': 
          // console.log("Javascript: Switch to edit mode!")
          return { id: state.id, block: state.block, editing: true }
        case 'update': 
          // console.log("Javascript: Set code to:\n%O", event.source);
          let newBlock = javascriptLanguagePlugin.parse(event.source)
          return { id: state.id, block: <JavascriptBlockKind>newBlock, editing: false }
      }
    },

    render: (state:JavascriptState, context:Langs.EditorContext<JavascriptEvent>) => {

      let lastHeight = 75;
      console.log(state)
      console.log(context)
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
          if ((height !== lastHeight) && (height > lastHeight)){
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

      // console.log(code);
      return h('div', {}, [code, results])
    }
  }
  
  function tokenizeStatement (argument:any, node:Graph.JsCodeNode, scopeDictionary:{}) {
    if (argument != undefined) {
      if (argument.expression != undefined){
        tokenizeStatement(argument.expression.left, node, scopeDictionary)
        tokenizeStatement(argument.expression.right, node, scopeDictionary)
      }
      else {
        let argumentName = argument.text
        if (argumentName in scopeDictionary) {
          let antecedentNode = scopeDictionary[argumentName]
          node.antecedents.push(antecedentNode);
        }
      }
    }
  }

  export const javascriptLanguagePlugin : Langs.LanguagePlugin = {
    language: "javascript",
    editor: javascriptEditor,
    parse: (code:string) => {
      return new JavascriptBlockKind(code);
    },
    bind: (scopeDictionary: {}, block: Langs.BlockKind) => {
      let jsBlock = <JavascriptBlockKind>block
      let tree = getAbstractTree(jsBlock.source);
      let dependencies:Graph.JsExportNode[] = [];
      let node:Graph.JsCodeNode = {
        language:"javascript", 
        antecedents:[],
        value: undefined,
        code: jsBlock.source
      }
      for (var s = 0; s < tree.length; s++) {
        let statement = tree[s];
        if (statement.kind == 212){
          let name = statement.name.escapedText
          let exportNode = {
            variableName: name,
            value: undefined,
            language:"javascript",
            code: node, 
            antecedents:[node]
            };
          dependencies.push(exportNode);
          scopeDictionary[exportNode.variableName] = exportNode;
          tokenizeStatement(statement.initializer.left, node, scopeDictionary)
          tokenizeStatement(statement.initializer.right, node, scopeDictionary)
        }
      }
      return {code: node, exports: dependencies}
    }
  }

  
import * as monaco from 'monaco-editor';
import {h,createProjector,VNode} from 'maquette';
import marked from 'marked';
import * as Langs from '../../languages'; 
import * as Graph from '../../graph'; 
const ts = require("typescript");

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
  
    // console.log(tsSourceFile.statements);
    let tree = [];
    for (var n=0; n < tsSourceFile.statements.length; n++){
      let node = tsSourceFile.statements[n];
      // console.log(node)
      switch (node.kind) {
        case 212: {
          // tree.push({ 
          //   kind:212,
          //   name: node.declarationList.declarations[0].name.escapedText, 
          //   // value:node.declarationList.declarations[0].initializer.text
          // })
            tree.push({
              kind: 212,
              name: node.declarationList.declarations[0].name,
              initializer: node.declarationList.declarations[0].initializer
            });
            // console.log("variable name:"+node.declarationList.declarations[0].name.escapedText);
          break
        }
        case 214: {
          // tree.push({ 
          //   kind:214,
          //   name: node.expression.escapedText, 
          //   // value:undefined
          //   })
          tree.push({
            kind: 214,
            expression: node.expression});
          // console.log("expression name:"+node.expression.escapedText)
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
          if (statement.initializer.left != undefined) {
            let left = statement.initializer.left;
            let leftName = left.text
            if (leftName in scopeDictionary) {
              let antecedentNode = scopeDictionary[leftName]
              node.antecedents.push(antecedentNode);
            }
            let right = statement.initializer.right;
            let rightName = right.text;
            if (rightName in scopeDictionary) {
              let antecedentNode = scopeDictionary[rightName]
              node.antecedents.push(antecedentNode);
            }
          }
        }
        // if (statement.kind == 214) {
        //   let expression = statement.expression;
        //   let name = expression.escapedText
        //   if (name in scopeDictionary)
        //   {
        //     let antecedentNode = scopeDictionary[name]
        //     // console.log(antecedentNode)
        //     let exportNode = {
        //       variableName: name,
        //       value: undefined,
        //       language:"javascript",
        //       code: node, 
        //       antecedents:[antecedentNode]
        //       };
        //   } 
        // }
      }
      return {code: node, exports: dependencies}
      // for (var s = 0; s < tree.length; s++) {
      //   let statement = tree[s];
      //   if (statement.kind == 212){
      //     let name = statement.name.escapedText
      //     // let value = statement.initializer.text
      //     let exportNode = {
      //       variableName: name,
      //       value: undefined,
      //       language:"javascript",
      //       code: node, 
      //       antecedents:[node]
      //       };
      //     dependencies.push(exportNode);
      //     scopeDictionary[exportNode.variableName] = exportNode.value;

      //     while (statement.initializer.left != undefined) {
      //       let left = statement.initializer.left
      //       if (left.kind == 189){
      //         if (left.expression)
      //       }
      //     }
      //   }
      // }
      
    }
  }


  // const javascriptExportPlugin : Graph.JsExportNode = {
  //   language: "javascript",
  //   variableName: "",
  //   code: {language:"javascript"},
  //   dependencies:[],
  //   initialize: (variableName: string, code: string) => {  
  //     let tree = getAbstractTree(code);
  //     let dependencies = [];
  //     for (var s = 0; s < tree.length; s++) {
  //       let statement = tree[s];
  //       console.log(statement);
  //       if (statement.kind == 212){
  //         let newNode = {language:"javascript"};
  //         dependencies.push(newNode);
  //       }
  //     }
  //     let newNode = { language: "javascript", variableName: variableName, code: code, dependencies: dependencies }
  //     return newNode
  //   },
  // }

  
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

class JavascriptBlockKind implements Langs.Block {
    language : string;
    source : string;
    constructor(source:string) {
      this.language = "javascript";
      this.source = source;
    }
  }
  
  
  function getCodeExports(scopeDictionary: {}, source: string): Promise<{code: Graph.Node, exports: Graph.ExportNode[]}> {
    return new Promise<{code: Graph.Node, exports: Graph.ExportNode[]}>(resolve => {
      let tsSourceFile = ts.createSourceFile(
        __filename,
        source,
        ts.ScriptTarget.Latest
      );
      // let tree = [];

      let dependencies:Graph.JsExportNode[] = [];
      let node:Graph.JsCodeNode = {
        language:"javascript", 
        antecedents:[],
        exportedVariables:[],
        kind: 'code',
        value: undefined,
        source: source
      }

      let walk = function (expr) {
        ts.forEachChild(expr, function(child) 
        { 
          if (child.kind == ts.SyntaxKind.VariableStatement) {
            let name = child.declarationList.declarations[0].name.escapedText
            let exportNode:Graph.JsExportNode = {
              variableName: name,
              value: undefined,
              language:"javascript",
              code: node, 
              kind: 'export',
              antecedents:[node]
              };
            dependencies.push(exportNode);
            node.exportedVariables.push(exportNode.variableName);
          }

          if (child.constructor.name === 'IdentifierObject') {
            let argumentName = child.escapedText;
            if (argumentName in scopeDictionary) {
              let antecedentNode = scopeDictionary[argumentName]
              if (node.antecedents.indexOf(antecedentNode) == -1)
                node.antecedents.push(antecedentNode);
            }
          }
          walk(child)
        })
      }

      walk(tsSourceFile);
      resolve({code: node, exports: dependencies});
    });
  }

  interface JavascriptEditEvent { kind:'edit' }
  interface JavascriptUpdateEvent { kind:'update', source:string }
  // interface JavascriptRebindEvent { kind:'rebindSubsequent'}
  type JavascriptEvent = JavascriptEditEvent | JavascriptUpdateEvent 
  
  type JavascriptState = {
    id: number
    block: JavascriptBlockKind
  }
  
  const javascriptEditor : Langs.Editor<JavascriptState, JavascriptEvent> = {
    initialize: (id:number, block:Langs.Block) => {  
      return { id: id, block: <JavascriptBlockKind>block}
    },
  
    update: (state:JavascriptState, event:JavascriptEvent) => {
      switch(event.kind) {
        case 'edit': 
          // console.log("Javascript: Switch to edit mode!")
          return { id: state.id, block: state.block }
        case 'update': 
          // console.log("Javascript: Set code to:\n%O", event.source);
          let newBlock = javascriptLanguagePlugin.parse(event.source)
          return { id: state.id, block: <JavascriptBlockKind>newBlock }
      }
    },

    render: (cell: Langs.BlockState, state:JavascriptState, context:Langs.EditorContext<JavascriptEvent>) => {
      let evalButton = h('button', { onclick:() => context.evaluate(cell) }, ["Evaluate"])
      // console.log(cell)
      // function display() {
      //   if (cell.code == undefined)
      //     if (cell.code == undefined)
      // }
      let results = h('div', {}, [
        h('p', {
            style: "height:75px; position:relative", 
            onclick:() => context.trigger({kind:'edit'})
          }, 
          [ ((cell.code==undefined)||(cell.code.value==undefined)) ? evalButton : ("Value is: " + JSON.stringify(cell.code.value)) ]),
          // [ cell.code==undefined ? evalButton : ("Value is: ") ]),
      ]);
 
      let afterCreateHandler = (el) => { 
        let ed = monaco.editor.create(el, {
          value: state.block.source,
          language: 'javascript',
          scrollBeyondLastLine: false,
          theme:'vs',
          minimap: { enabled: false },
          overviewRulerLanes: 0,
          lineDecorationsWidth: "0ch",
          fontSize: 14,
          fontFamily: 'Monaco',
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

        ed.createContextKey('alwaysTrue', true);

        ed.addCommand(monaco.KeyCode.Enter | monaco.KeyMod.Shift,function (e) {
          let code = ed.getModel().getValue(monaco.editor.EndOfLinePreference.LF)
          // let codeNode = <Graph.JsCodeNode> cell.code;
          // codeNode.source = code;
          // console.log(cell);
          context.rebindSubsequent(cell, code)
        }, 'alwaysTrue');

        let lastHeight = 100;
        let lastWidth = 0
        let resizeEditor = () => {
          let lines = ed.getModel().getValue(monaco.editor.EndOfLinePreference.LF, false).split('\n').length
          let height = lines > 4 ? lines * 20.0 : 80;
          let width = el.clientWidth

          if (height !== lastHeight || width !== lastWidth) {
            lastHeight = height
            lastWidth = width  
            ed.layout({width:width, height:height})
            el.style.height = height + "px"
          }
        }
        ed.getModel().onDidChangeContent(resizeEditor);
        window.addEventListener("resize", resizeEditor)
        setTimeout(resizeEditor, 100)
      }
      let code = h('div', { style: "height:100px; margin:20px 0px 10px 0px;", id: "editor_" + cell.editor.id.toString(), afterCreate:afterCreateHandler }, [ ])
      return h('div', { }, [code, results])
    },
  }

  export const javascriptLanguagePlugin : Langs.LanguagePlugin = {
    language: "javascript",
    editor: javascriptEditor,
    evaluate: (node:Graph.Node) => {
      let jsnode = <Graph.JsNode>node
      let value = "yadda";
      let returnArgs = "{";
      let evalCode = "";

      async function getValue() {
        return new Promise<any>(resolve => {
          let jsCodeNode = <Graph.JsCodeNode>node
          for (var e = 0; e < jsCodeNode.exportedVariables.length; e++) {
            returnArgs= returnArgs.concat(jsCodeNode.exportedVariables[e]+":"+jsCodeNode.exportedVariables[e]+",");
          }
          returnArgs = returnArgs.concat("}")
          let importedVars = "";
          var argDictionary:{[key: string]: string} = {}
          for (var i = 0; i < jsCodeNode.antecedents.length; i++) {
            let imported = <Graph.JsExportNode>jsCodeNode.antecedents[i]
            argDictionary[imported.variableName] = imported.value;
            importedVars = importedVars.concat("\nlet "+imported.variableName + " = args[\""+imported.variableName+"\"];");
          }
          evalCode = "function f(args) {\n\t "+ importedVars + "\n"+jsCodeNode.source +"\n\t return "+returnArgs+"\n}; f(argDictionary)"
          console.log(evalCode)
          value = eval(evalCode);
          console.log(value);
          resolve(value);
        })
      }
      switch(jsnode.kind) {
        case 'code': 
          return getValue();
        case 'export':
          let jsExportNode = <Graph.JsExportNode>node
          let exportNodeName= jsExportNode.variableName;
          value = jsExportNode.code.value[exportNodeName]
          return value
          // console.log(value);
          // break;
      }
      // return value
    },
    parse: (code:string) => {
      console.log(code);
      return new JavascriptBlockKind(code);
    },
    bind: (scopeDictionary: {}, block: Langs.Block) => {
      let jsBlock = <JavascriptBlockKind>block
      return getCodeExports(scopeDictionary, jsBlock.source);
    }
  }

  
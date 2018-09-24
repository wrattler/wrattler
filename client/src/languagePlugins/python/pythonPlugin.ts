import * as monaco from 'monaco-editor';
import {h,createProjector,VNode} from 'maquette';
import * as Langs from '../../languages'; 
import * as Graph from '../../graph'; 
import {Md5} from 'ts-md5/dist/md5';

const ts = require('typescript');
const axios = require('axios');

declare var PYTHONSERVICE_URI: string;
declare var DATASTORE_URI: string;

// ------------------------------------------------------------------------------------------------
// Python plugin
// ------------------------------------------------------------------------------------------------

/// A class that represents a Python block. All blocks need to have 
/// `language` and Python also keeps the Python source we edit and render

class PythonBlockKind implements Langs.Block {
    language : string;
    source : string;
    constructor(source:string) {
      this.language = "python";
      this.source = source;
    }
	}
	
	function getCodeExports(scopeDictionary: {}, source: string): Promise<{code: Graph.Node, exports: Graph.ExportNode[]}> {
    return new Promise<{code: Graph.Node, exports: Graph.ExportNode[]}>(resolve => {
      let dependencies:Graph.JsExportNode[] = [];
      let node:Graph.JsCodeNode = {
        language:"python", 
        antecedents:[],
        exportedVariables:[],
        kind: 'code',
        value: undefined,
        source: source
      }
      resolve({code: node, exports: dependencies});
      // return new Promise<{code: Graph.Node, exports: Graph.ExportNode[]}>(resolve => {
      //   setTimeout(() => {
      //     resolve({code: node, exports: dependencies});
      //   }, 0);
      // });
    });
  }
  
  interface PythonEditEvent { kind:'edit' }
  interface PythonUpdateEvent { kind:'update', source:string }
  type PythonEvent = PythonEditEvent | PythonUpdateEvent
  
  type PythonState = {
    id: number
    block: PythonBlockKind
  }
  
  const pythonEditor : Langs.Editor<PythonState, PythonEvent> = {
    initialize: (id:number, block:Langs.Block) => {  
      return { id: id, block: <PythonBlockKind>block}
    },
  
    update: (state:PythonState, event:PythonEvent) => {
      switch(event.kind) {
        case 'edit': 
          // console.log("Python: Switch to edit mode!")
          return { id: state.id, block: state.block }
        case 'update': 
          // console.log("Python: Set code to:\n%O", event.source);
          let newBlock = pythonLanguagePlugin.parse(event.source)
          return { id: state.id, block: <PythonBlockKind>newBlock}
      }
    },

    render: (cell: Langs.BlockState, state:PythonState, context:Langs.EditorContext<PythonEvent>) => {
      let evalButton = h('button', { onclick:() => context.evaluate(cell) }, ["Evaluate"])
      let results = h('div', {}, [
        h('p', {
            style: "height:75px; position:relative", 
            onclick:() => context.trigger({kind:'edit'})
          }, 
          [ ((cell.code==undefined)||(cell.code.value==undefined)) ? evalButton : ("Value is: " + JSON.stringify(cell.code.value)) ]),
      ]);
 
      let afterCreateHandler = (el) => { 
        let ed = monaco.editor.create(el, {
          value: state.block.source,
          language: 'python',
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
          context.trigger({kind: 'update', source: code})
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
    }
  }

  export const pythonLanguagePlugin : Langs.LanguagePlugin = {
    language: "python",
    editor: pythonEditor,
    evaluate: (node:Graph.Node) => {
      let pyNode = <Graph.PyNode>node

      async function getValue(blob) {
        var pathname = new URL(blob).pathname;
        let headers = {'Content-Type': 'application/json'}
        let url = DATASTORE_URI.concat(pathname)
        try {
          const response = await axios.get(url, headers);
          return response.data
        }
        catch (error) {
          console.error(error);
        }
      }

      async function getEval(body) {
        let url = PYTHONSERVICE_URI.concat("/eval")
        let headers = {'Content-Type': 'application/json'}
        try {
          const response = await axios.post(url, body, headers);
          var results = {}
          for(var df of response.data) results[df.name] = await getValue(df.url)
          return results;
        }
        catch (error) {
          console.error(error);
        }
      }

      switch(pyNode.kind) {
        case 'code': 
          let hash = Md5.hashStr(pyNode.source)
			    let body = {"code": pyNode.source,
									"hash": hash,
									"frames": {}}
          return getEval(body);

        case 'export':
          let pyExportNode = <Graph.PyExportNode>node
          let exportNodeName= pyExportNode.variableName;
          var value = pyExportNode.code.value[exportNodeName]
          return value
      }
    },
    parse: (code:string) => {
      return new PythonBlockKind(code);
    },
    bind: (scopeDictionary: {}, block: Langs.Block) => {
			let pyBlock = <PythonBlockKind>block
			// return getCodeExports(scopeDictionary, pyBlock.source)
      let dependencies:Graph.PyExportNode[] = [];
      let node:Graph.PyCodeNode = {
        language:"python", 
        antecedents:[],
        exportedVariables:[],
        kind: 'code',
        value: undefined,
        source: pyBlock.source
			}
			
			let url = PYTHONSERVICE_URI.concat("/exports")
      let hash = Md5.hashStr(pyBlock.source)
      
      // let hash = "Md5.hashStr(pyBlock.source)"
			let body = {"code": pyBlock.source,
									"hash": hash,
									"frames": Object.keys(scopeDictionary)
								}
			let headers = {'Content-Type': 'application/json'}
			async function getExports() {
				try {
					const response = await axios.post(url,body, headers);
					console.log(response.data.exports)
					console.log(response.data.imports)
					for (var n = 0 ; n < response.data.exports.length; n++) {
						// console.log(response.data.exports[n]);
						let exportNode:Graph.PyExportNode = {
							variableName: response.data.exports[n],
							value: undefined,
							language:"python",
							code: node, 
							kind: 'export',
							antecedents:[node]
							};
						dependencies.push(exportNode) 
						node.exportedVariables.push(exportNode.variableName)
						console.log(node);
					}
					for (var n = 0 ; n < response.data.imports.length; n++) {
						if (response.data.imports[n] in scopeDictionary) {
							let antecedentNode = scopeDictionary[response.data.imports[n]]
							node.antecedents.push(antecedentNode);
						}
					}
					return {code: node, exports: dependencies};
				} catch (error) {
					console.error(error);
				}
			}
			return getExports()
    }
  }
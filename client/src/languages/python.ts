import * as monaco from 'monaco-editor';
import {h} from 'maquette';
import * as Langs from '../definitions/languages'; 
import * as Graph from '../definitions/graph'; 
import * as Values from '../definitions/values'; 
import {printPreview} from '../editors/preview'; 
import {Md5} from 'ts-md5';
import axios from 'axios';

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

	interface PythonSwitchTabEvent {
		kind: "switchtab"
		index: number
	}

	type PythonEvent = PythonSwitchTabEvent 
	
	type PythonState = {
		id: number
		block: PythonBlockKind
		tabID: number
	}


	const pythonEditor : Langs.Editor<PythonState, PythonEvent> = {
		
		initialize: (id:number, block:Langs.Block) => {  
			return { id: id, block: <PythonBlockKind>block, tabID: 0}
		},
	
		update: (state:PythonState, event:PythonEvent) => {
			switch(event.kind) {
				case 'switchtab':
				{
					return { id: state.id, block: state.block, tabID: event.index }
				}
			}
			return state	
		},

		render: (cell: Langs.BlockState, state:PythonState, context:Langs.EditorContext<PythonEvent>) => {
			let previewButton = h('button', { onclick:() => context.evaluate(cell) }, ["Preview"])
			let triggerSelect = t => context.trigger({kind:'switchtab', index: t})
      let preview = h('div', {}, [(cell.code.value==undefined) ? previewButton : (printPreview(triggerSelect, state.tabID, cell.code.value))]);
 
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
			return h('div', { }, [code, preview])
		}
	}

  export const pythonLanguagePlugin : Langs.LanguagePlugin = {
    language: "python",
    editor: pythonEditor,
    evaluate: async (node:Graph.Node) : Promise<Values.Value> => {
      let pyNode = <Graph.PyNode>node

      async function getValue(blob) : Promise<Values.Value> {
        var pathname = new URL(blob).pathname;
        let headers = {'Content-Type': 'application/json'}
        let url = DATASTORE_URI.concat(pathname)
        try {
          const response = await axios.get(url, {headers: headers});
          console.log(response)
          return response.data
        }
        catch (error) {
          console.error(error);
        }
      }

      async function getEval(body) : Promise<Values.ExportsValue> {
        let url = PYTHONSERVICE_URI.concat("/eval")
        let headers = {'Content-Type': 'application/json'}
        try {
          const response = await axios.post(url, body, {headers: headers});
          var results : Values.ExportsValue = {}
          for(var df of response.data.frames) 
            // results[df.name] = await getValue(df.url)
            results[df.name] = {url: df.url, data: await getValue(df.url)}
          return results;
        }
        catch (error) {
          console.error(error);
        }
      }

      switch(pyNode.kind) {
        case 'code': 
          let importedFrames : { name:string, url:string }[] = [];
          for (var ant of pyNode.antecedents) {
            let imported = <Graph.ExportNode>ant
            // console.log(imported);
            // console.log(imported.value.data);
            importedFrames.push({ name: imported.variableName, url: (<Values.DataFrame>imported.value).url })
          }

					console.log(importedFrames);
					let src = pyNode.source
					console.log(src)
					let hash = Md5.hashStr(src)
					let body = {"code": src,
									"hash": hash,
									"frames": importedFrames}
					return await getEval(body);

        case 'export':
          let pyExportNode = <Graph.PyExportNode>node
          let exportNodeName= pyExportNode.variableName
          let exportsValue = <Values.ExportsValue>pyExportNode.code.value
          return exportsValue[exportNodeName]
      }
    },
    parse: (code:string) => {
      return new PythonBlockKind(code);
    },
    bind: (scopeDictionary: Langs.ScopeDictionary, block: Langs.Block) => {
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
					const response = await axios.post(url, body, {headers: headers});
					// console.log(response.data.exports)
					// console.log(response.data.imports)
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
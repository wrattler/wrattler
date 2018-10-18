import {h} from 'maquette';
import * as Langs from '../definitions/languages'; 
import * as Graph from '../definitions/graph'; 
import * as Values from '../definitions/values'; 
import {printPreview} from '../editors/preview'; 
import {createEditor} from '../editors/editor';
import {Md5} from 'ts-md5';
import axios from 'axios';

// declare var PYTHONSERVICE_URI: string;
// declare var RSERVICE_URI: string;
declare var DATASTORE_URI: string;

// ------------------------------------------------------------------------------------------------
// rPython plugin
// ------------------------------------------------------------------------------------------------

/// A class that represents a Python block. All blocks need to have 
/// `language` and Python also keeps the Python source we edit and render

type languageType = "python" | "r"

export class rPythonBlockKind implements Langs.Block {
		language : string;
		source : string;
		constructor(source:string, language: string) {
			this.language = language;
			this.source = source;
		}
	}

export interface rPythonSwitchTabEvent {
	kind: "switchtab"
	index: number
}

export type rPythonEvent = rPythonSwitchTabEvent 

export type rPythonState = {
	id: number
	block: rPythonBlockKind
	tabID: number
}


export const rPythonEditor : Langs.Editor<rPythonState, rPythonEvent> = {
	
	initialize: (id:number, block:Langs.Block) => {  
		return { id: id, block: <rPythonBlockKind>block, tabID: 0}
	},

	update: (state:rPythonState, event:rPythonEvent) => {
		switch(event.kind) {
			case 'switchtab':
			{
				return { id: state.id, block: state.block, tabID: event.index }
			}
		}
		return state	
	},

	render: (cell: Langs.BlockState, state:rPythonState, context:Langs.EditorContext<rPythonEvent>) => {
		let previewButton = h('button', { onclick:() => context.evaluate(cell) }, ["Preview"])
		let triggerSelect = (t:number) => context.trigger({kind:'switchtab', index: t})
	let preview = h('div', {}, [(cell.code.value==undefined) ? previewButton : (printPreview(triggerSelect, state.tabID, <Values.DataFrame>cell.code.value))]);
		let code = createEditor("python", state.block.source, cell, context)
		return h('div', { }, [code, preview])
	}
}

export class apiPlugin implements Langs.LanguagePlugin {
	readonly language: string;
	readonly editor: Langs.Editor<rPythonState, rPythonEvent>;
	readonly serviceURI: string;

	constructor(l: string, uri: string) {
		this.language = l;
		this.serviceURI = uri;
		this.editor = rPythonEditor;
	}

	async evaluate(node:Graph.Node) : Promise<Values.Value> {
		let pyNode = <Graph.PyNode>node
	
		async function getValue(blob) : Promise<Values.Value> {
			var pathname = new URL(blob).pathname;
			let headers = {'Content-Type': 'application/json'}
			let url = DATASTORE_URI.concat(pathname)
			try {
				const response = await axios.get(url, {headers: headers});
				return response.data
			}
			catch (error) {
				console.error(error);
			}
		}
	
		async function getEval(body, serviceURI) : Promise<Values.ExportsValue> {
			let url = serviceURI.concat("/eval")
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
						let src = pyNode.source
						let hash = Md5.hashStr(src)
						let body = {"code": src,
										"hash": hash,
										"frames": importedFrames}
						return await getEval(body, this.serviceURI);
			case 'export':
				let pyExportNode = <Graph.PyExportNode>node
				let exportNodeName= pyExportNode.variableName
				let exportsValue = <Values.ExportsValue>pyExportNode.code.value
				return exportsValue[exportNodeName]
			}
	}

	parse (code:string) {	
		return new rPythonBlockKind(code, this.language);
	}

	bind (scopeDictionary: Langs.ScopeDictionary, block: Langs.Block) {
			let pyBlock = <rPythonBlockKind>block
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
			
			let url = this.serviceURI.concat("/exports")
			let hash = Md5.hashStr(pyBlock.source)
			
			// let hash = "Md5.hashStr(pyBlock.source)"
			let body = {"code": pyBlock.source,
									"hash": hash,
									"frames": Object.keys(scopeDictionary)
								}
			let headers = {'Content-Type': 'application/json'}
			async function getExports() {
				try {
					console.log(headers)
					console.log(body)
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

// export const rPythonLanguagePlugin : Langs.LanguagePlugin = {
// language: "",
// editor: pythonEditor,
// serviceURI: "",

// setLanguageURI: (language: string, uri: string) => {
// 	this.language = language;
// 	this.serviceURI = uri;
// 	console.log(this.serviceURI);
// }, 
// evaluate: async (node:Graph.Node) : Promise<Values.Value> => {
// 	let pyNode = <Graph.PyNode>node

// 	async function getValue(blob) : Promise<Values.Value> {
// 	var pathname = new URL(blob).pathname;
// 	let headers = {'Content-Type': 'application/json'}
// 	let url = DATASTORE_URI.concat(pathname)
// 	try {
// 		const response = await axios.get(url, {headers: headers});
// 		console.log(response)
// 		return response.data
// 	}
// 	catch (error) {
// 		console.error(error);
// 	}
// 	}

// 	async function getEval(body) : Promise<Values.ExportsValue> {
// 		console.log(serviceURI)
// 		let url = this.serviceURI.concat("/eval")
// 		let headers = {'Content-Type': 'application/json'}
// 		try {
// 			const response = await axios.post(url, body, {headers: headers});
// 			var results : Values.ExportsValue = {}
// 			for(var df of response.data.frames) 
// 			// results[df.name] = await getValue(df.url)
// 			results[df.name] = {url: df.url, data: await getValue(df.url)}
// 			return results;
// 		}
// 		catch (error) {
// 			console.error(error);
// 		}
// 	}

// 	switch(pyNode.kind) {
// 		case 'code': 
// 			let importedFrames : { name:string, url:string }[] = [];
// 			for (var ant of pyNode.antecedents) {
// 			let imported = <Graph.ExportNode>ant
// 			// console.log(imported);
// 			// console.log(imported.value.data);
// 			importedFrames.push({ name: imported.variableName, url: (<Values.DataFrame>imported.value).url })
// 			}

// 					console.log(importedFrames);
// 					let src = pyNode.source
// 					console.log(src)
// 					let hash = Md5.hashStr(src)
// 					let body = {"code": src,
// 									"hash": hash,
// 									"frames": importedFrames}
// 					return await getEval(body);

// 		case 'export':
// 			let pyExportNode = <Graph.PyExportNode>node
// 			let exportNodeName= pyExportNode.variableName
// 			let exportsValue = <Values.ExportsValue>pyExportNode.code.value
// 			return exportsValue[exportNodeName]
// 		}
// },
// parse: (code:string) => {
// 	console.log(this.language);
// 	return new rPythonBlockKind(code, this.language);
// },
// bind: (scopeDictionary: Langs.ScopeDictionary, block: Langs.Block) => {
// 		let pyBlock = <rPythonBlockKind>block
// 		// return getCodeExports(scopeDictionary, pyBlock.source)
// 		let dependencies:Graph.PyExportNode[] = [];
// 		let node:Graph.PyCodeNode = {
// 			language:"python", 
// 			antecedents:[],
// 			exportedVariables:[],
// 			kind: 'code',
// 			value: undefined,
// 			source: pyBlock.source
// 		}
		
// 		let url = this.serviceURI.concat("/exports")
// 		let hash = Md5.hashStr(pyBlock.source)
		
// 		// let hash = "Md5.hashStr(pyBlock.source)"
// 		let body = {"code": pyBlock.source,
// 								"hash": hash,
// 								"frames": Object.keys(scopeDictionary)
// 							}
// 		let headers = {'Content-Type': 'application/json'}
// 		async function getExports() {
// 			try {
// 				const response = await axios.post(url, body, {headers: headers});
// 				// console.log(response.data.exports)
// 				// console.log(response.data.imports)
// 				for (var n = 0 ; n < response.data.exports.length; n++) {
// 					// console.log(response.data.exports[n]);
// 					let exportNode:Graph.PyExportNode = {
// 						variableName: response.data.exports[n],
// 						value: undefined,
// 						language:"python",
// 						code: node, 
// 						kind: 'export',
// 						antecedents:[node]
// 						};
// 					dependencies.push(exportNode) 
// 					node.exportedVariables.push(exportNode.variableName)
// 					console.log(node);
// 				}
// 				for (var n = 0 ; n < response.data.imports.length; n++) {
// 					if (response.data.imports[n] in scopeDictionary) {
// 						let antecedentNode = scopeDictionary[response.data.imports[n]]
// 						node.antecedents.push(antecedentNode);
// 					}
// 				}
// 				return {code: node, exports: dependencies};
// 			} catch (error) {
// 				console.error(error);
// 			}
// 		}
// 		return getExports()
// 	}
// }
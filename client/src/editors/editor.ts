/**
 * xxx
 * 
 * @module Graph
 */

/** This comment is needed so that TypeDoc parses the above one correctly */
import * as Monaco from './monaco';
import * as Preview from './preview';
import * as Langs from '../definitions/languages'; 
import * as Values from '../definitions/values'; 
import { VNode } from 'maquette';

function createOutputPreview(cell:Langs.BlockState, triggerSelect:(selectedTab:number) => void, selectedTab:number, exportedValues:Values.ExportsValue) {
  return Preview.printPreview(cell.editor.id, triggerSelect, selectedTab, exportedValues)
}

function createMonacoEditor(language:string, source:string, cell:Langs.BlockState, context:Langs.EditorContext<any>) : VNode {
  return Monaco.createEditor(language, source, cell, context)
}

export {
  createMonacoEditor,
  createOutputPreview
}

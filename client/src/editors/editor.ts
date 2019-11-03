/**
 * This module contains two helper functions that you can use to create 
 * standard user interface for your custom language plugins. Those functions
 * are used by the built-in language plugins for JavaScript, Python and R.
 * The typical way of using those functions is to call them from the 
 * `render` operation of your implementation of the 
 * [`Editor`](../interfaces/languages.editor.html) interface.
 * 
 * @module Editor
 */

/** This comment is needed so that TypeDoc parses the above one correctly */
import * as Monaco from './monaco';
import * as Preview from './preview';
import * as Langs from '../definitions/languages'; 
import * as Values from '../definitions/values'; 
import { VNode } from 'maquette';

/**
 * The function creates a preview displaying the outputs of a given code block.
 * It supports all of the [`KnownValue`](../modules/values.html#knownvalue) objects,
 * i.e. data frames, figures, JavaScript components and console printouts. When
 * using this function, you need to keep the index of selected tab as part of your
 * editor state and you also need to define an event to modify the selected tab 
 * index.
 * 
 * @param block - Specifies the code block for which we ware generating preview
 * @param triggerSelect - This function is called whenever the user clicks on a 
 *  different tab. It should trigger an event that updates the selected tab in your
 *  editor state.
 * @param selectedTab - Index of a currently selected tab. The first tab has index
 *   0, so if you only ever export a single tab, you can set this to `0`.
 * @param exportedValues - The value to display. You can typically obtain it by
 *   accessing `<Values.ExportsValue>block.code.value`, but make sure this is not
 *  `null`.
 */
function createOutputPreview(block:Langs.BlockState, triggerSelect:(selectedTab:number) => void, selectedTab:number, exportedValues:Values.ExportsValue) {
  return Preview.printPreview(block.editor.id, triggerSelect, selectedTab, exportedValues)
}

/**
 * The function creates a Monaco code editor. If the language is one of the languages
 * understood by Monaco, it will automatically use correct syntax highlighting. 
 * You will typically call this function from the `render` operation of your 
 * [`Editor`](../interfaces/languages.editor.html) implementation. This happens each
 * time any event is triggered, but `createMonacoEditor` uses Maquette in a way that
 * does not re-create the editor each time rendering occurs.
 * 
 * @param language - The name of a programming language that Monaco should use for 
 *   syntax highlighting.
 * @param source - Current source code. This is only used when the editor is created
 *   for the first time, so you do not need to worry about updating current source
 *   code after each keystroke (only after each rebinding).
 *    
 * @param block - Code block that owns the editor. This is mainly used to get unique
 *   ID of the block and avoid re-creating editor on each `render`.
 * 
 * @param context - Context passed to the `render` operation. The editor uses this to 
 *   trigger rebinding and evaluation when user hits `Shift+Enter` in the editor.
 */
function createMonacoEditor(language:string, source:string, block:Langs.BlockState, context:Langs.EditorContext<any>) : VNode {
  return Monaco.createEditor(language, source, block, context)
}

export {
  createMonacoEditor,
  createOutputPreview
}

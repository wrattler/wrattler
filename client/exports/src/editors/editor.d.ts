import * as Langs from '../definitions/languages';
import { VNode } from 'maquette';
declare function createEditor(lang: string, source: string, cell: Langs.BlockState, context: Langs.EditorContext<any>): VNode;
export { createEditor };

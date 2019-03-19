import * as Langs from './languages'
import * as Graph from './graph';

declare type NotebookState = {
  cells: Langs.BlockState[]  
  counter: number
  expandedMenu : number
  cache: Graph.NodeCache
}

export {NotebookState}
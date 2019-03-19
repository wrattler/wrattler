import * as Langs from './languages'
import * as Graph from './graph';

declare type NotebookState = {
  cells: Langs.BlockState[]  
  counter: number
  expandedMenu : number
<<<<<<< HEAD
  cache: Graph.NodeCache
=======
>>>>>>> tp-uitweaks
}

export {NotebookState}
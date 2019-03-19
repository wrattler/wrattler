import * as Langs from './languages'

declare type NotebookState = {
  cells: Langs.BlockState[]  
  counter: number
  expandedMenu : number
}

export {NotebookState}
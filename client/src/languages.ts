import {VNode} from 'maquette';

interface BlockKind {
  language : string;
}

interface Editor<TState> {
  initialize(block:BlockKind) : TState;
  render(id:number, state:TState) : VNode;
}

interface LanguagePlugin {
  parse(code:string) : BlockKind;
  editor : Editor<any>;
  language : string;
}

export { 
  BlockKind,
  Editor,
  LanguagePlugin
}
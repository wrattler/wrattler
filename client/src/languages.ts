interface BlockKind {
  language : string;
}

interface Editor {
  create(id:string, block:BlockKind) : void;
}

interface LanguagePlugin {
  readonly [key: string]: any;
  parse(code:string) : BlockKind;
  editor : Editor;
  language : string;
  name: string;
}

export { 
  BlockKind,
  Editor,
  LanguagePlugin
}
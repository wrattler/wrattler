interface BlockKind {
  language : string;
}

interface Editor {
  create(id:string, block:BlockKind) : void;
}

interface LanguagePlugin {
  parse(code:string) : BlockKind;
  editor : Editor;
  language : string;
}

export { 
  BlockKind,
  Editor,
  LanguagePlugin
}
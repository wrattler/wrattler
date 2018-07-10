interface Node {
  language: string;
  antecedents: Node[]
  value: any
}
interface ExportNode extends Node {
  variableName: string;
}
interface JsCodeNode extends Node { 
  code: string,
  // initialize(language: string, code: string)
}

interface JsExportNode extends ExportNode { 
  code: Node
  // initialize(variableName: string, code: string)
}

// interface JsCodePlugin {
//   language: string,
//   imports: JsCodeNode
//   exports: JsExportNode[]
// }

export {
  Node,
  JsCodeNode,
  // JsCodePlugin,
  ExportNode,
  JsExportNode
}
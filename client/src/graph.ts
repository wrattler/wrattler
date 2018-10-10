/**
 * Types representing the dependency graph.
 * 
 * @module Graph
 */

/** This comment is needed so that TypeDoc parses the above one correctly */
import * as Values from './values';


/** 
 * A node in the dependency graph that Wrattler maintains while the user edits a
 * notebook. The graph is used to avoid re-computing previously computed parts
 * of the notebook and for maintaining unique hashes that are used as keys when 
 * storing results in the data store.
 */
interface Node {
  /** Language of the plugin that created and owns this node */
  language: string;

  /** Returns all nodes that this node depends on in any way */
  antecedents: Node[]
  
  /**  The evaluated value associated with this node */
  value: Values.Value
}

/**
 * A node that represents a data frame exported from a code block. This is 
 * a common interface that can be implemented by any language plugin that 
 * has code blocks which can export nodes. A preview of the value is displayed 
 * in the notebook user interface.
*/
interface ExportNode extends Node {
  /** Name of the exported variable to be used when rendering a preview */
  variableName: string;
}

/**
 * A node representing JavaScript code block. When evaluated, the value will
 * keep a dictionary of all exported variables and their values.
 */
interface JsCodeNode extends Node { 
  /** Complete JavaScript source code in the assoicated block  */
  source: string,
  exportedVariables:string[]
  kind: 'code'
}

/**
 * A node representing a variable exported from a JavaScript code block. 
 * This inherits `variableName` from `ExportNode`.
 */
interface JsExportNode extends ExportNode { 
  /** JavaScript code node that represents full source code that exports this variable */
  code: JsCodeNode
  kind: 'export'
}

type JsNode = JsCodeNode | JsExportNode

interface PyCodeNode extends Node { 
  /** Complete Python source code in the assoicated block  */
  source: string,
  exportedVariables:string[]
  kind: 'code'
}

/**
 * A node representing a variable exported from a Python code block. 
 * This inherits `variableName` from `ExportNode`.
 */
interface PyExportNode extends ExportNode { 
  /** Python code node that represents full source code that exports this variable */
  code: PyCodeNode
  kind: 'export'
}

type PyNode = PyCodeNode | PyExportNode

export {
  Node,
  ExportNode,
  JsNode,
  JsExportNode,
  JsCodeNode,
  PyNode,
  PyExportNode,
  PyCodeNode
}
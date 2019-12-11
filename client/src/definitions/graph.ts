/**
 * Wrattler maintains a dependency graph that is used for evaluating code.
 * The dependency graph is constructed by calling the `bind` operation of
 * [`LanguagePlugin`](../interfaces/languages.languageplugin.html)
 * for individual languages supported in Wrattler. The graph is created once
 * Wrattler loads a notebook and it is then updated each time a cell is 
 * modified. The dependency graph is static, meaning that it is created 
 * by analysing source code, rather than by tracking dependencies at runtime.
 * 
 * A node in the graph is represented by the [`Node`](../interfaces/graph.node.html) type.
 * It is identified by the `hash` property. A `Node` also keeps the `value`
 * of the part of code that the node represents. See the 
 * [`Values`](../modules/values.html) module for the types representing values. When 
 * code in a cell is modified, a new node with a new hash is created. Its
 * `value` is initially set to `null` until the user forces evaluation of 
 * the node or any node that depends on it.
 *
 * - [`Node`](../interfaces/graph.node.html) is the main type exported by this module. 
 *   It represents a graph node, tracks `antecedents` (nodes that this one depends on)
 *   and, importantly, stores `value` and also `errors` associated with the node.
 * 
 * - [`ExportNode`](../interfaces/graph.exportnode.html) is a special type of node that
 *   should be used for nodes that represent exported variables from a cell. If code in 
 *   your cell produces a data frame, you should create this node for each of the 
 *   exported data frames. This type has an extra attribute `variableName` which 
 *   Wrattler uses to pass variables to cells below in the notebook.
 * 
 * - [`Error`](../interfaces/graph.error.html) represents error messages and 
 *   [`NodeCache`](../interfaces/graph.nodecache.html) is used when constructing
 *   dependency graph to cache nodes so that, when you undo a change, Wrattler reuses
 *   the same graph node as before which remembers the previously evaluated results.
 * 
 * - The remaining types are internal to Wrattler. JavaScript language plugin uses [`JsNode`](#jsnode), which 
 *   can be either [`JsExportNode`](../interfaces/graph.jsexportnode.html) or [`JsCodeNode`](../interfaces/graph.jscodenode.html).
 *   External language plugins uses [`ExternalNode`](#externalnode), which
 *   can be either [`ExternalExportNode`](../interfaces/graph.externalexportnode.html) or [`ExternalCodeNode`](../interfaces/graph.externalcodenode.html).
 * 
 * @module Graph
 */

/** This comment is needed so that TypeDoc parses the above one correctly */
import * as Values from './values';

/**
 * Represents an error message. Error messages can be attached to graph nodes,
 * for example when evaluation of the node fails.
 */
interface Error {
  /** The actual error message to be displayed to the user. */
  message: string
}

/**
 * A node in the dependency graph that Wrattler maintains while the user edits a
 * notebook. The graph is used to avoid re-computing previously computed parts
 * of the notebook and for maintaining unique hashes that are used as keys when
 * storing results in the data store.
 */
interface Node {
  /** Language of the plugin that created and owns this node. */
  language: string;

  /** Returns all nodes that this node depends on. */
  antecedents: Node[]

  /** The evaluated value associated with this node. This is `null` when the node is created.  */
  value: Values.Value | null

  /** Hash that identifies the node. When code or dependencies change, new node will be 
   * created and it will have a different hash. */
  hash: string

  /** Collection of errors associated with this node. This is set, for example, when
   * evaluating code represented by this node fails. */
  errors: Error[]
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
  /** List of all exported variables by this code cell */
  exportedVariables:string[]
  /** A tag that allows us to pattern match on `JsNode` objects */
  kind: 'code'
}

/**
 * A node representing a variable exported from a JavaScript code block.
 * This inherits `variableName` from `ExportNode`.
 */
interface JsExportNode extends ExportNode {
  /** JavaScript code node that represents full source code that exports this variable */
  code: JsCodeNode
  /** A tag that allows us to pattern match on `JsNode` objects */
  kind: 'export'
}

/**
 * A node representing code block using R, Python, etc. When evaluated, the value will
 * keep a dictionary of all exported variables and their values.
 */
interface ExternalCodeNode extends Node {
  /** Complete source code (Python, R, etc.) in the assoicated block  */
  source: string,
  /** List of all exported variables by this code cell */
  exportedVariables:string[]
  /** A tag that allows us to pattern match on `ExternalNode` objects */
  kind: 'code'
}

/**
 * A node representing a variable exported from a Python code block.
 * This inherits `variableName` from `ExportNode`.
 */
interface ExternalExportNode extends ExportNode {
  /** Python code node that represents full source code that exports this variable */
  code: ExternalCodeNode
  /** A tag that allows us to pattern match on `ExternalNode` objects */
  kind: 'export'
}

/**
 * This type represents all possible types of nodes created by JavaScript language 
 * plugin. The plugin gets only nodes of this type and can pattern match on them using 
 * the `kind` tag.
 */
type JsNode = JsCodeNode | JsExportNode

/**
 * This type represents all possible types of nodes created by External language 
 * plugin. The plugin gets only nodes of this type and can pattern match on them using 
 * the `kind` tag.
 */
type ExternalNode = ExternalCodeNode | ExternalExportNode

/**
 * When constructing a dependency graph, the `bind` operation of 
 * [`LanguagePlugin](../interfaces/languages.languageplugin.html) gets an instance
 * of `NodeCache` as an argument. The cache can be used to find a previously created
 * node which may already contain an evaluated `value`.
 */
interface NodeCache {
  /** A language plugin using the cache should create `Node` with valid `hash`,
   * `antecedents` and `language` and then pass it to `tryFindNode`. If there is a cached
   * node in the cache, it will be returned back (possibly with `value` set). If no, the
   * cache just returns the newly created node. */
  tryFindNode(node:Node) : Node
}

export {
  Node,
  ExportNode,
  JsNode,
  JsExportNode,
  JsCodeNode,
  ExternalNode,
  ExternalExportNode,
  ExternalCodeNode,
  Error,
  NodeCache
}

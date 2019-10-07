/**
 * In a Wrattler notebook, each cell is associated with one or more nodes in a 
 * [depedency graph](../modules/graph.html). Nodes in the dependency graph represent
 * parts of code. These can be coarse grained such as the enitre Python cell or more
 * fine grained (if a language plugin can parse source code and analyse dependencies fully
 * in the browser). When evaluating cell in a notebook, Wrattler does that by recursively
 * evaluating code associated with nodes (via a corresponding language plugin) in the 
 * dependnecy graph. This module defines types and interfaces that represent values which
 * can be attached to nodes in the graph.
 * 
 * - [`Value`](../interfaces/values.value.html) is an interface representing any value.
 *   Language plugins can use their own types of values, but there are also a couple of 
 *   standard types that are understood and used by Wrattler.
 * 
 * - [`ExportsValue`](../interfaces/values.exportsvalue.html) is a value that should be attached
 *   to a node that represents the result of evaluating the whole code cell. It provides
 *   access to `exports` which is a dictionary with all things exported from a cell
 *   (such as data frames and image or console outputs).
 * 
 * - The special types of values understood by Wrattler are: 
 *   [`DataFrame`](../interfaces/values.dataframe.html) representing a data frame,
 *   [`Printout`](../interfaces/values.printout.html) representing console output,
 *   [`Figure`](../interfaces/values.figure.html) representing an image and
 *   [`JavaScriptOutputValue`](../interfaces/values.javascriptoutputvalue.html) representing
 *   arbitrary JavaScript code that manipulates the DOM of a given DOM element.
 * 
 * - [`KnownValue`](#knownvalue) is a sum type that represents
 *   one of the known types above. The `exports` returned by `ExportsValue` should only
 *   be instances of this type.
 *
 * @module Values
 */

/** This comment is needed so that TypeDoc parses the above one correctly */
import {AsyncLazy} from '../common/lazy';

/**
* Represents a value that a node in the Wrattler dependency graph evaluates to.
* Each language can use its own custom internal values, but there are a few standard
* types of values that Wrattler looks for and recognizes. A value is identified by a
* `kind` which is either one of the standard values or custom language-specific string.
*/
interface Value {
  /** A tag that is used for pattern matching on `KnownValue` instances. For custom
   * values used by a new language, make sure to use a sufficiently unique string! */
  kind : string
}

/**
* Known value is a sum type that represents all the standard types of values that Wrattler
* understands. Those are values that should be exported by the `exports` property of 
* `ExportsValue` and represent images, console outputs, data frames, etc.
*/
type KnownValue = JavaScriptOutputValue | DataFrame | Printout | Figure

/**
* Represents a bit of exported JavaScript functionality that creates custom DOM output.
* The `render` function is called by Wrattler after it creates a tab below a code editor.
* It is called with an `id` of an empty HTML DOM element.
*/
interface JavaScriptOutputValue extends Value {
  /** A tag that is used for pattern matching on `KnownValue` instances. */
  kind : "jsoutput"
  /** When displaying this value, Wrattler will create a new HTML `<div>` element with unique
   * ID and then pass the ID to this function to render whatever it needs. */
  render : (id:string) => void
}

/**
* Represents exports of code cell. When writing a [`LanguagePlugin`](../interfaces/languages.languageplugin.html),
* the `bind` operation returns a graph node named `code` that represents the result of 
* evaluating the entire code cell. The result of evaluating this graph node should be a
* value of type `ExportsValue`.
*/
interface ExportsValue extends Value {
  /** A tag that is used for pattern matching on `KnownValue` instances. */
  kind : "exports"
  /** A dictionary that stores all values exported by a code cell. Wrattler will display tabs
   * with the keys from this dictionary.
   */
  exports : { [key:string]: KnownValue }
}

/**
* Represents a data frame. A data frame is always stored in the data store and represented
* by the `url`. It also includes eagerly evaluated (always available) `preview` and lazily
* evaluated full `data`. Those are represented as arrays of JavaScript records.
*/
interface DataFrame extends Value {
  /** A tag that is used for pattern matching on `KnownValue` instances. */
  kind : "dataframe"
  /** URL of the data frame as stored in a data store */
  url : string
  /** Lazy value that can be asynchronously evaluated to obtain the full data frame as array of records */
  data : AsyncLazy<any[]>
  /** A smaller preview of the data (e.g. first 100 rows), stored as array of records */
  preview : any[]
}

/**
* Represents a console output captured while evaluating some code. The plain text output
* is stored in `data`.
*/
interface Printout extends Value {
  /** A tag that is used for pattern matching on `KnownValue` instances. */
  kind : "printout"
  /** Plain text console output that will be displayed in a `<pre>` tag */
  data : string
}

/**
* Represents a figure or another image captured while evaluating some code. 
* The `data` property should be Base 64 encoded data of an `png` image.
*/
interface Figure extends Value {
  /** A tag that is used for pattern matching on `KnownValue` instances. */
  kind : "figure"
  /** Base64 encoded data of a PNG image representing the figure */
  data: string
}

export {
  Value, 
  KnownValue,
  ExportsValue,
  JavaScriptOutputValue,
  Printout,
  DataFrame,
  Figure
}

/**
 * Types representing values
 * 
 * @module Values
 */

/** This comment is needed so that TypeDoc parses the above one correctly */
import {AsyncLazy} from '../common/lazy';

/**
* TODO
*/
interface Value {
  kind : "jsoutput" | "dataframe" | "exports" | "nothing" | "printout" | "figure"
}

/**
* TODO
*/
interface JavaScriptOutputValue extends Value {
  kind : "jsoutput"
  render : (id:string) => void
}

/**
* TODO
*/
interface ExportsValue extends Value {
  kind : "exports"
  exports : { [key:string]: Value }
}

/**
* TODO
*/
interface DataFrame extends Value {
  kind : "dataframe"
  url : string
  data : AsyncLazy<any>
  preview : any
}

interface Printout extends Value {
  kind : "printout"
  data : string
}

/**
* TODO
*/
interface Figure extends Value {
  kind : "figure"
  data: any
}

export {
  Value, 
  ExportsValue,
  JavaScriptOutputValue,
  Printout,
  DataFrame,
  Figure
}
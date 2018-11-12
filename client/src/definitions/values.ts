/**
 * Types representing values
 * 
 * @module Values
 */

/** This comment is needed so that TypeDoc parses the above one correctly */

/**
* TODO
*/
interface Value {
  kind : "jsoutput" | "dataframe" | "exports" | "nothing"
}

/**
* TODO
*/
interface JavaScriptOutputValue extends Value {
  kind : "jsoutput"
  render : (string) => void
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
  data : any
}

export {
  Value, 
  ExportsValue,
  JavaScriptOutputValue,
  DataFrame
}
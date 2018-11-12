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
}

/**
* TODO
*/
interface ExportsValue extends Value {
  [key:string]: Value
}

/**
* TODO
*/
interface DataFrame extends Value {
  url : string
  data : any
}

export {
  Value, 
  ExportsValue,
  DataFrame
}
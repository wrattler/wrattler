import {h, VNode} from 'maquette';
import * as Values from '../definitions/values'; 

function printPreview(cellId:number, triggerSelect:(number) => void, selectedTable:number, cellValues:Values.ExportsValue) {
  
  let tableNames:Array<string> = Object.keys(cellValues.exports)
  if (tableNames.length > 0) {
    let tabComponents = printTabs(triggerSelect, selectedTable, tableNames);
    return h('div', {}, [ tabComponents, printCurrentValue(cellId, cellValues.exports[tableNames[selectedTable]],tableNames[selectedTable]) ]);
  }
  else 
    return h('div', {},[])
}

function printCurrentValue(cellId:number, value:Values.Value, tableName:string) {
  switch(value.kind)
  {
    case "dataframe":
      let df = <Values.DataFrame>value
      return h('div', {class:'table-container'}, [printCurrentTable(df.data, tableName)]);
    case "printout":
      let printout = <Values.Printout>value
      return h('div', {}, [h('p', {innerHTML: printout.data.toLocaleString()}, [])])
    case "jsoutput":
      let js = <Values.JavaScriptOutputValue>value
      let callRender = (el) => js.render(el.id);
      return h('div', {}, [ 
        h('div', {id: "output_" + cellId.toString() + "_" + tableName, afterCreate:callRender, afterUpdate:callRender }, [])
      ])
    default:
      return h('div', {}, ["No idea what this is"])
  }
}

function printTabs(triggerSelect:(number) => void, selectedTable:number, tableNames:Array<string>) {
  let buttonComponents: Array<any> = []
  for (let t = 0; t< tableNames.length; t++) {
    let buttonComponent = h('button', { class: t==selectedTable?"selected":"normal", onclick:()=> triggerSelect(t)}, [tableNames[t]])
    buttonComponents.push(buttonComponent)
  }
  return h('div', {class: "tabs"},[buttonComponents]);
}

function printCurrentTable(aTable: any, tableName:string) {
  if (aTable.length > 0) {
    let tableHeaders:Array<string> = getCurrentHeaders(aTable[0]);
    let rowsComponents:Array<any> = []
    let headerComponents:Array<any> = []
    // for this table, create headers
    for (let i = 0; i < tableHeaders.length; i++) {
      headerComponents.push(h('th',{key: tableName+"header"+i}, [tableHeaders[i]]))
    }
    rowsComponents.push(h('tr',{key: tableName+"rowheader"},[headerComponents]))
    
    // for every row in dataframe, create rows
    let numRows = aTable.length > 100 ? 100 : aTable.length
    for (let row = 0; row < numRows; row++) {
      let values = getCurrentRow(aTable[row], tableHeaders);
      let columnsComponents:Array<any> = []
      for (let v = 0; v < values.length; v++) {
        if (values[v]==null) {
          columnsComponents.push(h('td', {key: tableName+"column"+v}, [""]))
        }
        else
          columnsComponents.push(h('td', {key: tableName+"column"+v}, [values[v].toString()]))
      }
      rowsComponents.push(h('tr',{key: tableName+"row"+row},[columnsComponents]))
    }

    let tableComponent = h('table', {class:'table', key:tableName},[rowsComponents]);
    return tableComponent
  }
  return h('table', {style: "width:100%", key:tableName},[]);
}

function getCurrentHeaders(firstDataFrameRow) {
  let tableHeaders:Array<string> = []
  if (Object.keys(firstDataFrameRow).length > 0)
    tableHeaders = Object.keys(firstDataFrameRow)
  return tableHeaders;
}

function getCurrentRow(dfRow, keys) {
  let row: Array<string> = [];
  for (let k in keys) {
    row.push(dfRow[keys[k]]);
  } 
  return row;
}

export {
  printPreview
}
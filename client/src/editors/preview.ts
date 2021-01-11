/** @hidden */

/** This comment is needed so that TypeDoc parses the above one correctly */
import {h, VNode} from 'maquette';
import * as Values from '../definitions/values';

function printPreview(cellId:number, triggerSelect:(number:number) => void, selectedTable:number, cellValues:Values.ExportsValue) {
  let tableNames:Array<string> = Object.keys(cellValues.exports)
  if (tableNames.length > 0) {
    let tabComponents = printTabs(triggerSelect, selectedTable, tableNames);
    return h('div', {}, [ tabComponents, printCurrentValue(cellId, cellValues.exports[tableNames[selectedTable]],tableNames[selectedTable]) ]);
  }
  else
    return h('div', {},[])
}

function printCurrentValue(cellId:number, value:Values.KnownValue, tableName:string) {
  let componentRootId = "_"+cellId.toString() + "_" + tableName
  switch(value.kind)
  {
    case "dataframe":
      return h('div', {key: "dataframe"+componentRootId, class:'table-container'}, [printCurrentTable(value.preview, tableName)]);
    case "printout":
      return h('div', {key: "printout"+componentRootId}, [h('pre', {}, [value.data])])
    case "jsoutput":
      let callRender = (el:HTMLElement) => {
        value.render(el.id)
      };
      return h('div', {key: "jsoutputs"+componentRootId}, [
        h('div', {key: "jsoutput"+componentRootId, id: "output_" + cellId.toString() + "_" + tableName, afterCreate:callRender, afterUpdate:callRender }, [])
      ])
    case "figure":
      return h('img.plot', {key: "figure"+componentRootId, id: "figure_" + cellId.toString() + "_" + tableName, src: 'data:image/png;base64,'+value.data})
    default:
      return h('div', {key: "Unsure"+componentRootId}, ["No idea what this is"])
  }
}

function printTabs(triggerSelect:(number:number) => void, selectedTable:number, tableNames:Array<string>) {
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

function getCurrentHeaders(firstDataFrameRow:any) {
  let tableHeaders:Array<string> = []
  if (Object.keys(firstDataFrameRow).length > 0)
    tableHeaders = Object.keys(firstDataFrameRow)
  return tableHeaders;
}

function getCurrentRow(dfRow:any, keys:any) {
  let row: Array<string> = [];
  for (let k in keys) {
    row.push(dfRow[keys[k]]);
  }
  return row;
}

export {
  printPreview
}

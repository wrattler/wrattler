import {h, VNode} from 'maquette';

function printValue(cellValues) {
  let variableNames:Array<string> = Object.keys(cellValues)
  let valuesString = "Values: \n"
  for (let v = 0; v < variableNames.length; v++) {
    valuesString = valuesString.concat(variableNames[v])
                                .concat(": ")
                                .concat(JSON.stringify(cellValues[variableNames[v]].data))
                                .concat("\n");
  }
  return valuesString
}

function printPreview (triggerSelect, selectedTable, cellValues) {
  let tableNames:Array<string> = Object.keys(cellValues)
  let tabComponents = printTabs(triggerSelect, tableNames);
  return h('div', {},[ tabComponents, 
    (tableNames[selectedTable] == undefined) || (cellValues[tableNames[selectedTable]].data) == undefined ? [] : printCurrentTable(cellValues[tableNames[selectedTable]].data)]);
}

function printTabs(triggerSelect, tableNames) {
  let buttonComponents: Array<any> = []
  for (let t = 0; t< tableNames.length; t++) {
    let buttonComponent = h('button', {style: "background-color: inherit;\
                                                float: left;\
                                                border: none;\
                                                outline: none;\
                                                cursor: pointer;\
                                                padding: 14px 16px;\
                                                transition: 0.3s;\
                                                font-size: 17px;", onclick:()=> triggerSelect(t)
                                                }, [tableNames[t]])

    buttonComponents.push(buttonComponent)
  }
  return h('div', {style: "overflow: hidden; border: 1px solid #ccc; background-color: #f1f1f1;"},[buttonComponents]);
}

function printCurrentTable(aTable) {
  
  let tableHeaders:Array<string> = getCurrentHeaders(aTable[0]);
  
  let rowsComponents:Array<any> = []
  let headerComponents:Array<any> = []
  // for this table, create headers
  for (let i = 0; i < tableHeaders.length; i++) {
    headerComponents.push(h('th',{}, [tableHeaders[i]]))
  }
  rowsComponents.push(h('tr',{},[headerComponents]))
  
  // for every row in dataframe, create rows
  for (let row = 0; row < aTable.length; row++) {
    let values = getCurrentRow(aTable[row], tableHeaders);
    let columnsComponents:Array<any> = []
    for (let v = 0; v < values.length; v++) {
      columnsComponents.push(h('td', {}, [values[v].toString()]))
    }
    rowsComponents.push(h('tr',{},[columnsComponents]))
  }

  let tableComponent = h('table', {style: "width:100%"},[rowsComponents]);
  return tableComponent
}

function getCurrentHeaders(firstDataFrameRow) {
  let tableHeaders:Array<string> = Object.keys(firstDataFrameRow)
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
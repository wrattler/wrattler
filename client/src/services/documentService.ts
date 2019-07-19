import axios from 'axios';
declare var CLIENT_URI: string;

interface DocumentElement {
  language: string
  source: string
}

async function getDocument(paragraph:string): Promise<DocumentElement[]> {
  function getCellCode(language: string, codeCell: string) : DocumentElement {
    let languageMarker = "```".concat(language)
    let languageMarkerBegin = codeCell.indexOf(languageMarker)
    if (languageMarkerBegin > -1)
    {
      let languageMarkerEnd = codeCell.indexOf("```", languageMarkerBegin+languageMarker.length+1)
      let source = codeCell.substring(languageMarkerBegin+languageMarker.length,languageMarkerEnd).trim()
      return {language: language, source: source }
    }
    return {language: language, 
      source: "Unknown language: \n"+codeCell}
  }

  function getCellLanguage(codeCell: string) {
    let listOfLanguages = ["javascript", "python", "racket", "r", "thegamma"] 
    for (var l = 0; l < listOfLanguages.length; l++) {
      let languageMarker = "```".concat(listOfLanguages[l])
      let languageMarkerBegin = codeCell.indexOf(languageMarker)
      if (languageMarkerBegin > -1) {
        return listOfLanguages[l]
      }
    }
    return "markdown";
  }
  
  let documents : DocumentElement[] = []; 
  var regex = /```[a-z]+[^`]*```/g;
  var res; 
  var currentPos = 0;
  
  while(res = regex.exec(paragraph)) {
    let start = res.index;
    let end = res.index+res[0].length;
    if (currentPos < start && paragraph.substring(currentPos, start).trim() != "") {
      documents.push({language: "markdown", source: paragraph.substring(currentPos, start)})
    }
    let cell = paragraph.substring(start, end);
    let cellLanguage = getCellLanguage(cell);
    let cellCode = getCellCode(cellLanguage, cell);
    documents.push(cellCode);
    currentPos = end
  }
  
  if (currentPos < paragraph.length-1 && paragraph.substring(currentPos).trim() != "") {
    documents.push({language: "markdown", source: paragraph.substring(currentPos)})
  }

  if (documents.length == 0) {
    documents.push({language: "markdown", source: "Wellcome to Wrattler" })
  }


  return documents;
}

async function getNamedDocumentContent(): Promise<string> {
  let sourceFile = "index"
  if (window.location.search.slice(1).length > 0){
    sourceFile = window.location.search.slice(1)
  }
  let sourceURL = "/".concat(sourceFile).concat(".md")
  let response = await axios.get(sourceURL)
  return response.data;
}

async function getResourceContent(sourceURL:string): Promise<string> {
  let response = await axios.get(CLIENT_URI.concat("/resources/").concat(sourceURL))
  return response.data;
}
  
export {
  getDocument,
  getNamedDocumentContent,
  DocumentElement,
  getResourceContent,
}

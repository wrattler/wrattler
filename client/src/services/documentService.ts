import axios from 'axios';

interface DocumentElement {
  language: string
  source: string
}

async function getSampleDocument(): Promise<Array<DocumentElement>> {
    async function getDocumentMd() : Promise<string> {
      let response = await axios.get("/sample.md")
      return response.data
    }
    let documents = []; 

    function getCellCode(language: string, codeCell: string) : DocumentElement {
      let languageMarker = "```".concat(language)
      let languageMarkerBegin = codeCell.indexOf(languageMarker)
      if (languageMarkerBegin > -1)
      {
        let languageMarkerEnd = codeCell.indexOf("```", languageMarkerBegin+languageMarker.length+1)
        return {language: language, 
          source: codeCell.substring(languageMarkerBegin+languageMarker.length,languageMarkerEnd)}
      }
    }

    function getCellLanguage(codeCell: string) {
      let listOfLanguages = ["javascript", "python", "r", "thegamma"] 
      for (var l = 0; l < listOfLanguages.length; l++) {
        let languageMarker = "```".concat(listOfLanguages[l])
        let languageMarkerBegin = codeCell.indexOf(languageMarker)
        if (languageMarkerBegin > -1) {
          return listOfLanguages[l]
        }
      }
      return "markdown";
    }

    let paragraph = await getDocumentMd() 
    var regex = /```[a-z]+[^`]*```/g;
    var res; 
    var currentPos = 0;
    
    while(res = regex.exec(paragraph)) {
      let start = res.index;
      let end = res.index+res[0].length;
      if (currentPos < start) {
        documents.push({language: "markdown", source: paragraph.substring(currentPos, start)})
      }
      let cell = paragraph.substring(start, end);
      let cellLanguage = getCellLanguage(cell);
      let cellCode = getCellCode(cellLanguage, cell);
      documents.push(cellCode);
      currentPos = end
    }

    if (currentPos < paragraph.length-1) {
      documents.push({language: "markdown", source: paragraph.substring(currentPos)})
    }
    console.log(documents);
    return documents;
}
  
export {
  getSampleDocument,
  DocumentElement
}
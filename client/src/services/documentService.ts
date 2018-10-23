import axios from 'axios';

declare var DATASTORE_URI: string;

export const DocumentService = {
  
  getSampleDocument: (): Array<any> =>{
    function getDocumentMd() : string {
      var paragraph = "# Welcome to Wrattler. \
This is a sample notebook showing no data science at all.\
First, we create one frame in JavaScript:\n\
```javascript\
var one = [{'name':'Joe', 'age':50}]\
```\
Second, we create one frame in Python\
```python\
two = pd.DataFrame({'name':['Jane'], 'age':[52]})\
```\
Third we combine the two:\
```r\
three <- rbind(one,two) \
```\
";
      return paragraph
    }
    let documents = []; 

    function getCellCode(language: string, codeCell: string) {
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
      let listOfLanguages = ["javascript", "python", "r"] 
      for (var l = 0; l < listOfLanguages.length; l++) {
        let languageMarker = "```".concat(listOfLanguages[l])
        let languageMarkerBegin = codeCell.indexOf(languageMarker)
        if (languageMarkerBegin > -1) {
          return listOfLanguages[l]
        }
      }
      return "unknown language";
    }

    let paragraph = getDocumentMd() 
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
  },
  createSampleDocument: () => {
    let documents = 
    [ 
      { "language": "markdown", "source": "First, we create one frame in JavaScript:" },
      { "language": "javascript", "source": "var one = [{'name':'Joe', 'age':50}]" },
      { "language": "markdown", "source": "Second, we create one frame in Python:" },
      { "language": "python", "source": 'two = pd.DataFrame({"name":["Jane"], "age":[52]})' },
      { "language": "markdown", "source": "Third, we create one more frame in R:" },
    ]
    return documents;
  }
  
}
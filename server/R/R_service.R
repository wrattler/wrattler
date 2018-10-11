# functions to do the heavy lifting for Wrattler R-service

library(jsonlite)
library(httr)
source("codeAnalysis.R")

readFrame <- function(frame_name, frame_hash) {
    ## Read a dataframe from the datastore.
    ## use jsonlite to deserialize json into a data.frame
    url <- paste0(Sys.getenv("DATASTORE_URL"),"/",frame_hash,"/",frame_name)
    r<-GET(url)
    if ( r$status != 200) {
        print("Unable to access datastore")
        return(NULL)
    }
    frame <- jsonlite::fromJSON(content(r,"text"))
    return(frame)
}


writeFrame <- function(frame_data, frame_name, frame_hash) {
    ## Write a dataframe to the datastore.
    ## use jsonlite to serialize dataframe into json
    url <- paste0(Sys.getenv("DATASTORE_URL"),"/",frame_hash,"/",frame_name)
    r <- PUT(url, body=frame_data, encode="json")
    return(status_code(r) == 200)
}


analyzeCode <- function(code) {
    ## code here will be a string - first parse it, then find imports and exports
    parsedCode <- prepCodeString(code)
    impexp <- getImportsExports(parsedCode)
    return(impexp)
}


executeCode <- function(code) {

}

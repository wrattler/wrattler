library(jug)
library(jsonlite)
#library(futile.logger)

source("R_service.R")


handle_exports <- function(code, frames, hash) {
    ## get imports and exports from the code snippet
    impExpEnv <- analyzeCode(code)
    importDF <- data.frame(imports=impExpEnv$imports)
    exportDF <- data.frame(exports=impExpEnv$exports)
    return(jsonlite::toJSON(c(importDF,exportDF)))
}

handle_eval <- function(code,frames,hash) {
    ## frames, parsed from json structure like [{"name":<name>,"url":<url>},{...}
    ## will be a list of named-lists.


    ## get a list of the expected output names from the code
    exportsList <- analyzeCode(code)$exports
    ## executeCode will return a named list of all the evaluated outputs
    outputsList <- executeCode(code, frames)
    ## uploadOutputs will put results onto datastore, and return a dataframe of names and urls
    results <- uploadOutputs(outputsList, exportsList, hash)
    return(jsonlite::toJSON(results))
}


jug() %>%
    post("/exports", decorate(handle_exports)) %>%
    post("/eval", decorate(handle_eval)) %>%
    simple_error_handler_json() %>%
    serve_it(host="0.0.0.0",port=7103)

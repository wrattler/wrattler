library(jug)
library(jsonlite)
#library(futile.logger)

source("R_service.R")


handle_exports <- function(code, frames, hash) {
    ## get imports and exports from the code snippet
    impExpEnv <- analyzeCode(code)
    impExpList <- list(imports=as.character(impExpEnv$imports),
                      exports=as.character(impExpEnv$exports))
    return(jsonlite::toJSON(impExpList))
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
    ## placeholder for text output
    textOutput <- "Some output"
    returnValue <- list(frames=results, output=textOutput)
    return(jsonlite::toJSON(returnValue))
}


jug() %>%
    cors(path=NULL, allow_methods=c("POST"),allow_origin='*',
        allow_credentials=NULL, allow_headers='*',
        max_age=NULL, expose_headers=NULL) %>%
    post("/exports", decorate(handle_exports)) %>%
    post("/eval", decorate(handle_eval)) %>%
    simple_error_handler_json() %>%
    serve_it(host="0.0.0.0",port=7103)
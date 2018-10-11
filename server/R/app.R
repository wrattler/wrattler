library(jug)
library(jsonlite)

source("R_service.R")


handle_exports <- function(code, frames, hash) {
    ## get imports and exports from the code snippet
    impExpEnv <- analyzeCode(code)
    importDF <- data.frame(imports=impExpEnv$imports)
    exportDF <- data.frame(exports=impExpEnv$exports)
    return(jsonlite::toJSON(c(importDF,exportDF)))
}

handle_eval <- function(code_frames_hash) {
    # dummy implementation for now
    output <- "This is a test"
    frames <- c("a","b")
    return(jsonlite::toJSON(data.frame(output,frames),auto_unbox=TRUE))
}


jug() %>%
    post("/exports", decorate(handle_exports)) %>%
    post("/eval", decorate(handle_eval)) %>%
    simple_error_handler_json() %>%
    serve_it(host="0.0.0.0",port=7103)

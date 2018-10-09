library(jug)
library(jsonlite)

source("R_service.R")


handle_exports <- function(code, frames, hash) {
    # dummy implementation for now
    imports <- c("x","y")
    exports <- c("a","b")
    print(paste("Code is",code))
    return(jsonlite::toJSON(data.frame(imports,exports),auto_unbox=TRUE))
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

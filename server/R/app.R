library(jug)
library(jsonlite)

if (! is.na(Sys.getenv("R_SERVICE_HOME", unset=NA)) ) {
    setwd(Sys.getenv("R_SERVICE_HOME"))
    print(paste("Running from",getwd()))
}

source("R_service.R")

## the jug app itself, use infix to chain endpoints together.

jug() %>%
    cors(path=NULL, allow_methods=c("POST"),allow_origin='*',
        allow_credentials=NULL, allow_headers=c("Origin", "X-Requested-With", "Content-Type", "Accept"),
        max_age=NULL, expose_headers=NULL) %>%
    post("/exports", decorate(handle_exports)) %>%
    post("/eval", decorate(handle_eval)) %>%
    simple_error_handler_json() %>%
    serve_it(host="0.0.0.0",port=7103)

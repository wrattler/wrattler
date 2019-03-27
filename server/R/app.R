library(jug)
library(jsonlite)

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

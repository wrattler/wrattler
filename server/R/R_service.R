# functions to do the heavy lifting for Wrattler R-service

library(jsonlite)
library(httr)
source("codeAnalysis.R")


makeURL <- function(name, hash) {
    return(paste0(Sys.getenv("DATASTORE_URI"),"/",hash,"/",name))
}


readFrame <- function(url) {
    ## Read a dataframe from the datastore.
    ## use jsonlite to deserialize json into a data.frame
    r<-GET(url)
    if ( r$status != 200) {
        print("Unable to access datastore")
        return(NULL)
    }
    frame <- jsonlite::fromJSON(content(r,"text"))
    return(frame)
}


writeFrame <- function(frameData, frameName, frameHash) {
    ## Write a dataframe to the datastore.
    ## use jsonlite to serialize dataframe into json
    url <- makeURL(frameName, frameHash)
    ## doesn't like converting numbers into json
    if (is.numeric(frameData)) frameData <- as.character(frameData)
    ## see if it is json-able:
    isJSONable <- tryCatch({ !is.null(jsonlite::toJSON(frameData)) },
                           error=function(cond) {
                               return(FALSE)
                           })

    ## put it into the datastore if it is convertable to json
    if (isJSONable) {
        r <- PUT(url, body=frameData, encode="json")
        return(status_code(r) == 200)
    }
    return(FALSE)
}


analyzeCode <- function(code) {
    ## code here will be a string - first parse it, then find imports and exports
    parsedCode <- prepCodeString(code)
    impexp <- getImportsExports(parsedCode)
    return(impexp)
}


retrieveFrames <- function(inputFrames) {
    ## given a json object [ {"name": <frame_name>, "url":<url>},...]
    ## return an environment framedata such that framedata$frame_name contains the dataframe
    framedata <- new.env()

}

uploadOutputs <- function(outputsList, exports, hash) {
    ## take a named list, upload the results, and return dataframe of names and urls
    url <- c()
    for (i in 1:length(exports)) {
        uploaded_ok <- writeFrame(outputsList[[exports[[i]]]],exports[[i]],hash)
        url <- c(url, makeURL(exports[[i]], hash))
    }
    name <- exports
    resultsDF <- data.frame(name, url)
    return(resultsDF)
}

executeCode <- function(code, importsList) {
    ## analyze the code to get imports and exports (only need exports here)
    impexp <- analyzeCode(code)
    ## construct a function that assigns retrieved frames to the imported variables,
    ## then contains the code block.
    stringFunc <- "wrattler_f <- function() {\n"
    if (length(importsList) > 0) {
        for (i in seq_along(importsList)) {
            stringFunc <- paste0(stringFunc,"    ",
                                 importsList[[i]]$name, "<- readFrame('",
                                 importsList[[i]]$url, "') \n")
        }
    }
    stringFunc <- paste(stringFunc, "    ", code, "\n")
    stringFunc <- paste(stringFunc, "    returnVars <- list(")
    for (i in seq_along(impexp$exports)) {
        stringFunc<- paste0(stringFunc,"'", impexp$exports[i],"'=",impexp$exports[i])
        if (i != length(impexp$exports)) {
            stringFunc <- paste(stringFunc,",")
        }
    }
    stringFunc <- paste(stringFunc,") \n    return(returnVars) \n")
    stringFunc <- paste(stringFunc,  "}\n")
    parsedFunc <- parse(text=stringFunc)
    eval(parsedFunc)
    returnVars <- wrattler_f()
    return(returnVars)
}

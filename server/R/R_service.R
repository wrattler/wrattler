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
    json_data <- content(r,"text")
    frame <- jsonToDataFrame(json_data)
    return(frame)
}

jsonToDataFrame <- function(json_obj) {
    frame <- jsonlite::fromJSON(json_obj)
    return(frame)
}


writeFrame <- function(frameData, frameName, frameHash) {
    ## Write a dataframe to the datastore.
    ## use jsonlite to serialize dataframe into json
    url <- makeURL(frameName, frameHash)
    frameJSON <- jsonFromDataFrame(frameData)
    ## put it into the datastore if it is not NULL, i.e. was convertable to json
    if (!is.null(frameJSON)) {
        r <- PUT(url, body=frameJSON, encode="json")
        return(status_code(r) == 200)
    }
    return(FALSE)
}


jsonFromDataFrame <- function(frameData) {
    ## jsonlite doesn't like converting numbers into json
    if (is.numeric(frameData)) frameData <- as.character(frameData)
    ## explicitly convert into a dataframe if we can
    frameData <- tryCatch({ as.data.frame(frameData) },
                           error=function(cond) {
                               return(NULL)
                           })
    if (is.null(frameData)) return(NULL)
    ## convert to JSON
    frameJSON <- jsonlite::toJSON(frameData, na="null")
    return(frameJSON)
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
    for (i in seq_along(exports)) {
        uploaded_ok <- writeFrame(outputsList[[exports[[i]]]],exports[[i]],hash)
        url <- c(url, makeURL(exports[[i]], hash))
    }
    name <- exports
    resultsDF <- data.frame(name, url)
    return(resultsDF)
}


cleanString <- function(inputString) {
    ## remove a preceding [1] and escaped quotes from a string captured by capture.output
    outputString <- gsub("\\[1\\] ","",inputString)
    outputString <- gsub('\\"','',outputString)
    return(outputString)
}


constructFuncString <- function(code, importsList) {
    ## construct a string containing a function definition wrapping our code.

    ## analyze the code to get imports and exports (only need exports here)
    impexp <- analyzeCode(code)
    ## construct a function that assigns retrieved frames to the imported variables,
    ## then contains the code block.
    stringFunc <- "wrattler_f <- function() {\n"
    stringFunc <- paste(stringFunc," \n    png('test.png') \n")
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
    stringFunc <- paste(stringFunc,") \n")
    stringFunc <- paste(stringFunc," \n    dev.off() \n")
    stringFunc <- paste(stringFunc," \n    return(returnVars) \n")
    stringFunc <- paste(stringFunc,  "}\n")
    return(stringFunc)
}

executeCode <- function(code, importsList) {
    ## Call the function to create stringFunc, then parse and execute it.

    stringFunc <- constructFuncString(code, importsList)
    parsedFunc <- parse(text=stringFunc)

    eval(parsedFunc)
  #  png('wrattlerPlot.png')
    s <- capture.output(returnVars <- wrattler_f())
  #  dev.off()
#    print("should have made a png")
    clean_s <- lapply(s, cleanString)
    outputString <- paste(clean_s, collapse="\n")
    ## try to capture plots as a png
#    plotStatus <- tryCatch({ dev.copy(png,'wrattlerPlot.png')
#        print("found a plot")
#        dev.off()},
#        error=function(cond) {
#            print("nothing here")
 #           return(NULL)
 #       })
    ret <- new.env()
 #   ret$plot <- !is.null(plotStatus)
    ret$returnVars <- returnVars
    ret$outputString <- outputString
    return(ret)
}

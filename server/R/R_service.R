# functions to do the heavy lifting for Wrattler R-service

library(jsonlite)
library(httr)
library(base64enc)

source("codeAnalysis.R")

TMPDIR <- "/tmp"

handle_exports <- function(code, frames, hash) {
    ## top-level function to get imports and exports from the code snippet
    impExpEnv <- analyzeCode(code)
    impExpList <- list(imports=as.character(impExpEnv$imports),
                      exports=as.character(impExpEnv$exports))
    return(jsonlite::toJSON(impExpList))
}


handle_eval <- function(code, frames, hash) {
    ## top-level function to evaluate a code block and return any outputs
    ## as json.

    ## The 'frames' argument, parsed from json structure like
    ##    [{"name":<name>,"url":<url>},{...}, ...]
    ## will be a list of named-lists.

    ## get a list of the expected output names from the code
    exportsList <- analyzeCode(code)$exports
    ## executeCode will return a named list of all the evaluated outputs
    outputs <- executeCode(code, frames, hash)
    outputsList <- outputs$returnVars
    ## uploadOutputs will put results onto datastore, and return a dataframe of names and urls
    results <- uploadOutputs(outputsList, exportsList, hash)
    ## text output from executing code
    textOutput <- outputs$outputString
    returnValue <- list(frames=results, output=unbox(textOutput))
    return(jsonlite::toJSON(returnValue))
}

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
    if ("ggplot" %in% class(frameData)) {
        ## could be an image, saved as a png file on /tmp
        frameJSON <- jsonFromImageFile(frameName, frameHash)
        filename <- file.path(TMPDIR,frameHash,paste0(frameName,".png"))
        print("File exists!")
        if (! file.exists(filename))
            return(FALSE)
        print("About to put image file on datastore")
        r <- PUT(url, body=upload_file(filename), encode="raw")
        return(status_code(r) == 200)
    } else {
        frameJSON <- jsonFromDataFrame(frameData)
    }
    ## put it into the datastore if it is not NULL, i.e. was convertable to json
    if (!is.null(frameJSON)) {
        r <- PUT(url, body=frameJSON, encode="json")
        return(status_code(r) == 200)
    }
    return(FALSE)
}

## following method is depracated - we now send image as binary file rather than base64 encoded.
jsonFromImageFile <- function(frameName, frameHash) {
    ## see if there is a png file at /tmp/frameHash/frameName.png
    filename <- file.path(TMPDIR,frameHash,paste0(frameName,".png"))
    if (! file.exists(filename)) return(NULL)
    IMAGE <- base64enc::base64encode(filename)
    frameJSON <- jsonlite::toJSON(as.data.frame(IMAGE))
    return(frameJSON)
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


constructFuncString <- function(code, importsList, hash) {
    ## construct a string containing a function definition wrapping our code.

    ## analyze the code to get imports and exports (only need exports here)
    impexp <- analyzeCode(code)
    ## construct a function that assigns retrieved frames to the imported variables,
    ## then contains the code block.
    stringFunc <- "wrattler_f <- function() {\n"
#    stringFunc <- paste(stringFunc," \n    png('test.png') \n")
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
    ## search for ggplot objects in this environment
    stringFunc <- paste(stringFunc," \n    for (envitem in ls(environment())) { \n")
    stringFunc <- paste(stringFunc,"       if ('ggplot' %in% class(get(envitem,environment()))) {\n")
    ## write any ggplot objects to a filename constructed from the cell hash and
    ## the object name
    stringFunc <- paste(stringFunc,"         writePlotToFile(get(envitem,environment()), '")
    stringFunc <- paste0(stringFunc, hash,"', envitem) \n")
    stringFunc <- paste(stringFunc,"       }\n")
    stringFunc <- paste(stringFunc,"     }\n")
    ## return the returnVars
    stringFunc <- paste(stringFunc," \n    return(returnVars) \n")
    stringFunc <- paste(stringFunc,  "}\n")
    return(stringFunc)
}


writePlotToFile <- function(plot, hash, plotName) {
    ## use png device to save output to a file
    dir.create(file.path(TMPDIR,hash), showWarnings=FALSE)
    filename = file.path(TMPDIR,hash,paste0(plotName,".png"))
    png(file=filename)
    print(plot)
    dev.off()
}



executeCode <- function(code, importsList, hash) {
    ## Call the function to create stringFunc, then parse and execute it.

    stringFunc <- constructFuncString(code, importsList, hash)
    parsedFunc <- parse(text=stringFunc)

    eval(parsedFunc)
    png('wrattlerPlot.png')
    s <- capture.output(returnVars <- wrattler_f())

    clean_s <- lapply(s, cleanString)
    outputString <- paste(clean_s, collapse="\n")

    ret <- new.env()
    ret$returnVars <- returnVars
    ret$outputString <- outputString
    return(ret)
}

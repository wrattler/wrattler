# functions to do the heavy lifting for Wrattler R-service

library(jsonlite)
library(httr)
library(base64enc)
library(rlang)

source("codeAnalysis.R")

TMPDIR <- "/tmp"



handle_exports <- function(code, frames, hash) {
    ## top-level function to get imports and exports from the code snippet
    ## here, "frames" is just a list of the names of frames exported from other cells
    impExpEnv <- analyzeCode(code, frames)
    impExpList <- list(imports=as.character(impExpEnv$imports),
                      exports=as.character(impExpEnv$exports))
    return(jsonlite::toJSON(impExpList))
}


handle_eval <- function(code, frames, hash) {
    ## top-level function to evaluate a code block and return any outputs
    ## as json in the following format:
    ##  {"output": <text_output>,
    ##   "frames": [{"name":<name>,"url":<url>},...],
    ##   "figures": [{"name":<name>,"url":<url>},...]}

    ## The 'frames' input argument, parsed from json structure like
    ##    [{"name":<name>,"url":<url>},{...}, ...]
    ## will be a list of named-lists.

    ## get a list of the expected output names from the code
    exportsList <- analyzeCode(code)$exports
    ## executeCode will return a named list of all the evaluated outputs
    debug = ! is.na(Sys.getenv("R_SERVICE_DEBUG", unset=NA))
    outputs <- executeCode(code, frames, hash, debug)
    outputsList <- outputs$returnVars
    ## uploadOutputs will put results onto datastore, and return a dataframe of names and urls
    results <- uploadOutputs(outputsList, exportsList, hash)
    ## text output from executing code
    textOutput <- outputs$outputString
    returnValue <- list(frames=results$frames, figures=results$figures, output=jsonlite::unbox(textOutput))
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


writeFrame <- function(frameData, frameName, cellHash) {
    ## Write a dataframe to the datastore.
    ## use jsonlite to serialize dataframe into json
    url <- makeURL(frameName, cellHash)
    if ("ggplot" %in% class(frameData)) {
        return(FALSE) # this will be done by writeFigure instead
    } else if (typeof(frameData)=="closure") {
        return(FALSE) # probably a function definition - we don't want to store this
    } else {
        # hopefully a dataframe that can be converted into JSON
        frameJSON <- jsonFromDataFrame(frameData)
    }
    ## put it into the datastore if it is not NULL, i.e. was convertable to json
    if (!is.null(frameJSON)) {
        r <- PUT(url, body=frameJSON, encode="json")
        return(status_code(r) == 200)
    }
    return(FALSE)
}


writeFigure <- function(figureData, figureName, cellHash) {
    ## Analogue to writeFrame, but for figures
    url <- makeURL(figureName, cellHash)
    if ("ggplot" %in% class(figureData)) {
        ## image should be saved as a png file on /tmp
        ## convert to base64 so we can put it in a JSON object
        figJSON <- jsonFromImageFile(figureName, cellHash)
        r <- PUT(url, body=figJSON, encode="json")
        return(status_code(r) == 200)
    } else {
        return(FALSE)
    }
}


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


analyzeCode <- function(code, frames=NULL) {
    ## code here will be a string - first parse it, then find imports and exports
    parsedCode <- prepCodeString(code)
    if (is.null(frames)) {
        impexp <- getImportsExports(parsedCode)
    } else {
        impexp <- getImportsExports(parsedCode, frames)
    }
    return(impexp)
}


retrieveFrames <- function(inputFrames) {
    ## given a json object [ {"name": <frame_name>, "url":<url>},...]
    ## return an environment framedata such that framedata$frame_name contains the dataframe
    framedata <- new.env()

}


uploadOutputs <- function(outputsList, exports, hash) {
    ## take a named list, upload the results, and return dataframes of names and urls
    outputData <- new.env()
    frame_url <- c()
    frame_name <- c()
    fig_url <- c()
    fig_name <- c()
    for (i in seq_along(exports)) {
        ## first try to write object out as a dataframe
        uploaded_frame <- writeFrame(outputsList[[exports[[i]]]],exports[[i]],hash)
        if (uploaded_frame) {
            frame_url <- c(frame_url, makeURL(exports[[i]], hash))
            frame_name <- c(frame_name, exports[[i]])
        } else {
            ## try uploading it as a figure
            uploaded_fig <- writeFigure(outputsList[[exports[[i]]]], exports[[i]], hash)
            if (uploaded_fig) {
                fig_url <- c(fig_url, makeURL(exports[[i]], hash))
                fig_name <- c(fig_name, exports[[i]])
            }
        }
    }
    frameDF <- data.frame(name=frame_name, url=frame_url)
    figDF <- data.frame(name=fig_name, url=fig_url)
    outputData$frames <- frameDF
    outputData$figures <- figDF
    return(outputData)
}


cleanString <- function(inputString) {
    ## remove a preceding [1] and escaped quotes from a string captured by capture.output
    outputString <- gsub("\\[1\\] ","",inputString)
    outputString <- gsub('\\"','',outputString)
    return(outputString)
}


constructFuncString <- function(code, importsList, hash, debug=FALSE) {
    ## construct a string containing a function definition wrapping our code.
    ## analyze the code to get imports and exports (only need exports here)
    impexp <- analyzeCode(code)
    ## construct a function that assigns retrieved frames to the imported variables,
    ## then contains the code block.
    stringFunc <- "wrattler_f <- function() {\n"
    if (debug) {
        stringFunc <- paste0(stringFunc,"    print(paste(Sys.time(), 'Starting to execute code'))\n")
    }
    if (length(importsList) > 0) {
        for (i in seq_along(importsList)) {

            stringFunc <- paste0(stringFunc,"    ",
                                 importsList[[i]]$name, "<- readFrame('",
                                 importsList[[i]]$url, "') \n")
        }
    }
    if (debug) {
        stringFunc <- paste0(stringFunc,"    print(paste(Sys.time(), 'Finished reading input frames'))\n")
    }
    stringFunc <- paste(stringFunc, "    ", code, "\n")
    if (debug) {
        stringFunc <- paste0(stringFunc,"    print(paste(Sys.time(), 'Finished executing code'))\n")
    }
    stringFunc <- paste(stringFunc, "    returnVars <- list()\n")
    for (i in seq_along(impexp$exports)) {
        ## wrap adding things to returnVars list in a tryCatch, as currently
        ## it is possible that some out-of-scope variables will be in the 'exports' list
        stringFunc <- paste(stringFunc, " tryCatch({ ")
        stringFunc<- paste0(stringFunc,"returnVars <- append(returnVars,list('",
                            impexp$exports[i],"'=",impexp$exports[i],"))")
        stringFunc<- paste(stringFunc, "}, error=function(cond) {}) \n")

    }
    ## search for ggplot objects in this environment
    stringFunc <- paste(stringFunc," \n    for (envitem in ls(environment())) { \n")
    stringFunc <- paste(stringFunc,"       if ('ggplot' %in% class(get(envitem,environment()))) {\n")
    ## write any ggplot objects to a filename constructed from the cell hash and the object name
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


executeCode <- function(code, importsList, hash, debug=FALSE) {
    ## Call the function to create stringFunc, then parse and execute it.
    if (debug) {
        print(paste("Executing code block \n",code))
    }
    stringFunc <- constructFuncString(code, importsList, hash, debug)
    #parsedFunc <- parse(text=stringFunc)

    parsedFunc <- rlang::parse_expr(stringFunc)

    eval(parsedFunc)
    s <- capture.output(returnVars <- wrattler_f())

    clean_s <- lapply(s, cleanString)
    outputString <- paste(clean_s, collapse="\n")

    ret <- new.env()
    ret$returnVars <- returnVars
    ret$outputString <- outputString
    return(ret)
}

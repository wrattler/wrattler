# functions to do the heavy lifting for Wrattler R-service

library(jsonlite)
library(httr)
library(base64enc)
library(rlang)
library(arrow)

## arrow will override some possibly useful names from base - fix this here
array <- base::array
table <- base::table


source("codeAnalysis.R")

if (.Platform$OS.type == "unix") {
    TMPDIR <- "/tmp"
} else {
    TMPDIR <- "%TEMP%"
}


handle_exports <- function(code, frames, hash) {
    ## top-level function to get imports and exports from the code snippet
    ## here, "frames" is just a list of the names of frames exported from other cells
    impExpEnv <- analyzeCode(code, frames)
    impExpList <- list(imports=as.character(impExpEnv$imports),
                      exports=as.character(impExpEnv$exports))
    return(jsonlite::toJSON(impExpList))
}


handle_eval <- function(code, frames, hash, files=NULL) {
    ## top-level function to evaluate a code block and return any outputs
    ## as json in the following format:
    ##  {"output": <text_output>,
    ##   "frames": [{"name":<name>,"url":<url>},...],
    ##   "figures": [{"name":<name>,"url":<url>},...],
    ##   "html": <html string> }

    ## The 'files' input argument will be a list of URLs for datastore locations
    ## of files containing function definitions.  The content of these files will
    ## be pre-pended to the code fragment for the cell.

    ## The 'frames' input argument, parsed from json structure like
    ##    [{"name":<name>,"url":<url>},{...}, ...]
    ## will be a list of named-lists.

    ## Retrieve any file contents (will be a list of URLs) and concatenate into string
    allFileContent <- ""
    if (! is.null(files) ) {
        for (url in files) {
            fileContent <- getFileContent(url)
            if (! is.null(fileContent)) {
                allFileContent <- paste0(allFileContent,"\n",fileContent)
            }
        }
    }
    ## get a list of the expected output names from the code
    exportsList <- analyzeCode(code)$exports
    ## executeCode will return a named list of all the evaluated outputs
    debug = ! is.na(Sys.getenv("R_SERVICE_DEBUG", unset=NA))
    outputs <- executeCode(code, frames, hash, allFileContent, debug)
    outputsList <- outputs$returnVars
    ## uploadOutputs will put results onto datastore, and return a dataframe of names and urls
    results <- uploadOutputs(outputsList, exportsList, hash)
    ## text output from executing code
    textOutput <- outputs$outputString
    htmlOutput <- outputs$htmlString
    returnValue <- list(frames=results$frames,
                        figures=results$figures,
                        output=jsonlite::unbox(textOutput),
                        html=jsonlite::unbox(htmlOutput))
    return(jsonlite::toJSON(returnValue))
}

makeURL <- function(name, hash) {
    if (is.na(Sys.getenv("DATASTORE_URI", unset=NA))) {
        return(paste0("http://localhost:7102/",hash,"/",name))
    }
    return(paste0(Sys.getenv("DATASTORE_URI"),"/",hash,"/",name))
}

getNameAndHashFromURL <- function(url) {
    ## split the URL by "/" and take the last two substrings to be hash and name
    charVec <- unlist(strsplit(url, split="/", fixed=TRUE))
    frameName <- charVec[[length(charVec)]]
    cellHash <- charVec[[length(charVec)-1]]
    return(c(frameName, cellHash))
}

getFileContent <- function(url) {
    ## retrieve contents of a file (e.g. containing function definitions) from the datastore
    r <- tryCatch({ GET(url, add_headers(Accept="text/html")) },
       error=function(cond) {
           filenameAndHash <- getNameAndHashFromURL(url)
           return(GET(makeURL(filenameAndHash[[1]], filenameAndHash[[2]]),
                      add_headers(Accept="text/html")))
       }
    )
    if ( r$status != 200) {
        print("Unable to access datastore")
        return(NULL)
    }
    fileContent <- tryCatch({
        content(r, "text")
    }, error = function(cond) {
        print("Unable to read file content from URL as text")
    })

    return(fileContent)
}

readFrame <- function(url) {
    ## Read a dataframe from the datastore.
    ## first, try to decode as apache arrow.
    ## if this fails,  use jsonlite to deserialize json into a data.frame

    r <- tryCatch({ GET(url) },
        error=function(cond) {
            frameNameAndHash <- getNameAndHashFromURL(url)
            return(GET(makeURL(frameNameAndHash[[1]], frameNameAndHash[[2]])))
        }
    )
    if ( r$status != 200) {
        print("Unable to access datastore")
        return(NULL)
    }
    frame <- tryCatch({
        rawData <-content(r, "raw")
        arrowToDataFrame(rawData)
    }, error = function(cond) {
        jsonData <- content(r,"text")
        jsonToDataFrame(jsonData)
    })

    return(frame)
}


arrowToDataFrame <- function(arrowBuffer) {
    temp <- tempfile()
    writeBin(arrowBuffer, temp)
    frame <- as.data.frame(read_arrow(temp))
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
        # hopefully a dataframe that can be converted into Arrow or JSON
        response <- tryCatch({
            frameRaw <- arrowFromDataFrame(frameData)
            PUT(url, body=frameRaw, encode="raw")
        }, error=function(cond) {
            frameJSON <- jsonFromDataFrame(frameData)
            PUT(url, body=frameJSON, encode="json")
        })
        return(status_code(response) == 200)
    }
    ## If we got to here, didn't manage to put frame on the datastore
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


jsonFromImageFile <- function(frameName, cellHash) {
    ## see if there is a png file at /tmp/cellHash/frameName.png
    filename <- file.path(TMPDIR,cellHash,paste0(frameName,".png"))
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

arrowFromDataFrame <- function(frameData) {
    ## ensure everything is a character
    if (is.numeric(frameData)) frameData <- as.character(frameData)
    ## explicitly convert into a dataframe if we can
    frameData <- tryCatch({ as.data.frame(frameData) },
                          error=function(cond) {
                              return(NULL)
                          })
    if (is.null(frameData)) return(NULL)
    ## convert to Arrow, via writing to a tempfile
    temp <- tempfile()
    write_arrow(frameData, temp)
    nBytes <- file.size(temp)
    rawData <- readBin(temp, what="raw", n=nBytes)
    return(rawData)
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


constructFuncString <- function(code, importsList, hash, fileContent,
                                debug=FALSE) {
    ## construct a string containing a function definition wrapping our code.
    ## analyze the code to get imports and exports (only need exports here)
    impexp <- analyzeCode(code)
    ## construct a function that assigns retrieved frames to the imported variables,
    ## then contains the code block.
    stringFunc <- "wrattler_f <- function() {\n"
    ## first paste in the content of any files (e.g. containing func def'ns)
    stringFunc <- paste0(stringFunc,"    ",fileContent,"\n")
    ## Some debugging printout if requested:
    if (debug) {
        stringFunc <- paste0(stringFunc,"    print(paste(Sys.time(), 'Starting to execute code'))\n")
    }
    ## Now read the input frames from the datastore
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
    stringFunc <- paste(stringFunc, "    outputs <- list()\n")
    ## define addOutput function to put html output into the return list
    stringFunc <- paste(stringFunc, "    addOutput <- function(htmlString) {\n")
    stringFunc <- paste(stringFunc, "      outputs$htmlString <<- htmlString\n")
    stringFunc <- paste(stringFunc, "    }\n\n")

    ## now add the code fragment to the function string
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
    stringFunc <- paste(stringFunc,"       outputs$returnVars <- returnVars\n")
    stringFunc <- paste(stringFunc," \n    return(outputs) \n")
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


executeCode <- function(code, importsList, hash, allFileContent="", debug=FALSE) {

    ## Call the function to create stringFunc, then parse and execute it.
    ## Will return a named list:
    ## ret(returnVars=<dataframes>,outputString=<console output>,htmlString=<html output>)
    if (debug) {
        print(paste("Executing code block \n",code))
    }
    stringFunc <- constructFuncString(code, importsList, hash,
                                      allFileContent, debug)

    parsedFunc <- rlang::parse_expr(stringFunc)

    eval(parsedFunc)
    ## capture.output gets the console output from executing the function.
    s <- capture.output(funcOutput <- wrattler_f())

    clean_s <- lapply(s, cleanString)
    outputString <- paste(clean_s, collapse="\n")

    ret <- new.env()
    ret$returnVars <- funcOutput$returnVars
    ret$htmlString <- funcOutput$htmlString
    ret$outputString <- outputString

    return(ret)
}

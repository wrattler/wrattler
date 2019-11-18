library(datadiff)

write("[datadiff] process started, opening input", stderr())
con <- file("stdin")
open(con, blocking=TRUE)

# It should be possible to use just 'readLines("stdin",n=1)'
# but for some reason that does not seem to work when called
# from the AI assistants server in Docker...
readLineByChars <- function() {
  line <- ""
  q <- ""
  code <- 0
  while(code != 10) {
    q <- readChar(con,1)
    if (q != "") {
      code <- utf8ToInt(q)
      if (code != 10) {
        line <- paste0(line, q)
      }
    }
  }
  line
}

parseConstraints <- function(query) {
  clist <- purrr::keep(strsplit(query,"/")[[1]], function(x) { x != "" })
  constraints <- purrr::map(clist, function(c) {
    kind <- substr(c, 1, 1)
    args <- strsplit(substring(c, 2), "-")[[1]]
    if (kind == ".") {
      constraint_match(args[1], args[2])
    } else if (kind == "~") {
      constraint_nomatch(args[1], args[2])
    } else if (kind == "-") {
      constraint_notransform(args[1])
    } else stop("Unexpected constraint kind.")
  })
  constraints
}

getCleanData <- function(constraints, dfclean, dfmessy) {
  write("[datadiff] running datadiff to transform data - this may take time", stderr())
  p <- ddiff(dfmessy, dfclean, constraints=constraints)
  write("[datadiff] returning data", stderr())
  p(dfmessy)
}

printCompletions <- function(query, constraints, dfclean, dfmessy) {
  write("[datadiff] running datadiff to get completions - this may take time", stderr())
  p <- ddiff(dfmessy, dfclean, constraints=constraints)

  write("[datadiff] generating completions", stderr())
  nsc = names(dfclean)
  nsd = names(dfmessy)
  nsp = names(p(dfmessy))
  pp <- decompose_patch(p)

  for(i in 1:length(pp)) {
    typ <- patch_type(pp[[i]])
    if (typ == "recode" || typ == "rescale" || typ == "scale" || typ == "shift") {
      col <- nsd[[get_patch_params(pp[[i]])$cols]]
      cat(paste0("Don't transform '", col, "'\n"))
      cat(paste0(query, "/-", col, "\n"))
    }
  }

  for(i in 1:length(names(dfclean))) {
    cat(paste0("Don't match '", nsp[[i]], "' and '", nsc[[i]], "'\n"))
    cat(paste0(query, "/~", nsp[[i]], "-", nsc[[i]], "\n"))
  }

  for(i in 1:length(names(dfmessy))) {
    for(j in 1:length(names(dfclean))) {
      cat(paste0("Match '", nsd[[i]], "' and '", nsc[[j]], "'\n"))
      cat(paste0(query, "/.", nsd[[i]], "-", nsc[[j]], "\n"))
    }
  }
}

while(TRUE) {
  write("[datadiff] waiting for inputs, commands, query", stderr())
  inputs <- readLineByChars()
  cmd <- readLineByChars()
  query <- readLineByChars()
  write(paste0("[datadiff] got '", cmd, "' request with inputs '", inputs, "'"), stderr())
  write(paste0("[datadiff] current query '", query, "'"), stderr())

  inparr = strsplit(inputs, ",")
  files <- purrr::map(inparr[[1]], function(x) {
    kvp <- strsplit(x, "=")
    list(key=kvp[[1]][1], value=kvp[[1]][2]) })
  dirty <- read.csv(purrr::keep(files, function(x) { x$key == "dirty" })[[1]]$value)
  clean <- read.csv(purrr::keep(files, function(x) { x$key == "clean" })[[1]]$value)

  constraints = parseConstraints(query)

  if (cmd == "completions") {
    printCompletions(query, constraints, clean, dirty)
    cat("\n")
  } else {
    f <- tempfile()
    df <- getCleanData(constraints, clean, dirty)
    write.csv(df, file=f)
    cat(paste0(f,"\n"))
  }
}

close(con)

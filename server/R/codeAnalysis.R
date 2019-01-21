library(codetools)

# The following will export all names defined in all visible packages
# (when we get all variables that appear in a syntax tree of an R code,
# we can then filter out all of these, because they are referring to
# some library name, rather than to an imported data frame)
knownNames <- c()
for(pkg in search()) {
  knownNames <- c(knownNames, ls(pkg))
}
knownNames

# Returns an environment with `exports` and `imports` of a given expression
# This uses `makeCodeWalker` from `codetools` to walk over the expression and
# it looks for imports (i.e. names not defined locally and not in `knownNames`)
# and exports (i.e. names that appear on the left of <-).
getImportsExports <- function(e) {
  res <- new.env()
  res$imports <- c()
  res$exports <- c()
  w <- makeCodeWalker(call=impexpCall, leaf=impexpLeaf, res=res)
  walkCode(e, w)

  # Remove imports that are defined locally in the expression (i.e. are exports)
  realImports <- c()
  for(i in res$imports)
    if (!i %in% res$exports) realImports <- c(realImports, i)
  res$imports <- realImports
  res$exports <- unique(res$exports)
  res
}
impexpCall <- function(e, w) {
  el <- as.list(e)
  # if the expression is <name> <- <whatever>, add <name> to exports
  if ((as.character(el[[1]]) == "<-" || as.character(el[[1]]) == "=") && class(el[[2]]) == "name") {
    w$res$exports <- c(w$res$exports, as.character(el[[2]]))
  }
  for (a in el) walkCode(a, w)
}
impexpLeaf <- function(e, w) {
  if (typeof(e) == "symbol") {
    c <- as.character(e)
    # if we found symbol that's not in knownNames and not already
    # in the list of imports, add it!
    if (!c %in% knownNames && !c %in% w$res$imports)
      w$res$imports <- c(w$res$imports, c)
  }
}

## we will get the code as a sting - we want to use quote({ code })
## to get the list of names, so add this to the string, and then
## parse it, and eval the resulting expression

prepCodeString <- function(inputString) {
    ## target of 'quote' needs to be a unique name..
    codeToParse <- paste("wrattlerParsedCode <- quote({",inputString,"})")
    tmpExpression <- parse(text=codeToParse)
    eval(tmpExpression)
    return(wrattlerParsedCode)
}

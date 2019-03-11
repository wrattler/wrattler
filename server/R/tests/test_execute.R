
## test that code execution works as expected

library(testthat)

context("executing code fragments")

source("../R_service.R", chdir=T)


test_that("We can execute a simple assignment", {
    code <- "x <- 3+4 \n"
    importsList <- c()
    hash <- "somehash"
    result <- executeCode(code, importsList, hash)
    expect_that(result$returnVars[[1]] == 7,equals(TRUE))
})

test_that("We can assign a dataframe", {
    code <- 'myDF <- data.frame(name=c("Johny"), age=c(53))'
    importsList <- c()
    hash <- "somehash"
    result <- executeCode(code, importsList, hash)
    expect_that(typeof(result$returnVars$myDF)=="list", equals(TRUE))
    expect_that(result$returnVars$myDF$name[[1]]=="Johny", equals(TRUE))
    expect_that(result$returnVars$myDF$age[[1]]==53, equals(TRUE))

})

test_that("We can retrieve text output", {
    code <- "print('hello world') \n"
    importsList <- c()
    hash <- "somehash"
    result <- executeCode(code, importsList, hash)
    expect_that(result$outputString, equals("hello world"))
})

test_that("We can retrieve multiple text outputs", {
    code <- "print('hello world') \n print('hello again!') \n"
    importsList <- c()
    hash <- "somehash"
    result <- executeCode(code, importsList, hash)
    expect_that(result$outputString, equals("hello world\nhello again!"))
})

test_that("We can produce a plot", {
    hash <- "testhash"
    unlink(file.path("/tmp",hash),recursive=TRUE)
    code <- "library(ggplot2)\nplt <- ggplot(mpg,aes(x=class))+geom_bar() \n"
    importsList <- c()
    result <- executeCode(code, importsList, hash)
    expect_that(file.exists(file.path("/tmp",hash,"plt.png")), equals(TRUE))
})


test_that("We can execute code containing a function", {
    hash <- "testfunc"
    importsList <- c()
    code <- " x <- 3\n y <- 4\n adder <- function(a,b) {\n  return(a+b)\n }\n z <- adder(x,y)\n"
    result <- executeCode(code, importsList, hash)
    expect_that(result$returnVars[[4]]==7,equals(TRUE))
})

test_that("We can execute code with an inline function", {
    hash <- "testfunc2"
    importsList <- c()
    code <- "rounder <- function(a) round(a, digits=3)\ny<-rounder(3.14159)\n"
    result <- executeCode(code, importsList, hash)
    expect_that(result$returnVars[[2]]==3.142,equals(TRUE))

})

test_that("We can execute code containing a function with assignments inside", {
    hash <- "testfunc"
    importsList <- c()
    code <- " x <- 3\n y <- 4\n adder <- function(a,b) {\n  aa <- 2*a\n bb<- 2*b\n return(aa+bb)\n }\n z <- adder(x,y)\n"
    result <- executeCode(code, importsList, hash)
    expect_that(result$returnVars[[4]]==14,equals(TRUE))
})


test_that("The 'partial' function works as expected", {
    hash <- "testhash"
    code <- "library(purrr)\n pmean <- partial(mean, na.rm=TRUE)\n x <- pmean(3,4,5)\n"
    importsList <- c()
    result <- executeCode(code, importsList, hash)
    expect_that(result$returnVars[[2]]==3, equals(TRUE))
})

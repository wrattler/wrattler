
## test that code execution works as expected

library(testthat)

context("executing code fragments")

source("../R_service.R", chdir=T)


test_that("We can execute a simple assignment", {
    code <- "x <- 3+4 \n"
    importsList = c()
    result <- executeCode(code, importsList)
    expect_that(result$returnVars[[1]] == 7,equals(TRUE))
})


test_that("We can retrieve text output", {
    code <- "print('hello world') \n"
    importsList = c()
    result <- executeCode(code, importsList)
    expect_that(result$outputString, equals("hello world"))
})

test_that("We can retrieve nultiple text outputs", {
    code <- "print('hello world') \n print('hello again!') \n"
    importsList = c()
    result <- executeCode(code, importsList)
    expect_that(result$outputString, equals("hello world\nhello again!"))
})

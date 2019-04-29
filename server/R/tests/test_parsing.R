## test functions converting between json and dataframes

library(testthat)

context("parsing code fragments")

source("../R_service.R", chdir=T)

test_that("imports and exports are correctly identified from a simple assignment", {
    impExpEnv <- analyzeCode("myNewDataFrame <- anExistingDataFrame")
    expect_that(impExpEnv$imports[[1]] == "anExistingDataFrame",equals(TRUE))
    expect_that(impExpEnv$exports[[1]] == "myNewDataFrame",equals(TRUE))
})

test_that("we can identify imports even when they have a 'known' name", {
    frames <- c("df")
    impExpEnv <- analyzeCode("myNewDataFrame <- df", frames)
    expect_that(impExpEnv$imports[[1]] == "df",equals(TRUE))
    expect_that(impExpEnv$exports[[1]] == "myNewDataFrame",equals(TRUE))
})


test_that("We can parse code that takes subset of a DF using subset method", {
    impExpEnv <- analyzeCode("subs <- subset(input_df, input_df$somevar < 10)")
    expect_that(impExpEnv$imports[[1]] == "input_df",equals(TRUE))
    expect_that(impExpEnv$exports == "subs",equals(TRUE))
})

test_that("Imports only appear once", {
    code <- "x <- a+b\ny <- a + d"
    impExpEnv <- analyzeCode(code)
    expect_that(base::table(impExpEnv$imports)[["a"]],equals(1))

})


test_that("Exports only appear once", {
    code <- "x <- a+b\nx <- c + d"
    impExpEnv <- analyzeCode(code)
    expect_that(base::table(impExpEnv$exports)[["x"]],equals(1))

})

## FOLLOWING TEST WILL FAIL UNLESS WE CAN FIX/REPLACE CODETOOLS WALKCODE

#test_that("We can parse code that takes subset of a DF using a trailing comma", {
#    impExpEnv <- analyzeCode("subs <- input_df[ input_df$somevar < 10, ]")
#    expect_that(impExpEnv$imports[[1]] == "input_df",equals(TRUE))
#    expect_that(impExpEnv$exports == "subs",equals(TRUE))
#})

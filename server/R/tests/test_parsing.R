## test functions converting between json and dataframes

library(testthat)

context("parsing code fragments")

source("../R_service.R", chdir=T)


test_that("We can parse code that takes subset of a DF using subset method", {
    impExpEnv <- analyzeCode("subs <- subset(input_df, input_df$somevar < 10)")
    expect_that(impExpEnv$imports[[1]] == "input_df",equals(TRUE))
    expect_that(impExpEnv$exports == "subs",equals(TRUE))
})

## FOLLOWING TEST WILL FAIL UNLESS WE CAN FIX/REPLACE CODETOOLS WALKCODE

#test_that("We can parse code that takes subset of a DF using a trailing comma", {
#    impExpEnv <- analyzeCode("subs <- input_df[ input_df$somevar < 10, ]")
#    expect_that(impExpEnv$imports[[1]] == "input_df",equals(TRUE))
#    expect_that(impExpEnv$exports == "subs",equals(TRUE))
#})

## test functions converting between json and dataframes

library(testthat)

context("imports and exports")

source("../R_service.R", chdir=T)

test_that("We can convert from JSON to a dataframe", {
    expect_that(is.data.frame(jsonToDataFrame('[{"name":"Bob","age":32},{"name":"Bob","age":32}]')),equals(TRUE))

})

test_that("We can convert from a dataframe back to JSON", {
    df <- data.frame(name=c("Alice","Bob"), age=c(22,33))
    expect_that(!is.null(jsonFromDataFrame(df)),equals(TRUE))

})

test_that("We can convert from JSON to dataframe back to JSON", {
    jsonString <- '[{"name":"Bob","age":32},{"name":"Bob","age":32}]'
    df <- jsonToDataFrame(jsonString)
    newJson <- jsonFromDataFrame(df)
    expect_that(jsonString==newJson,equals(TRUE))

})

test_that("We can convert from dataframe to JSON to dataframe", {
    df <- data.frame(name=c("Alice","Bob"), age=c(22,33))
    jsonString <- jsonFromDataFrame(df)
    newDf <- jsonToDataFrame(jsonString)
    expect_that(length(colnames(df))==length(colnames(newDf)),equals(TRUE))
    expect_that(nrow(df)==nrow(newDf),equals(TRUE))
    for (col in colnames(df)) {
        for (row in 1:nrow(df)) {
            expect_that(df[[col]][[row]]==newDf[[col]][[row]],equals(TRUE))
        }
    }

})

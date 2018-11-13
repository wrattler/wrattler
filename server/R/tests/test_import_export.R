## test functions converting between json and dataframes

library(testthat)

context("imports and exports")

source("../R_service.R", chdir=T)

## test whether two dataframes have the same column headings, same number of rows, and same values
dfSame <- function(df1, df2) {
    expect_that(length(colnames(df1))==length(colnames(df2)),equals(TRUE))
    expect_that(nrow(df1)==nrow(df2),equals(TRUE))
    for (col in colnames(df1)) {
        for (row in 1:nrow(df1)) {
            if (df1[[col]][[row]]!=df2[[col]][[row]]) return(FALSE)
        }
    }
    return(TRUE)
}


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
    expect_that(dfSame(df,newDf), equals(TRUE))
})

test_that("We get null in the json when we have missing values", {
    df <- data.frame(name=c("Alice","Bob"), age=c(NA,33))
    jsonString <- jsonFromDataFrame(df)
    expect_that(grepl("null",jsonString), equals(TRUE))
})


test_that("We get NA in the dataframe when we have null in the JSON", {
    jtest <- '[{"name":"Bob","age":32},{"name":"Andrea","age":null}]'
    df <- jsonToDataFrame(jtest)
    expect_that(is.na(df[["age"]][[2]]), equals(TRUE))
})

test_that("We get null in the json when we have NaN values", {
    df <- data.frame(name=c("Alice","Bob"), age=c(21,0/0))
    expect_that(is.nan(df[["age"]][[2]]), equals(TRUE))
    jsonString <- jsonFromDataFrame(df)
    expect_that(grepl("null",jsonString), equals(TRUE))
})


test_that("We can convert from a list to JSON", {
    test_list <- c("a","b","c","d")
    jsonString <- jsonFromDataFrame(test_list)
    expect_that(is.null(jsonString), equals(FALSE))
    test_df <- jsonToDataFrame(jsonString)
    newJson <- jsonFromDataFrame(test_df)
    expect_that(jsonString == newJson, equals(TRUE))
})

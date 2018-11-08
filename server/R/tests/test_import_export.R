## test functions converting between json and dataframes

library(testthat)

context("imports and exports")

source("../R_service.R", chdir=T)

test_that("We can convert from JSON to a dataframe", {
    expect_that(is.data.frame(jsonToDataFrame('[{"name":"Bob","age":32},{"name":"Bob","age":32}]')),equals(TRUE))

})

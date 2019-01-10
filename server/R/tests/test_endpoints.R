
## test that code execution works as expected

library(testthat)
library(httptest)

context("testing endpoints")

source("../R_service.R", chdir=T)

#test_that("We can execute a simple assignment", {
#    code <- "x <- 3+4 \n"
#    importsList <- c()
#    hash <- "somehash"
#    result <- executeCode(code, importsList, hash)
#    expect_that(result$returnVars[[1]] == 7,equals(TRUE))
#})



with_mock_api({
    test_that("We can handle exports with trivial code fragment", {
        code <- "x  <- y + z"
        frames <- c()
        hash <- "testhash"
        impExpJSON <- handle_exports(code,frames,hash)
        print(impExpJSON)
        expect_that(impExpJSON=='{"imports":[],"exports":["x"]}',
#                    (impExpJSON=='{"exports":["x"],"imports":[]}'),
                    equals(TRUE))
#        expect_is(
 #           GET("http://httpbin.org/response-headers",
  #              query=list(`Content-Type`="application/json")),
   #         "response"
    #    )

    })
})

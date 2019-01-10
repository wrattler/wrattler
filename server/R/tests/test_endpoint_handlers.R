
## test that code execution works as expected

library(testthat)
library(httptest)

context("testing endpoints")

source("../R_service.R", chdir=T)


with_mock_api({
    test_that("We can handle exports with trivial code fragment", {
        code <- "x  <- y + z"
        frames <- c()
        hash <- "testhash"
        impExpJSON <- handle_exports(code,frames,hash)
        print(impExpJSON)
        expect_that(impExpJSON=='{"imports":["y","z"],"exports":["x"]}',
                    equals(TRUE))
    })
    test_that("We can handle eval with trivial code fragment", {
        code <- "x  <- 2 + 3"
        frames <- c()
        hash <- "testhash"
        expect_PUT(
            output <- handle_eval(code,frames,hash),body='[{"frameData":"5"}]',
            paste0(Sys.getenv("DATASTORE_URI"),"/",hash,"/x")
        )
    })

})

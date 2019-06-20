
## test that code execution works as expected

library(testthat)
library(httptest)

context("testing endpoints")

source("../R_service.R", chdir=T)

if (is.na(Sys.getenv("DATASTORE_URI", unset=NA))) {
    DATASTORE_URI <- "http://localhost:7102"
} else {
    DATASTORE_URI <- Sys.getenv("DATASTORE_URI")
}


set_requester(function (request) {
    gsub_request(request, DATASTORE_URI, "tests/samples")
})


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
#        files <- c()
        expect_PUT(
            output <- handle_eval(code,frames,hash),body='[{"frameData":"5"}]',
            paste0(DATASTORE_URI,"/",hash,"/x")
        )
    })
    test_that("We can PUT a plot onto the datastore", {
        code <- "library(ggplot2)\nplt <- ggplot(mpg,aes(x=class))+geom_bar() \n"
        frames <- c()
        hash <- "testhashplot"
        expect_PUT(
            output <- handle_eval(code,frames,hash),
            url=paste0(DATASTORE_URI,"/",hash,"/plt")
        )
    })

#    test_that("We can handle eval retrieving previous dataframes", {
#        code <- "joinDF <- rbind(df1,df2)"
#        hash <-"testhash3"

 #       f1 <- list(name="df1",url=paste0(Sys.getenv("DATASTORE_URI"),"/dummy1/df1"))
 #       f2 <- list(name="df2",url=paste0(Sys.getenv("DATASTORE_URI"),"/dummy2/df2"))
 #       frames <- list(f1,f2)
 #       df1 <- readFrame(frames[[1]]$url)
 #       expect_that(df1[["name"]] == "Alice",equals(TRUE))
                                        #        expect_PUT(
#            output <- handle_eval(code,frames,hash)
 #       )
  #  })

})

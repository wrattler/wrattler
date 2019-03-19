# Welcome to the Wrattler datadiff demo

*datadiff* is a helper tool that can ascertain whether columns in 2 different
dataframes are drawn from the same distribution.



```r
library(datadiff)
library(tibble)
broadband2013[["ID"]][broadband2013[["ID"]] == "FTTC"] <- NA
broadband2013$ID <- as.integer(broadband2013$ID)
strip_non_numeric <- function(x) { gsub("[^0-9\\.]", "", x) }
broadband2013[["Headline.speed"]] <- as.integer(strip_non_numeric(broadband2013[["Headline.speed"]]))
broadband2013[["Packet.loss....24.hour"]] <- as.numeric(strip_non_numeric(broadband2013[["Packet.loss....24.hour"]]))
broadband2013[["Packet.loss....8.10pm.weekday"]] <- as.numeric(strip_non_numeric(broadband2013[["Packet.loss....8.10pm.weekday"]]))
result <- ddiff(broadband2014, broadband2013)
print(result)
```

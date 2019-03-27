# Joining data using datadiff

Tabular data sets are common, and many data processing tasks must be repeated on multiple similar data samples. In practice, however, there may be unexpected changes in structure across different batches of data, which are likely to break the analytical pipeline.
Datadiff identifies structural differences between pairs of (related) tabular data sets and returns an executable summary (or "patch") which is both a description of the differences and a corrective transformation.

The following example runs datadiff on two dataframes that contain information about broadband quality in the UK for years 2013 and 2014.
First, we do a small amount of preliminary data formatting, so that numeric columns are correctly parsed as numeric:

```r
library(tibble)
library(datadiff)

bb2013 <- broadband2013
bb2014 <- broadband2014

stripnn <- function(x) { gsub("[^0-9\\.]", "", x) }

bb2013[["ID"]][bb2013[["ID"]] == "FTTC"] <- NA
bb2013$ID <- as.integer(bb2013$ID)
bb2013[["Headline.speed"]] <-
  as.integer(stripnn(bb2013[["Headline.speed"]]))
bb2013[["Packet.loss....24.hour"]] <-
  as.numeric(stripnn(bb2013[["Packet.loss....24.hour"]]))
bb2013[["Packet.loss....8.10pm.weekday"]] <-
  as.numeric(stripnn(bb2013[["Packet.loss....8.10pm.weekday"]]))
```

Now we can invoke datadiff! Calling `ddiff(bb2014, bb2013)` gives you a patch that describes how to turn data in
`bb2014` into the same format as the one used by `bb2013`. We can print the patch to see what datadiff inferred
and apply the patch to get a reformatted dataframe:

```r
library(datadiff)

patch <- ddiff(bb2014, bb2013)
bb2014nice <- patch(bb2014)
print(patch)
```

# Welcome to Wrattler
### This is an attempt to load an data file in R, manipulate it a bit, and output multiple (two, really) dataframes that will be used for some analysis in Python.

```r

library(purrr)
library(cleanEHR)
# full dataset

file <- paste(tempdir(), "/ccd.rdata", sep="")
download.file("https://github.com/ropensci/cleanEHR/raw/master/data/sample_ccd.RData", file)
load(file)

dt <- ccd_demographic_table(ccd, dtype=TRUE)
names_ts_variables <- c()
counter <- 1
for (i in 1:length(ccd@episodes)){
  for (n in names(ccd@episodes[[i]]@data)){
    if (length(ccd@episodes[[i]]@data[n][[1]]) == 2){ # guarantee time series
      names_ts_variables[[counter]] <- n
      counter <- counter+1
    }
  }
}
names_ts_variables <- sort(unique(names_ts_variables))
short_names_ts_variables <- lapply(names_ts_variables, FUN = code2stname)

index_variable <- "NIHR_HIC_ICU_0005"
# prepare lists of measurements from time series
ts_measures <- c("mean","1st_quartile","median","3rd_quartile")
ts_measures_funcs <- c(partial(mean,na.rm=TRUE),partial(quantile,probs=c(0.25),na.rm=TRUE),partial(quantile,probs=c(0.5),na.rm=TRUE),partial(quantile,probs=c(0.75),na.rm=TRUE))
names_for_dts <- c("ADNO")
for (sn in short_names_ts_variables){
  for (mes in ts_measures){
    names_for_dts <- append(names_for_dts,paste(sn,mes,sep = "_"))
  }
}
dts <- data.frame(matrix(NA, nrow=0, ncol=length(names_for_dts)))
names(dts) <- names_for_dts

for (i in 1:length(ccd@episodes)){
  adno <- as.numeric(ccd@episodes[[i]]@data[index_variable][[1]])
  measurements <- c(adno)
  for (n in names_ts_variables){
    if (!is.null(ccd@episodes[[1]]@data[n][[1]])){
      for (measure in ts_measures_funcs){
        measurements <- c(measurements,measure(as.numeric(ccd@episodes[[i]]@data[n][[1]]["item2d"][[1]]))[[1]])
      }
    } 
  }
  dts <- rbind(dts,measurements)
}
```

That should hopefully have written dataframes called `dt` and `dts` to the data store.

```python
demographicHeaders = list(dt)
timeSeriesHeaders = list(dts)
```

`list(dt)` does not return the headers of the dataframe. Instead it returns the entire dataframe again. 

```python
dtf = dtPython.merge(dtsPython, left_on='ADNO', right_on='ADNO', how='inner')
```


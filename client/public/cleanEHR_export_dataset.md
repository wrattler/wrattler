# Welcome to Wrattler
This is an attempt to load an data file in R, manipulate it a bit, and output a dataframe that will be used
for some analysis in Python.

Change the data_folder path to point to where the anon_public1000.RData file is stored.

```r

library(purrr)
library(cleanEHR)
# full dataset

file <- paste(tempdir(), "/ccd.rdata", sep="")
download.file("https://github.com/ropensci/cleanEHR/raw/master/data/sample_ccd.RData", file)
load(file)

#dt <- ccd_demographic_table(anon_ccd, dtype=TRUE)
dt <- ccd_demographic_table(ccd, dtype=TRUE)

```

That should hopefully have written a dataframe called dt to the data store.

```r

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

```

```r
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

```

Prepare TS dataset

```r
for (i in 1:length(anon_ccd@episodes)){
  adno <- as.numeric(anon_ccd@episodes[[i]]@data[index_variable][[1]])
  measurements <- c(adno)
  for (n in names_ts_variables){
    if (!is.null(anon_ccd@episodes[[1]]@data[n][[1]])){
      for (measure in ts_measures_funcs){
        measurements <- c(measurements,measure(as.numeric(anon_ccd@episodes[[i]]@data[n][[1]]["item2d"][[1]]))[[1]])
      }
    } else {
      measurements <- c(measurements,rep(NA,length(ts_measures)))
    }
  }
  dts <- rbind(dts,measurements)
  names(dts) <- names_for_dts
}
```

dts should now be a dataframe that we can use in Python...
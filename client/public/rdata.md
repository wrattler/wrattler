# Accessing sample R datasets

One of the easiest way of getting interesting sample data is to load the pre-defined R datasets.
This notebook shows how to do that and also how to access those data frames from JavaScript
and Python.

Sample R data frames are directly available in the environment, but if we want to access them
from other languages, we have to re-export them by assigning them to a new variable. You can
also use the same trick to access the sample broadband dataset:

```r
library(datadiff)

bb2013 <- broadband2013
bb2014 <- broadband2014
bb2015 <- broadband2015
irisdata <- iris
mtcarsdata <- mtcars
```

In JavaScript, the dataframes will appear as arrays of records (with property names matching the
column names of the R data frame).

```javascript
addOutput(function(id) {
  var out = "";
  out += "Sample datasets\n"
  out += " * Number of rows of bb2013: " + bb2013.length + "\n";
  out += " * Number of rows of bb2014: " + bb2014.length + "\n";
  out += " * Number of rows of bb2015: " + bb2015.length + "\n";
  out += " * Number of rows of irisdata: " + irisdata.length + "\n";
  out += " * Number of rows of mtcarsdata: " + mtcarsdata.length + "\n";

  out += "\nSome values in the datasets\n"
  out += " * Service name from the first bb2015 row: " + bb2015[0].Pack_number + "\n";
  out += " * Name of the car from the first mtcarsdata row: " + mtcarsdata[0]._row + "\n";

  document.getElementById(id).innerHTML = "<pre style='margin-top:10px'>" + out + "</pre>"
})
```

In Python, the dataframes will appear as pandas dataframes and you can use the usual pandas functions
for working with them.

```python
print("Sample datasets")
print(" * Number of rows of bb2013: ", len(bb2013));
print(" * Number of rows of bb2014: ", len(bb2014));
print(" * Number of rows of bb2015: ", len(bb2015));
print(" * Number of rows of irisdata: ", len(irisdata));
print(" * Number of rows of mtcarsdata: ", len(mtcarsdata));

grouped = mtcarsdata.groupby('cyl', as_index=False).agg({"mpg": "mean"})
```

# Is broadband in rural areas getting better?

The internet in urban areas in the UK is better than internet in rural areas, but how does
this change between consecuitve years? Does the internet in rural areas get better faster, 
or not? In this notebook, we analyse the difference between rural and urban areas and we 
explore whether the situation got better between 2014 and 2015. To do this, we use dataset 
on UK broadband speed [published by Ofcom](https://www.ofcom.org.uk/research-and-data/telecoms-research/broadband-research).

### Exploring broadband speed

First, we look at the difference in broadband quality between 2014 and 2015. The two Ofcom
datasets are included as samples in the `datadiff` package, so we get the two data frames
from there. If you look at the previews, you'll see that they use different structure, which
is something we'll need to address later.

For now, we use R to load the data and then build a simple visualization of average download
speed in rural and urban areas for years 2014 and 2015 using the JavaScript [Plotly library](http://plot.ly).
The visualization shows that internet in 2015 got faster in rural areas and slower in urban areas:

```r
library(datadiff)
bb2014 <- broadband2014
bb2015 <- broadband2015
```

```javascript
function averageBy(name, keycol, valcol, data, keys) {
  var res = {}
  for(var row of data) res[row[keycol]] = 0;  
  for(var row of data) res[row[keycol]] += row[valcol];
  return {
    x: keys,
    y: keys.map(function(k) { return res[k] / data.length; }),
    name: name, type: 'bar'
  };
}

addOutput(function(id) {
  var trace1 = averageBy("Broadband 2014", "Urban.rural", 
    "Download.speed..Mbit.s..Max", bb2014, ["Urban", "Rural"]);
  var trace2 = averageBy("Broadband 2015", "URBAN2", 
    "DL24hrmax", bb2015, ["Urban", "Rural"]);
  Plotly.newPlot(id, [trace1, trace2], {barmode: 'group'});
})
```

###  Joining broadband data from two years

Now that we have a basic idea about our data, we want to clean the two datasets so that we 
can do a more rigorous statistical analysis. To make the analysis simpler, we will only look 
at some of the columns, but the challenge here is finding matching columns in the two datasets.
We first select columns that we are interested in from the `bb2014` dataset and create a new
nice dataset `bb2014nice`:

```r
bb2014nice <- bb2014[c("Download.speed..Mbit.s..24.hrs",
  "Upload.speed..Mbit.s.24.hour","Latency..ms.24.hour", 
  "Web.page..ms.24.hour", "Urban.rural")]
names(bb2014nice) <- c("Down", "Up", "Latency", "Web", "Urban")
```

As we saw earlier, the 2015 dataset uses a different structure than the 2014 dataset. If we want to 
run any analysis, we need to restructure the datasets to use the same format. This is a typical 
example of tedious task that can be automated by an AI assistant. In this case, we can use the
`datadiff` package through R. 

In the following, we ask R to create a patch that will turn data in the format used by `bb2015`
into the format used by `bb2014nice` and then we apply the patch to obtain a nice 2015 dataset.
Note that datadiff does not automatically rename the column names - this is useful as it lets us
check if we got the right results.

```r
library(datadiff)
patch <- ddiff(bb2015, bb2014nice)
bb2015nice <- patch(bb2015)
print(patch)
```

### Analysing broadband change in rural areas

Next, we would like to perform simpel statistical analysis to asses if the change of interenet
speed depends on whether you are in a local or rural area. For this, we need to use some of the
statistical libraries provided by R. 

The following snippet implements the [difference in differences (DID) model](https://en.wikipedia.org/wiki/Difference_in_differences).
We build a linear regression model that models the dependence of download speed on three factors:

 - Whether the area is urban or rural
 - Whether the year is 2014 or 2015
 - A combined factor of both area kind and year

The internet speed will certainly depend on the first two, but it is interesting to see if it
also depends on the third one. If so, it tells us that the change of speed varies between the
two kinds of areas. 

```r
library(dplyr)
names(bb2015nice) <- names(bb2014nice)

bball <- rbind(bb2014nice, bb2015nice)
bball$Year <- c(rep(2014, nrow(bb2014)), rep(2015, nrow(bb2015nice)))
bball <- bball %>%
  mutate(IsRural = ifelse(Urban == "Urban", 0, 1),
          YearAfter = ifelse(Year == 2014, 0, 1))

did_model <- lm(Down ~ IsRural + YearAfter + IsRural*YearAfter, data = bball)
print(summary(did_model))
```

### Building rich data visualizations

Finally, we would like to build a data visualization that shows whether the internet
speed in rural areas has improved. Did the quality of internet in rural areas improve
between 2014 and 2015 to reach the quality in urban areas? To do this, we build a 
statistical model that predicts whether an area is rural or urban based on internet
quality data from the year 2014. We then run this on data from 2015 and we will see
how many of the areas got internet connection that would be classified as urban in 2014.
To do the modelling, we use generalised linear models in R:

```r
names(bb2015nice) <- names(bb2014nice)
training <- bb2014nice %>% mutate(Urban = ifelse(Urban=="Urban", 1, 0))
test <- bb2015nice %>% mutate(Urban = ifelse(Urban=="Urban", 1, 0)) 

model <- glm(Urban ~.,family=binomial(link='logit'),data=training)
pred <- predict(model, test, type="response") %>% round
pred[is.na(pred)] <- 0.5

combined <- data.frame(Urban=pred, ActualUrban=test$Urban, Ones=rep(1,length(pred)))
viz <- aggregate(combined$Ones, by=list(combined$ActualUrban, combined$Urban), FUN=sum)
colnames(viz) <- c("Actual", "Predicted", "Count")
```

Next, we build the data visualization. To do this we use the popular
[JavaScript library D3](https://d3js.org/). We create a sankey chart that
shows the change as a flow. On the left, we actual 2015 data and on the right,
we have an indicator of whether an area is rural or urban as predicted by our
2014 model.

```javascript
function lookup(act, pred) {
  for(var i = 0; i < 4; i++) 
    if (viz[i].Actual == act && viz[i].Predicted == pred) return viz[i].Count;
}

function render(id) {
  var color1d = "#8dd3c7", color2d = "#bebada";
  var color1l = "#bddfd9", color2l = "#d5d3e2";
  var json = {
    "nodes": [
      {"name":"Rural (reported 2015)", "color":color1d}, 
      {"name":"Urban (reported 2015)", "color":color2d},
      {"name":"Rural (classified by 2014)", "color":color1d}, 
      {"name":"Urban (classified by 2014)", "color":color2d}
    ],
    "links": [
      {"source":0,"target":2,"value":lookup(0, 0),"color":color1l},
      {"source":1,"target":2,"value":lookup(1, 0),"color":color1l},
      {"source":0,"target":3,"value":lookup(0, 1),"color":color2l},
      {"source":1,"target":3,"value":lookup(1, 1),"color":color2l}
    ]
  };
  
  document.getElementById(id).style = "height:300px;width:80%;padding:10px 10% 10px 10%";
  d3.select("#" + id).append("svg").chart("Sankey.Path")
    .name(function(node) { return node.name; })
    .colorNodes(function(name, node) { return node.color || "#9f9fa3"; })
    .colorLinks(function(link) { return link.color || "#9f9fa3"; })
    .nodeWidth(50).nodePadding(30).draw(json);
}
addOutput(render)
```
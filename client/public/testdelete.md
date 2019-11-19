# Testing the Broken Window hypothesis: are less scenic neighbourhoods linked to more crime?
## Crime data
The first dataset we import is the [MPS LSOA Level Crime (historic)](https://data.london.gov.uk/dataset/recorded_crime_summary) dataset.

```javascript
(function() { 
  var scr = document.createElement("script");
  scr.setAttribute("src", "https://d3js.org/d3.v3.min.js");
  document.head.appendChild(scr);
})()
```

```javascript
addOutput(function(el) { 
    document.getElementById(el).innerHTML = 
      "<style>.bar { fill: steelblue; } .bar:hover { fill: orange; } </style>";

    var data = [150, 230, 180, 90];
    var svg = 
        d3.select("#" + el).append("svg").attr("width", 300).attr("height", 200);
    svg.selectAll(".bar").data(data)
        .enter().append("rect").attr({
            class : "bar",
            width : function(d) {return d;},
            height: "40",
            y : function(d, i) {return i*50 + 10;},
            x : "10"
        });
});
```

```r
 r1 <- data.frame(id = 1, language ="r")
```


```python
 two = pd.DataFrame({"name":["Jim"], "age":[51]})
```


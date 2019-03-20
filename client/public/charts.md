# Data visualization with Wrattler

You can use a wide range of data visualization tools with Wrattler using the
native programming language that they were built for. If you are using Python,
you can use Matplotlib, if you are using R then you can use ggplot2 and if you
are writing code in JavaScript, you can use Plotly, D3 and many others.
This notebook shows some of the options.

### Matplotlib using Python

The following example creates a simple matplotlib plot in in Python.  
Note that we need to use the convention demonstrated here for importing pyplot as `plt`
and numpy as `np`. The following draws a sine wave:

```python
import matplotlib.pyplot as plt
import numpy as np  

def draw(): 
  t = np.arange(0.0, 2.0, 0.01)
  s = np.sin(2*np.pi*t)
  plt.clf()
  plt.plot(t,s)  
  plt.xlabel('time (s)')  
  plt.ylabel('voltage (mV)')
  plt.grid(True)
  
draw()  
```

### ggplot2 using R

Next, we create a ggplot2 in R. Note that we need to assign the plot to a variable
so that Wrattler can detect it and display it. Here, we look at sample R dataset
about irises:

```r
library(ggplot2)

names(iris) <- c("Sepal.Length", "Sepal.Width", 
  "Petal.Length", "Petal.Width", "Species")
p <- 
  ggplot(iris, aes(x = Sepal.Length, y = Petal.Length)) +
  geom_point(aes(color = Species))
```

### Plotly using JavaScript

Finally, if you are using JavaScript, you can import a wide range of data visualization
libraries. Here, we use Plotly, which is already packaged with Wrattler. The following 
demo adapts a financial chart example from the [Plotly documentation](https://plot.ly/javascript/).
Loading data in JavaScript is difficult, so we do that part using Python:

```python
aapl = pd.read_csv("https://raw.githubusercontent.com/plotly/datasets/master/finance-charts-apple.csv")
```

Now, we can create a visualizaiton using Plotly. To do this, you need to call `addOutput`, which
takes a function and calls the function after Wrattler creates an element on the page that you
can use to render the content:

```javascript
addOutput(function(myDiv) {
  function unpack(key) {
    return aapl.map(function(row) { return row[key]; });
  }
  function makeTrace(name, col, clr) {
    return { type: "scatter", mode: "lines", name: name,
      x: unpack('Date'), y: unpack(col), line: {color: clr} };
  }
  var data = [ 
    makeTrace('AAPL High', 'AAPL.High', '#17BECF'),
    makeTrace('AAPL Low', 'AAPL.Low', '#7F7F7F')
  ];
  Plotly.newPlot(myDiv, data, { title: 'Apple stock prices' });
});
```
# Welcome to Wrattler
This is a sample notebook showing some simple example plots in python and R.

Create a simple matplotlib plot in in Python.  Note that we need to use the convention demonstrated here for importing pyplot:

```python
import matplotlib.pyplot as plt
plt.plot([1,2,3])
```

Next, we create a ggplot in R.  Note that we need to assign the plot to a variable:

```r
library(ggplot2)
x <- 1
p <- ggplot(mpg,aes(x=class)) + geom_bar()
```

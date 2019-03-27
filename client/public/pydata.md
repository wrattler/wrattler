# Downloading data using Python

Python's pandas library makes it extremely easy to download data from a CSV file hosted
on the internet. This file shows a couple of examples, loading various interesting datasets
that you can play with. After assigning the dataset to a varaible in Python, it becomes available 
in subsequent R or JavaScript cells.

 - `aapl` contains recent stock prices of the Apple company
 - `olympics` is a list of all summer Olympic medalists
 - `gpusd` contains GBP USD exchange rates from Jan 2016 to Jan 2017

```python
aapl = pd.read_csv("https://raw.githubusercontent.com/plotly/datasets/master/finance-charts-apple.csv")
olympics = pd.read_csv("https://raw.githubusercontent.com/the-gamma/workyard/master/guardian/medals-merged-all.csv")
gpbusd = pd.read_csv("http://www.bankofengland.co.uk/boeapps/iadb/fromshowcolumns.asp?Travel=NIxRSxSUx" + 
  "&FromSeries=1&ToSeries=50&DAT=RNG&FD=1&FM=Jan&FY=2016&TD=1&TM=Jan&TY=2017" + 
  "&VFD=N&csv.x=17&csv.y=24&CSVF=TN&C=C8P&Filter=N")
```

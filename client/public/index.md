# Welcome to Wrattler!

```python
import requests

t = "https://raw.githubusercontent.com/tpetricek/histogram/"
avia = pd.read_csv(t + "master/traffic/clean/avia.csv")
rail = pd.read_csv(t + "master/traffic/clean/rail.csv")

w = "https://raw.githubusercontent.com/tpetricek/wrattler-workyard/"
bb13 = pd.read_csv(w + "master/broadband/broadband2013.csv")
bb14 = pd.read_csv(w + "master/broadband/broadband2014.csv")
bb15 = pd.read_csv(w + "master/broadband/broadband2015.csv")

h = requests.get(t + "master/traffic/clean/avia.csv")
test = pd.DataFrame({"data":[h.content]})
```

```r
bb15nice <- subset(bb15, select=c("URBAN2","Nation","DL24hrmean","UL24hrmean","Latency24hr","Web24hr"))
```

```ai assistant
Data diff:dirty=bb14,clean=bb15nice
bb14nice
```

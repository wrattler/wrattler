```python
import requests
w = "https://raw.githubusercontent.com/tpetricek/wrattler-workyard/"
bb14 = pd.read_csv(w + "master/broadband/broadband2014.csv")
bb15 = pd.read_csv(w + "master/broadband/broadband2015.csv")
```

```r
bb15nice <- subset(bb15, select=c("URBAN2","Nation","DL24hrmean","UL24hrmean","Latency24hr","Web24hr"))
```
# Welcome to Wrattler!

```python
import requests

t = "https://raw.githubusercontent.com/tpetricek/histogram/"
avia = pd.read_csv(t + "master/traffic/clean/avia.csv")
rail = pd.read_csv(t + "master/traffic/clean/rail.csv")

h = requests.get(t + "master/traffic/clean/avia.csv")
test = pd.DataFrame({"data":[h.content]})
```

```ai assistant
xx
```

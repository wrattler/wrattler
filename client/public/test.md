# Welcome to Wrattler
This is a sample notebook showing no data science at all.

# Welcome to Wrattler
This is a sample notebook showing no data science at all.

First, we create one frame in JavaScript:

```javascript
var one = [{'name':'Joe', 'age':50}]
```

Second, we create one frame in Python:

```python
two = pd.DataFrame({"name":["Jim"], "age":[51]})
joinPy = one.append(two); 
print("Hello me")
```



Finally, we create one more frame in R:

```r
one <- data.frame(name=c("Jim"), age=c(51))
```

Now, test if we can access all from JavaScript:

```javascript
var joinJs = one.concat(two).concat(three)
```

Similarly, test if we can access all from Python:

```python
joinPy = one.append(two).append(three); 
joinPyFlip = three.append(two).append(one)
```

Finally, test if we can access all from R:

```r
joinR <- rbind(rbind(one,two),three)
```

```python
from sklearn.linear_model import ElasticNet
clf = ElasticNet()
```

On an unrelated note, try if TheGamma integration does anything at all:

```markdown
1+2
```

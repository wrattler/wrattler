# Exploring the dependency graph

This notebook is the perfect playground for exploring how
the dependency graph and re-evaluation in Wrattler works.
It defines a couple of cells in all three supported languages
with a number of dependencies betwen them. Try modifying the
code, updating the dependency graph using `Shift`+`Enter` and
then getting results using the `Evaluate` button!

First, we create three cells that define frames `one`, `two` 
and `three` in JavaScript, Python and R. All of the cells export
the data frame they create and store it into a data store so that
other languages can later access it.

```javascript
var one = [{'name':'Joe', 'age':50}]
```

```python
two = pd.DataFrame({"name":["Jim"], "age":[51]})
```

```r
three <- data.frame(name=c("Jane"), age=c(54))
```

Now, we create a cell that concatentates all three data frames in 
each of the supported languages. Each cell can define multiple data frames
and those all appear in the output as tabs - to show this, each cell defines
an original and a flipped version of the result:

```javascript
var joinJs = one.concat(two).concat(three)
var joinJsFlip = three.concat(two).concat(one)
```

```python
joinPy = one.append(two).append(three)
joinPyFlip = three.append(two).append(one)
```

```r
joinR <- rbind(rbind(one,two),three)
joinRFlip <- rbind(rbind(three,two),one)
```

If you directly evaluate any of the last three cells, Wrattler will automatically
evaluate the first three cells, but not the other two cells that perform joining.
Try modifying the code so that one of the last three cells only appends two
of the data frames and see what happens!
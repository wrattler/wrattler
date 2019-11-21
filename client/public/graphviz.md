## Demo

```javascript
var one = [{'name':'Joe', 'age':50}]
```

```python
two = pd.DataFrame({"name":["Jim"], "age":[51]})
```

```r
three <- data.frame(name=c("Jane"), age=c(54))
```

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

## Creating full screen dialogs

```javascript
//local fullscreen.js
makeFullScreen({title: "Hello world!",height:400}, function(id) {
  document.getElementById(id).innerHTML = 
    `<img src="https://tomaspweb.blob.core.windows.net/calendar/2015/august-original.jpg" 
       style="height:calc(100% - 40px);max-width:calc(100% - 40px);margin:20px">`;
});
```

## Graph visualization

```javascript
//local fullscreen.js
//local graphviz.js
createGraphViz();
```

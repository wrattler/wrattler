Load the data

```python
script = '<script type=\"text/javascript\">\
  function printText() { \
  var textInput = "Hello Script"; \
  console.log(textInput); \
  return textInput; \
};</script>'
openButton = '<button type="button"'
# printThis = '"console.log('+'\'Hello\''+')"'
onclick = ' onclick=printText()'
endButton = ' >Click me</button>'
button = openButton+onclick+endButton
print(script+button)
addOutput(script+button)
```

```python
addOutput("<div id=\"ldavis_el8598548130636562377599206\"></div>")
```

```javascript
//global loader.js
loadStyle('https://cdn.rawgit.com/bmabey/pyLDAvis/files/ldavis.v1.0.0.css')
loadScript('./resources/ldaScript.js')
```

```javascript
//local loader.js
let script = 'function printText() { \
  var textInput = "Hello Script"; \
  return textInput; \
};\
console.log("hello")'
loadInlineScript(script)
```


```javascript
//local loader.js
loadScript('./resources/printScript.js')
```

```python
code = '<button type="button" \
onclick="document.getElementById(\'demo\').innerHTML = printText()"> \
Click me to display Date and Time.</button>\
<p id="demo"></p>'
html = code
print(html)
addOutput(html)

```



```javascript
// console.log(htmlFrame[0].script)
let tag = document.createElement('script')
tag.setAttribute('type','text/javascript');
tag.setAttribute('text', htmlFrame[0].script);
document.head.appendChild(tag);

let button = document.createElement('button')
button.innerHTML = "click me"
button.onclick = function() {
  alert('hello');
  return false;
}

addOutput(function(id) {
  document.getElementById(id).appendChild(button)
})
```


```python
html = htmlFrame['button'][0]
print (html)
addOutput(html)
```

```javascript
addOutput(function(id) { 
  var div = document.createElement('div');
  div.setAttribute("id", "ldavis_el8598548130636562377599206")
  document.getElementById(id).appendChild(div)
})
```


```python
with open('./resources/ldavis.html', 'r') as file:
  data = file.read().replace('\n', '')
  print(data)
  addOutput(data)
```

```javascript
addOutput(function(id) { 
  // var button = document.createElement('button');
  // button.innerHTML = 'click me';
  // button.onclick = function(){
  //     printText()
  //     return false;
  // };
  // // console.log(htmlFrame[0]['html'])
  document.getElementById(id).appendChild(button)
})
```

```python
openButton = '<button type="button"'
printThis = '"console.log('+'\'Hello\''+')"'
onclick = ' onclick='+printThis
endButton = ' >Click me</button>'
button = openButton+onclick+endButton
html = button
print (html)
addOutput(html)
```



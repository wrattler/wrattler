```python
addOutput("<div id=\"ldavis_el8598548130636562377599206\"></div>")
```

```python
with open('./resources/ldavis.html', 'r') as file:
  data = file.read()
  print(data)
  addOutput(data)
```

```python
script = '<script type=\"text/javascript\">\
  function printText() { \
  var textInput = "Hello Script"; \
  console.log(textInput); \
  return textInput; \
  };\
</script>'
openButton = '<button type="button"'
# printThis = '"console.log('+'\'Hello\''+')"'
onclick = ' onclick=printText()'
endButton = ' >Click me</button>'
button = openButton+onclick+endButton
paragraph = '<p>printText()</p>'
print(script+button)
addOutput(script+button)
```
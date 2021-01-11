function printHello(name) {
  addOutput(function(id) {
    document.getElementById(id).innerHTML = "<strong>JavaScript says:</strong> Hello one more time, " + name;
  })
}
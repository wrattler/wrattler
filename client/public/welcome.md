# Getting started with Wrattler

This notebook explains the basics of using Wrattler. If you are new to
Wrattler, this is the best place to start!
Although Wrattler is similar to other notbook systems like Jupyter and IPython, 
there are a couple of differences:

 - Wrattler is polyglot by default, which means that you can use multiple languages
   in a single notebook. 
 - This also means that we have to impose
   some constraints. Most notably, you can only pass data frames between cells - 
   everything else is local to one cell.
 - Wrattler keeps a dependency graph between cells. If you make a change, it will
   automatically invalidate all the cells that depend on the one that you modified
   and you will have to re-evaluate them. 
 - Similarly, if you evaluate cell that
   depends on some cell that you have not evaluated already, Wrattler will automatically
   evaluate both cells.

Wrattler is also more explicit about evaluation. Making a change in a notebook requires
two steps:

 1. Edit code and hit `Shift`+`Enter`. This will update the dependency graph and you'll
    see that some outputs will disappear.
 2. Click the `Evaluate` button to see new results!

The following three cells illustrate the idea. We export two dataframes from R and Python
and then use both of them in JavaScript to render a simple HTML output:

```python
one = pd.DataFrame({"name":["Jim"], "age":[51]})
```

```r
two <- data.frame(name=c("Jane"), age=c(54))
```

```javascript
addOutput(function(id) {
  var items = one.concat(two).map(function(row) { 
    return "<li><b>" + row.name + "</b> (" + row.age + ")</li>" });
  var html = "<ul style='margin:20px'>" + items.join("") + "</ul>";
  document.getElementById(id).innerHTML = html;
});
```

#### Generating HTML output

Wrattler runs R and Python on a server, but JavaScript is executed in the browser and has
full access to the web page. It can use the `addOutput` function (provided by Wrattler) to
add outputs that will appear below a cell. To do this, you call `addOutput` and give it a
function that is invoked when the output gets rendered - here, our function accesses data
from frames `one` and `two`, generates a HTML list and adds it to the element that Wrattler
provided us with.

#### Updating code and re-evaluation

To see how the Wrattler dependency tracking works, try the following steps:

 1. Start with a freshly loaded notebook (reload this page if you already did something above).
 2. Click `Evaluate` in the last (JavaScript) cell. You should see that all three cells have
    been evaluated, because the third one requires data from both of the other cells.
 3. Go to the first (Python) cell and modify the age of the sample person. Hit `Shift`+`Enter`
    to update data in the dependency graph. You'll see that the output of this cell, but
    also the last cell disappears. However, the output of the second cell stays, because the
    second cell does not depend on the first one.
 4. Run `Evaluate` in the first cell - this will only add result in this one cell. Then, run
    `Evaluate` in the last cell to get a new HTML output. 

#### Caching of past results

In addition to tracking dependencies in a dependency graph to minimize the amount
of re-computation, Wrattler also caches past results. You can see this by doing the
following (after completing the above steps):

 1. Say you previously changed the age of the person in the first cell from 51 to 50
    and evaluated all cells in the notebook.
 2. Go to the first cell again and change the number back from 50 to 51. Hit `Shift`+`Enter`
    to update the dependency graph.
 3. When updating the graph, Wrattler uses hashes of source code to see if any of the
    dependency graph nodes has already been created. If so, it will reuse a past node.
    When you evaluate code, the result is stored in the graph node - and so, you should
    now see all original outputs just after hitting  `Shift` + `Enter`.
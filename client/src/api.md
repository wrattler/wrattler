Wrattler is a browser-based polyglot notebook system that is flexible and extensible. 
You can add support for new programming languages. Thanks to the fact that 
Wrattler does much of its processing directly in the web browser, you can create
language plugins that run fully in the browser and create custom user interface
as part of Wrattler notebooks. Furthermore, Wrattler can also be instantiated and
used as part of a web page containing other content.  This API documentation describes 
the most important types that you need if you want to extend or use Wrattler.

### Wrattler notebdook

The [`Main` module](modules/main.html) contains types that you need to create new instances
of Wrattler notebooks in browser using JavaScript, get notified when the contents of such
notebooks change and also configure the langauges that are available in the notebook.

### Language plugins

The [`Languages` module](modules/languages.html) defines interfaces that you need to implement
if you want to add support for a new programming language. To do this, you need to implement
an interface that can parse code, construct dependency graph for the code and evaluate nodes
in such dependency graph.

### Dependency graph

The [`Graph` module](modules/graph.html) module contains interfaces and types that you'll need
to work with dependency graphs. Each language plugin will typically need to define one or more
types of nodes that it uses internally, but Wrattler also has some known types of nodes that
are used, e.g. to indicate what variables are exported from a cell and can be used in subsequent
cells.

### Evaluation and values 

The [`Values` module](modules/values.html) module contains interfaces and types that you'll need
need to evaluate code. In Wrattler, all evaluated results are linked with the dependency graph,
meaning that they are invalidated when the code chages. Each language plugin can define its own
custom types of values to use internally, but it can also use some standard Wrattler value types,
for example to represent data frames, figures or console outputs.

## R service for Wrattler

R backend for Wrattler, using ***Jug*** to handle http requests.

To run locally: ```Rscript app.R```
By default it will be accessible at ```localhost:7103```.

The following endpoints are then exposed:

### POST to /exports with payload {"code": <code_snippet>, "frames" <list-of-frames>, "hash": <hash_of_cell>}

This will call the ```analyzeCode``` function in ```R_service.R```
to analyse the code snippet to identify the names of input and output
dataframes, returning the json object ```{"imports": <frame-list>,"exports": <frame-list>}```

The ```analyzeCode``` function uses the ```makeCodeWalker``` tool from the [codetools](https://github.com/cran/codetools) package to
find imports and exports.


### POST to /eval with payload {"code": <code-snippet>, "hash": <output-hash>, "frames": <input-frame-list>}

This will call the ```executeCode``` function in ```R_service.R``` to:

* Retrieve the input frames from the data store, and store them in a
dictionary, keyed by the frame name.
* Do some stuff (see below), and return a list of dictionaries ```{"name": <output-frame-name>, "url": <output-frame-url>}```

The code fragment is inserted into a string representing a function definition, preceded by some lines of code that retrieve the
'imports' dataframes from the data-store.
The ```rlang::parse_expr``` function is then used to parse this function definition, and ```eval``` is used to call the
function and obtain the outputs.
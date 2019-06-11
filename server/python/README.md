## Python service for Wrattler

This early skeleton of a Wrattler Python kernel is based on Flask.

To run: ```python app.py```
By default it will be accessible at ```localhost:7101```.

The following endpoints are then exposed:

### POST to /exports with payload {"code": <code_snippet>, "frames" <list-of-frames>, "hash": <hash_of_cell>}

This will call the ```analyze_code``` function in ```python_service.py```
to analyse the code snippet to identify the names of input and output
dataframes, returning the json object ```{"imports": <frame-list>,"exports": <frame-list>}```

The ```analyze_code``` function uses Python's abstract syntax tree to search for assignment targets in the top-level scope
and adds them to the 'exports' list.  Names found in the code fragment that match 'exports' from previous cells are added to
the 'imports' list.


### POST to /eval with payload {"files": [<list-of-file-urls>], "code": <code-snippet>, "hash": <output-hash>, "frames": [<input-frame-list>]}

This will call the ```evaluate_code``` function in ```python_service.py``` to:

* Retrieve contents of any files from URLs in the "files" field.
* Retrieve the input frames from the data store, and store them in a
dictionary, keyed by the frame name.
* Do some stuff (see below), and return the following json object:
```{
    "output": <console_text_output>,
    "frames": [{"name": <output-frame-name>, "url": <output-frame-url>}, ... ]
    "figures": [{"name": <fig_name>, "url": <output-fig-url>}, ... ]
   }
```

The code fragment (prepended by the file-content if there is any) is inserted into a string representing a function definition, preceded by some lines of code that retrieve the
'imports' dataframes from the data-store.
Python's ```exec``` function is then used to parse this function definition, and ```eval``` is used to call the function and obtain
the outputs.
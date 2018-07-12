## Python service for Wrattler

This early skeleton of a Wrattler Python kernel is based on Flask.

To run: ```python app.py```
By default it will be accessible at ```localhost:7101```.

The following endpoints are then exposed:

### POST to /exports with payload {"code": <code_snipper>, "frames" <list-of-frames>, "hash": <hash_of_cell>}

This will call the ```analyze_code``` function in ```python_service.py```
to analyse the code snippet to identify the names of input and output
dataframes, returning the json object ```{"imports": <frame-list>,"exports": <frame-list>}```

Right now, the ```analyze_code``` function assumes that the code snippet is
simple variable assignment.  It ***split***s the snippet on ```=``` and
assumes the left-hand-side is an output frame.  It then splits the
right-hand-side on an OR of several operators (spaces, ```+```,```-```, etc.)
and sees if any of the tokens are present in the list of frames given as input.
If there are any matches, they are added to the "imports" list.


### POST to /eval with payload {"code": <code-snippet>, "hash": <output-hash>, "frames": <input-frame-list>}

This will call the ```evaluate_code``` function in ```python_service.py``` to:

* Retrieve the input frames from the data store, and store them in a
dictionary, keyed by the frame name.
* Do some stuff (see below), and return a list of dictionaries ```{"name": <output-frame-name>, "url": <output-frame-url>}```

Right now the code analysis is extremely basic - it again assumes we have
simple variable assignment, so splits the code snippet on ```=```.
The left-hand-side is the name of the output frame.
For the right-hand-side, if any of the input frame names are found, the
data-frame is substituted in.  The built-in python ```eval``` is then called on
the result, and the value is assigned to the output frame, and written to the data store.

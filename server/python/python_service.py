"""
Collection of functions called by the flask app that provide the
functionality of the wrattler python service.
"""

import requests
import re
import os
import sys
import json
import parser
import pandas as pd
import numpy as np
import ast
import collections
import base64
from io import StringIO
import contextlib

from exceptions import ApiException

if 'DATASTORE_URI' in os.environ.keys():
    DATASTORE_URI = os.environ['DATASTORE_URI']
else:
    DATASTORE_URI = 'http://localhost:7102'

## define temporary dir for Windows or *nix
if os.name == "posix":
    TMPDIR = "/tmp"
else:
    TMPDIR = "%TEMP%"


@contextlib.contextmanager
def stdoutIO(stdout=None):
    old = sys.stdout
    if stdout is None:
        stdout = StringIO()
    sys.stdout = stdout
    yield stdout
    sys.stdout = old


def cleanup(i):
    """
    Function to ensure we can json-ify our values.  For example,
    pandas returns numpy.int64 rather than int, which are not json-serializable,
    so we convert them to regular ints here.
    Similarly, convert any NaN to None
    """
    if isinstance(i, np.integer): return int(i)
    try:
        if np.isnan(i): return None
    except(TypeError):
        pass
    return i


def convert_to_pandas_df(frame):
    """
    convert wrattler format [{"var1":val1, "var2":val2},{...}]
    to pandas dataframe.  If it doesn't fit this format, just return
    the input, unchanged.
    """
    try:
        frame_dict = {}
        for row in frame:
            for k,v in row.items():
                if not k in frame_dict.keys():
                    frame_dict[k] = []
                frame_dict[k].append(v)
        df = pd.DataFrame(frame_dict)
        return df
    except:  # could be TypeError, AttributeError, ...
        return frame


def convert_from_pandas_df(dataframe):
    """
    converts pandas dataframe into wrattler format, i.e. list of rows.
    If input is not a pandas dataframe, try to convert it, and return None if we can't
    """
    if not isinstance(dataframe, pd.DataFrame):
        try:
            dataframe = pd.DataFrame(dataframe)
        except(ValueError):
            return None
    return dataframe.to_json(orient='records')
#    row_list = []
#    columns = list(dataframe.columns)
#    for index, row in dataframe.iterrows():
#        this_row = {}
#        for column in columns:
#            this_row[column] = cleanup(row[column])
#        row_list.append(this_row)
#    return row_list


def read_frame(frame_name, frame_hash):
    """
    read a frame from the data store
    """
    url = '{}/{}/{}'.format(DATASTORE_URI, frame_hash, frame_name)
    try:
        r=requests.get(url)
        if r.status_code is not 200:
            raise ApiException("Could not retrieve dataframe", status_code=r.status_code)
        data = json.loads(r.content.decode("utf-8"))
        return data
    except(requests.exceptions.ConnectionError):
        raise ApiException("Unable to connect to datastore {}".format(DATASTORE_URI),status_code=500)


def write_frame(data, frame_name, frame_hash):
    """
    write a frame to the data store
    """
    url = '{}/{}/{}'.format(DATASTORE_URI, frame_hash, frame_name)
    try:
        r=requests.put(url,data=data)
        tokenized_response = r.content.decode("utf-8").split()
        if 'StatusMessage:Created' in tokenized_response:
            return True
        return r.status_code == 200
    except(requests.exceptions.ConnectionError):
        raise ApiException("Unable to connect to datastore {}".format(DATASTORE_URI),status_code=500)
    return False


def write_image(frame_hash):
    """
    See if there is an image on TMPDIR and send it to the datastore if so.
    Return True if an image is written to the datastore, False if there is nothing to write,
    and raise an ApiException if there is a problem writing it.
    """
    file_path = os.path.join(TMPDIR,frame_hash)
    if not os.path.exists(file_path):
        return False
    url = '{}/{}/figures'.format(DATASTORE_URI, frame_hash)
    file_data = open(os.path.join(file_path,'fig.png'),'rb')
    try:
        img_b64 = base64.b64encode(file_data.read())
        data = [{"IMAGE": img_b64.decode("utf-8")}]
        r = requests.put(url, json=data)
        return (r.status_code == 200)
    except(requests.exceptions.ConnectionError):
        raise ApiException("Could not write image to datastore {}".format(DATASTORE_URI),
                           status_code=500)


def find_assignments(code_string):
    """
    returns a dict {"targets: [], "input_vals": []}
    """

    output_dict = {"targets": [],
                   "input_vals": []
                   }
    node = ast.parse(code_string)
    ## recursive function to navigate the tree and find assignment targets and input values
    def _find_elements(node, output_dict, parent=None, global_scope=True):
        if isinstance(node, ast.AST):
            if isinstance(node, ast.Assign):
                _find_elements(node.targets, output_dict, "targets", global_scope)
                _find_elements(node.value, output_dict, "input_vals", global_scope)
            elif isinstance(node, ast.Call):
                _find_elements(node.args, output_dict, "input_vals", global_scope)
                _find_elements(node.func, output_dict, "input_vals", global_scope)
            elif isinstance(node, ast.Name) and parent:
                if global_scope or parent=="input_vals":
                    ## only add this name if it isn't already in the list
                    if not node.id in output_dict[parent]:
                        output_dict[parent].append(node.id)
            elif isinstance(node, ast.FunctionDef):  ## will no longer be in global scope
                for a,b in ast.iter_fields(node):
                    _find_elements(b, output_dict, parent, False)
            else:
                for a,b in ast.iter_fields(node):
                    _find_elements(b, output_dict, parent, global_scope)
        elif isinstance(node, list):
            for element in node:
                _find_elements(element, output_dict, parent, global_scope)
        return output_dict
    final_dict = _find_elements(node, output_dict)
    return final_dict


def analyze_code(data):
    """
    scan the code, and see if any of the input frames are used,
    and what is the name of the output frame(s).
    """
    code = data["code"]
    frames = data["frames"]
    cell_hash = data["hash"]
    imports = []
    exports = []

    assignment_dict = find_assignments(code)
    exports = assignment_dict["targets"]
    for variable in assignment_dict["input_vals"]:
        if variable in frames:
            imports.append(variable)
    ## ensure that each variable only appears once
    imports = list(set(imports))
    exports = list(set(exports))
    return {"imports": imports,
            "exports": exports}


def retrieve_frames(input_frames):
    """
    given a list of dictionaries {'name': x, 'url': y} retrieve
    the frames from data-store and keep in a dict {<name>:<content>}
    """
    frame_dict = {}
    for frame in input_frames:
        try:
            r=requests.get(frame["url"])
            if r.status_code != 200:
                raise ApiException("Problem retrieving dataframe %s"%frame["name"],status_code=r.status_code)
            frame_content = json.loads(r.content.decode("utf-8"))
            frame_dict[frame["name"]] = frame_content
        except(requests.exceptions.ConnectionError):
            ## try falling back on read_frame method (using env var DATASTORE_URI)
            try:
                frame_hash, frame_name = frame["url"].split("/")[-2:]
                frame_data = read_frame(frame_name, frame_hash)
                frame_dict[frame["name"]] = frame_data
            except(requests.exceptions.ConnectionError):
                raise ApiException("Unable to connect to {}".format(frame["url"]))
    return frame_dict


def evaluate_code(data):
    """
    recieves data posted to eval endpoint, in format:
    { "code": <code_string>,
      "hash": <cell_hash>,
      "frames" [<frame_name>, ... ]
    }
    This function will analyze and execute code, including retrieving input frames,
    and will return output as a dict:
       { "output": <text_output_from_cell>,
         "frames" [ {"name": <frame_name>, "url": <frame_url>}, ... ]
         "figures": [ {"name": <fig_name>, "url": <fig_url>}, ... ]
       }

    """
    code_string = data["code"]
    output_hash = data["hash"]
    assign_dict = find_assignments(code_string)

    input_frames = data["frames"]
    frame_dict = retrieve_frames(input_frames)
    ## execute the code, get back a dict {"output": <string_output>, "results":<list_of_vals>}
    results_dict = execute_code(code_string, frame_dict, assign_dict['targets'], output_hash)

    results = results_dict["results"]
    ## prepare a return dictionary
    return_dict = {
        "output": results_dict["output"],
        "frames": [],
        "figures": []
    }

    frame_names = assign_dict['targets']
    if len(results) != len(frame_names):
        raise ApiException("Error: no. of output frames does not match no. results", status_code=500)

    wrote_ok=True
    for i, name in enumerate(frame_names):
        ## check here if the result is a JSON string - if not, skip it
        if not (isinstance(results[i],str) and (results[i][0]=='[' or results[i][0]=='{')):
            continue

        wrote_ok &= write_frame(results[i], name, output_hash)
        return_dict["frames"].append({"name": name,"url": "{}/{}/{}"\
                                      .format(DATASTORE_URI,
                                              output_hash,
                                              name)})

    ## see if there is an image in /tmp, and if so upload to datastore
    wrote_image = write_image(output_hash)
    ## if there was an image written, it should be stores as <hash>/figures
    if wrote_image:
        return_dict["figures"].append({"name": "figures",
                                       "url": "{}/{}/figures".format(DATASTORE_URI,output_hash)})
    if wrote_ok:
        return return_dict
    else:
        raise RuntimeError("Could not write result to datastore")


def construct_func_string(code, input_val_dict, return_vars, output_hash):
    """
    Construct a string func_string that defines a function wrattler_f()
    using the input and output variables defined from the code
    analysis.
    """
    func_string = "def wrattler_f():\n"
    func_string += "    import os\n"
    func_string += "    import contextlib\n"
    func_string += "    import matplotlib\n"
    func_string += "    matplotlib.use('Cairo')\n\n"
    for k,v in input_val_dict.items():
        func_string += "    {} = convert_to_pandas_df({})\n".format(k,v)
    ## need to worry about indentation for multi-line code fragments.
    ## split the code string by newline character, and prepend 4 spaces to each line.
    for line in code.strip().split("\n"):
        func_string += "    {}\n".format(line)
    ## save any plot output to a file in /tmp/<hash>/
    func_string += "    try:\n"
    func_string += "        os.makedirs(os.path.join('{}','{}'),exist_ok=True)\n".format(TMPDIR,output_hash)
    func_string += "        plt.savefig(os.path.join('{}','{}','fig.png'))\n".format(TMPDIR,output_hash)
    func_string += "    except(NameError):\n"
    func_string += "        with contextlib.suppress(FileNotFoundError):\n"
    func_string += "            os.rmdir(os.path.join('{}','{}'))\n".format(TMPDIR,output_hash)
    func_string += "            pass\n"
    func_string += "        pass\n"
    func_string += "    return "
    for rv in return_vars:
        func_string += "{},".format(rv)
    func_string += "\n"
    return func_string


def execute_code(code, input_val_dict, return_vars, output_hash, verbose=False):
    """
    Call a function that constructs a string containing a function definition,
    then do exec(func_string), then define another string call_string
    that calls this function,
    and then finally do eval(call_string)
    """
    func_string = construct_func_string(code,
                                        input_val_dict,
                                        return_vars,
                                        output_hash)
    if verbose:
        print(func_string)
    exec(func_string)
    return_dict = {"output": "", "results": []}
    try:
        with stdoutIO() as s:
            ### wrapping function wrattler_f should now be in the namespace
            func_output = eval('wrattler_f()')
            return_dict["output"] = s.getvalue().strip()
            if isinstance(func_output, collections.Iterable):
                results = []
                for item in func_output:
                    results.append(convert_from_pandas_df(item))
                return_dict["results"] = results
            elif not func_output:
                return_dict["results"] = []
            else:
                result = convert_from_pandas_df(func_output)
                return_dict["results"] = [result]
    except Exception as e:
        output = "{}: {}".format(type(e).__name__, e)
        raise ApiException(output, status_code=500)

    return return_dict

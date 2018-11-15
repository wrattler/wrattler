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


if 'DATASTORE_URI' in os.environ.keys():
    DATASTORE_URI = os.environ['DATASTORE_URI']
else:
    DATASTORE_URI = 'http://localhost:7102'
#DATASTORE_URI = 'https://wrattler-data-store.azurewebsites.net'


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
    row_list = []
    columns = list(dataframe.columns)
    for index, row in dataframe.iterrows():
        this_row = {}
        for column in columns:
            this_row[column] = cleanup(row[column])
        row_list.append(this_row)
    return row_list


def read_frame(frame_name, frame_hash):
    """
    read a frame from the data store
    """
    url = '{}/{}/{}'.format(DATASTORE_URI, frame_hash, frame_name)
    r=requests.get(url)
    if r.status_code is not 200:
        raise RuntimeError("Could not retrieve dataframe")
    data = json.loads(r.content.decode("utf-8"))
    return data


def write_frame(data, frame_name, frame_hash):
    """
    write a frame to the data store
    """
    url = '{}/{}/{}'.format(DATASTORE_URI, frame_hash, frame_name)
#    print(" url is {}".format(url), file=sys.stderr)
    r=requests.put(url,json=data)
    tokenized_response = r.content.decode("utf-8").split()
    if 'StatusMessage:Created' in tokenized_response:
        return True
    return r.status_code == 200


def find_assignments(code_string):
    """
    returns a dict {"targets: [], "input_vals": []}
    """

    output_dict = {"targets": [],
                   "input_vals": []
                   }
    node = ast.parse(code_string)
    ## recursive function to navigate the tree and find assignment targets and input values
    def _find_elements(node, output_dict, parent=None):
        if isinstance(node, ast.AST):
            if isinstance(node, ast.Assign):
                _find_elements(node.targets, output_dict, "targets")
                _find_elements(node.value, output_dict, "input_vals")
            elif isinstance(node, ast.Name) and parent:
                output_dict[parent].append(node.id)
            else:
                for a,b in ast.iter_fields(node):
                    _find_elements(b, output_dict, parent)
        elif isinstance(node, list):
            for element in node:
                _find_elements(element, output_dict, parent)
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
    return {"imports": imports,
            "exports": exports}


def retrieve_frames(input_frames):
    """
    given a list of dictionaries {'name': x, 'url': y} retrieve
    the frames from data-store and keep in a dict {<name>:<content>}
    """
    frame_dict = {}
    for frame in input_frames:
        r=requests.get(frame["url"])
        if r.status_code != 200:
            raise RuntimeError("Problem retrieving dataframe %s"%frame["name"])
        frame_content = json.loads(r.content.decode("utf-8"))
        frame_dict[frame["name"]] = frame_content
    return frame_dict


def evaluate_code(data):
    """
    retrieve inputs from storage, execute code, and store output.
    """
    code_string = data["code"]
    output_hash = data["hash"]
    assign_dict = find_assignments(code_string)

    input_frames = data["frames"]
    frame_dict = retrieve_frames(input_frames)

    results = execute_code(code_string, frame_dict, assign_dict['targets'])
    frame_names = assign_dict['targets']

    if len(results) != len(frame_names):
        raise RuntimeError("no. of output frames does not match no. results")
    ## there can be more than one output frame
    return_dict = {
        "output": "",
        "frames": []
    }
    wrote_ok=True
    for i, name in enumerate(frame_names):
        wrote_ok &= write_frame(results[i], name, output_hash)
        return_dict["frames"].append({"name": name,"url": "{}/{}/{}"\
                                      .format(DATASTORE_URI,
                                              output_hash,
                                              name)})

    if wrote_ok:
        return return_dict
    else:
        raise RuntimeError("Could not write result to datastore")


def execute_code(code, input_val_dict, return_vars, verbose=False):
    """
    Construct a string func_string that defines a function f()
    then do exec(func_string), then define another string call_string that calls this function,
    and then finally do eval(call_string)
    """
    func_string = "def wrattler_f():\n"
    for k,v in input_val_dict.items():
        func_string += "    {} = convert_to_pandas_df({})\n".format(k,v)
    ## need to worry about indentation for multi-line code fragments.
    ## split the code string by newline character, and prepend 4 spaces to each line.
    for line in code.strip().split("\n"):
        func_string += "    {}\n".format(line)
    func_string += "    return "
    for rv in return_vars:
        func_string += "{},".format(rv)
    func_string += "\n"
    if verbose:
        print(func_string)
    exec(func_string)
    func_output = eval('wrattler_f()')

    if isinstance(func_output, collections.Iterable):
        results = []
        for item in func_output:
            results.append(convert_from_pandas_df(item))
        return results
    else:
        result = convert_from_pandas_df(func_output)
        return result

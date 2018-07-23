"""
Collection of functions called by the flask app that provide the
functionality of the wrattler python service.
"""

import requests
import re
import json
import parser
import pandas as pd


DATASTORE_URI = 'http://localhost:7102'
#DATASTORE_URI = 'https://wrattler-data-store.azurewebsites.net'

def convert_to_pandas_df(frame):
    """
    convert wrattler format [{"var1":val1, "var2":val2},{...}]
    to pandas dataframe.
    """
    frame_dict = {}
    for row in frame:
        for k,v in row.items():
            if not k in frame_dict.keys():
                frame_dict[k] = []
            frame_dict[k].append(v)
    df = pd.DataFrame(frame_dict)
    return df


def convert_from_pandas_df(dataframe):
    """
    converts pandas dataframe into wrattler format, i.e. list of rows.
    """
    row_list = []
    columns = list(dataframe.columns)
    for row in range(len(dataframe.values)):
        this_row = {}
        for column in columns:
            this_row[column] = dataframe[column][row]
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
    r=requests.put(url,json=data)
    tokenized_response = r.content.decode("utf-8").split()
    if 'StatusMessage:Created' in tokenized_response:
        return True
    return r.status_code == 200



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
    if code.count("=") == 1: # assume we have simple variable assignemnt
        lhs,rhs = code.split("=")
        exports.append(lhs.strip())
        tokens = re.split(r'([\s\+\-\/\*\,]+)', rhs)
        for token in tokens:
            if token.strip() in frames:
                imports.append(token.strip())
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
    if code_string.count("=") != 1: # assume we have simple variable assignemnt
        raise RuntimeError("Cannot evaluate code - wrong number of '='")
    lhs,rhs = code_string.split("=")
    rhs = rhs.strip()
    input_frames = data["frames"]
    frame_dict = retrieve_frames(input_frames)
    result = execute_code(rhs, frame_dict)
    frame_name = lhs.strip()
    data = [{frame_name : result}] ## FIXME frame name vs variable name
    wrote_ok = write_frame(data, frame_name, output_hash)
    if wrote_ok:
        return [{"name": frame_name,
                "url": '{}/{}/{}'.format(DATASTORE_URI,
                                         output_hash,
                                         frame_name)}]
    else:
        raise RuntimeError("Could not write result to datastore")


def execute_code(code, input_vals):
    """
    Use input frames to substitute values into the code snippet, then evaluate.
    """
    # swap out values for input frame variables in the code string
    index=0
    pd_dfs = []
    for k,v in input_vals.items():
        pd_dfs.append(convert_to_pandas_df(v))
        code = code.replace(k,'pd_dfs[{}]'.format(index))
        index += 1
    try:
        result = eval(code)
        return result
    except(NameError):
        raise RuntimeError("Could not evaluate expression %s" % code)

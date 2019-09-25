"""
Implementation of the functionality behind the exports and eval endpoints
for the Wrattler python service.
"""

import os
import sys
import json
import re
import parser
import pandas as pd
import numpy as np
import ast
import collections
import base64
from io import StringIO
import contextlib
import pyarrow as pa

from .exceptions import ApiException

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


def get_file_content(url):
    """
    Given the URL of a file on the datastore, return the contents
    (likely some function definitions and/or import statements).
    """
    try:
        r=requests.get(url)
        if r.status_code is not 200:
            raise ApiException("Could not retrieve dataframe", status_code=r.status_code)
        file_content = r.content.decode("utf-8")
        return file_content
    except(requests.exceptions.ConnectionError):
        try:
            ## Try falling back on the datastore environment variable
            cell_hash, file_name = url.split("/")[-2:]
            url = '{}/{}/{}'.format(DATASTORE_URI, cell_hash, file_name)
            r = requests.get(url)
            if r.status_code is not 200:
                raise ApiException("Could not retrieve dataframe", status_code=r.status_code)
            file_content = r.content.decode("utf-8")
            return file_content
        except:
            raise ApiException("Unable to get file content from {}".format(url),status_code=500)



def execute_file_content(file_content):
    """
    Given the string file content of a file (likely containing function defns and import
    statements), call 'exec' on it
    """
    try:
        exec(file_content)
        print("Executed file content!")
    except SyntaxError as e:
        raise ApiException("Error processing file: {}".format(e.msg))


def convert_to_pandas(input_data):
    """
    convert an unknown input type (either Apache Arrow or JSON)
    to a pandas dataframe.
    """
    try:
        dataframe =  arrow_to_pandas(input_data)
        return dataframe
    except(ApiException):
        try:
            dataframe = json_to_pandas(input_data)
            return dataframe
        except(ApiException):
            raise ApiException("Unknown data type - cannot convert to pandas")


def arrow_to_pandas(arrow_buffer):
    """
    Convert from an Apache Arrow buffer into a pandas dataframe
    """
    try:
        reader = pa.ipc.open_file(arrow_buffer)
        frame = reader.read_pandas()
        return frame
    except:
        raise(ApiException("Error converting arrow to pandas dataframe"))


def json_to_pandas(json_data):
    """
    convert row-wise json format [{"var1":val1, "var2":val2},{...}]
    to pandas dataframe.  If it doesn't fit this format, just return
    the input, unchanged.
    """
    ## convert to string if in bytes format
    if isinstance(json_data, bytes):
        try:
            json_data = json_data.decode("utf-8")
        except(UnicodeDecodeError):
            raise(ApiException("Data not unicode encoded"))
    ## convert to list if in str format
    if isinstance(json_data, str):
        try:
            json_data = json.loads(json_data)
        except(json.decoder.JSONDecodeError):
            raise(ApiException("Unable to read as JSON: {}".format(json_data)))
    ## assume we now have a list of records
    try:
        frame_dict = {}
        for row in json_data:
            for k,v in row.items():
                if not k in frame_dict.keys():
                    frame_dict[k] = []
                frame_dict[k].append(v)
        df = pd.DataFrame(frame_dict)
        return df
    except:  # could be TypeError, AttributeError, ...
        raise(ApiException("Unable to convert json to pandas dataframe"))


def convert_from_pandas(dataframe, max_size_json=0):
    """
    convert from pandas dataframe to either Apache Arrow format or JSON,
    depending on size (by default always go to Arrow).
    """
    if not isinstance(dataframe, pd.DataFrame):
        try:
            dataframe = pd.DataFrame(dataframe)
        except(ValueError):
            return None
    if dataframe.size > max_size_json:
        try:
            return  pandas_to_arrow(dataframe)
        except(pa.lib.ArrowTypeError, pa.lib.ArrowInvalid):
            print("Unable to convert to pyarrow table - inconsistent types in column?")
            return pandas_to_json(dataframe)
    else:
        return pandas_to_json(dataframe)


def pandas_to_arrow(frame):
    """
    Convert from a pandas dataframe to apache arrow serialized buffer
    """
    batch = pa.RecordBatch.from_pandas(frame, preserve_index=False)
    sink = pa.BufferOutputStream()
    writer = pa.RecordBatchFileWriter(sink, batch.schema)
    writer.write_batch(batch)
    writer.close()
    arrow_buffer = sink.getvalue()
    return arrow_buffer.to_pybytes()


def pandas_to_json(dataframe):
    """
    converts pandas dataframe into wrattler format, i.e. list of rows.
    If input is not a pandas dataframe, try to convert it, and return None if we can't
    """
    if not (isinstance(dataframe, pd.DataFrame)):
        try:
            dataframe = pd.DataFrame(dataframe)
        except:
            raise ApiException("Unable to convert to pandas dataframe")
    return dataframe.to_json(orient='records')


def read_frame(frame_name, cell_hash):
    """
    read a frame from the data store
    """
    url = '{}/{}/{}'.format(DATASTORE_URI, cell_hash, frame_name)
    try:
        r=requests.get(url)
        if r.status_code is not 200:
            raise ApiException("Could not retrieve dataframe", status_code=r.status_code)
        data = r.content
        return data
    except(requests.exceptions.ConnectionError):
        raise ApiException("Unable to connect to datastore {}".format(DATASTORE_URI),status_code=500)


def write_frame(data, frame_name, cell_hash):
    """
    write a frame to the data store
    """
    url = '{}/{}/{}'.format(DATASTORE_URI, cell_hash, frame_name)
    try:
        r=requests.put(url,data=data)
        tokenized_response = r.content.decode("utf-8").split()
        if 'StatusMessage:Created' in tokenized_response:
            return True
        return r.status_code == 200
    except(requests.exceptions.ConnectionError):
        raise ApiException("Unable to connect to datastore {}".format(DATASTORE_URI),status_code=500)
    return False


def write_image(cell_hash):
    """
    See if there is an image on TMPDIR and send it to the datastore if so.
    Return True if an image is written to the datastore, False if there is nothing to write,
    and raise an ApiException if there is a problem writing it.
    """
    file_path = os.path.join(TMPDIR,cell_hash,'fig.png')
    if not os.path.exists(file_path):
        return False
    url = '{}/{}/figures'.format(DATASTORE_URI, cell_hash)
    file_data = open(file_path,'rb')
    try:
        img_b64 = base64.b64encode(file_data.read())
        data = [{"IMAGE": img_b64.decode("utf-8")}]
        ## now remove the figure
        os.remove(file_path)
        ## put it on the data store
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
    try:
        node = ast.parse(code_string)
    except SyntaxError as e:
        raise ApiException("Syntax error in code string: {}".format(e.msg))
    ## recursive function to navigate the tree and find assignment targets and input values
    def _find_elements(node, output_dict, parent=None, global_scope=True):
        if isinstance(node, ast.AST):
            if isinstance(node, ast.Assign):
                _find_elements(node.targets, output_dict, "targets", global_scope)
                _find_elements(node.value, output_dict, "input_vals", global_scope)
            elif isinstance(node, ast.Call):
                _find_elements(node.args, output_dict, "input_vals", global_scope)
                _find_elements(node.func, output_dict, "input_vals", global_scope)
            ## treat things like df[0] = x (i.e. ast.Subscript nodes) similarly to Call nodes
            ## - i.e. we will need 'df' to be an import in order to avoid 'not defined' error.
            elif isinstance(node, ast.Subscript):
                _find_elements(node.value, output_dict, "input_vals", global_scope)
                if parent and parent == "targets":
                    _find_elements(node.value, output_dict, "targets", global_scope)
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


def handle_exports(data):
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
            frame_content = r.content
            frame_dict[frame["name"]] = frame_content
        except(requests.exceptions.ConnectionError):
            ## try falling back on read_frame method (using env var DATASTORE_URI)
            try:
                cell_hash, frame_name = frame["url"].split("/")[-2:]
                frame_data = read_frame(frame_name, cell_hash)
                frame_dict[frame["name"]] = frame_data
            except(requests.exceptions.ConnectionError):
                raise ApiException("Unable to connect to {}".format(frame["url"]))
    return frame_dict


def handle_eval(data):
    """
    recieves data posted to eval endpoint, in format:
    { "code": <code_string>,
      "hash": <cell_hash>,
      "frames": [<frame_name>, ... ],
      "files": [<file_url>, ...]
    }
    This function will analyze and execute code, including retrieving input frames,
    and will return output as a dict:
       { "output": <text_output_from_cell>,
         "frames": [ {"name": <frame_name>, "url": <frame_url>}, ... ],
         "figures": [ {"name": <fig_name>, "url": <fig_url>}, ... ],
         "html": <html string>
       }

    """
    code_string = data["code"]
    output_hash = data["hash"]
    assign_dict = find_assignments(code_string)
    files = data["files"] if "files" in data.keys() else []
    file_content_dict = {}
    for file_url in files:
        filename = file_url.split("/")[-1]
        file_content = get_file_content(file_url)
        file_content_dict[filename] = file_content

    input_frames = data["frames"]
    frame_dict = retrieve_frames(input_frames)
    ## execute the code, get back a dict {"output": <string_output>, "results":<list_of_vals>}
    results_dict = execute_code(file_content_dict,
                                code_string,
                                frame_dict,
                                assign_dict['targets'],
                                output_hash,
                                verbose=False)

    results = results_dict["results"]
    ## prepare a return dictionary
    return_dict = {
        "output": results_dict["output"],
        "frames": [],
        "figures": []
    }
    if "html" in results_dict.keys():
        return_dict["html"] = results_dict["html"]

    wrote_ok=True
    for name, frame in results.items():
        wrote_ok &= write_frame(frame, name, output_hash)
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
        raise ApiException("Could not write result to datastore")


def indent_code(input_string):
    """
    Split code by newline character, and prepend 4 spaces to each line.
    """
    lines = input_string.strip().split("\n")
    output_string = ""
    for line in lines:
        output_string += "    {}\n".format(line)
    ## one last newline for luck
    output_string += "\n"
    return output_string


def construct_func_string(file_contents, code, input_val_dict, return_vars, output_hash):
    """
    Construct a string func_string that defines a function wrattler_f()
    using the input and output variables defined from the code
    analysis.
    """
    func_string = "def wrattler_f():\n"
    func_string += "    import os\n"
    func_string += "    import contextlib\n"
    func_string += "    import matplotlib\n"
    func_string += "    import IPython\n"
    func_string += "    matplotlib.use('Cairo')\n\n"
    func_string += "    wrattler_return_dict = {}\n\n"
    func_string += "    def addOutput(html_output):\n"
    func_string += "        if isinstance(html_output, str):\n"
    func_string += "           wrattler_return_dict['html'] = html_output\n"
    func_string += "        elif isinstance(html_output, IPython.core.display.HTML):\n"
    func_string += "           wrattler_return_dict['html'] = html_output.data\n"
    func_string += "        else:\n"
    func_string += "           raise ApiException('Unknown html_output format - please call addOutput with either an html string, or an IPython.core.display.HTML object')\n\n"
    ## add the contents of any files, ensuring correct indentation
    func_string += indent_code(file_contents)
    for k,v in input_val_dict.items():
        func_string += "    {} = convert_to_pandas({})\n".format(k,v)
    ## Also need to worry about indentation for multi-line code fragments.
    func_string += indent_code(code)
    ## save any plot output to a file in /tmp/<hash>/
    func_string += "    try:\n"
    func_string += "        os.makedirs(os.path.join('{}','{}'),exist_ok=True)\n".format(TMPDIR,output_hash)
    func_string += "        if len(plt.get_fignums()) > 0:\n"
    func_string += "            plt.savefig(os.path.join('{}','{}','fig.png'))\n".format(TMPDIR,output_hash)
    func_string += "            plt.close()\n"
    func_string += "    except(NameError):\n"
    func_string += "        with contextlib.suppress(FileNotFoundError):\n"
    func_string += "            os.rmdir(os.path.join('{}','{}'))\n".format(TMPDIR,output_hash)
    func_string += "            pass\n"
    func_string += "        pass\n"
    func_string += "    wrattler_return_dict['frames'] = {"
    for rv in return_vars:
        func_string += "'{}':{},".format(rv,rv)
    func_string += "}\n"
    func_string += "    return wrattler_return_dict"
    return func_string


def execute_code(file_content_dict, code, input_val_dict, return_vars, output_hash, verbose=False):
    """
    Call a function that constructs a string containing a function definition,
    then do exec(func_string), which should mean that the function ('wratttler_f')
    is defined, and then finally we do eval('wrattler_f()) to execute the function.

    Takes arguments:
      file_content_dict: is a dict of {<filename>:<content>,...} for files (e.g.
                         containing function definitions) on the datastore.
      code: is a string (the code in the cell)
      input_val_dict: dictionary {<variable_name>: <data_retrieved_from_datastore>, ...}
      return_vars: list of variable names found by find_assignments(code)
      output_hash: hash of the cell - will be used to create URL on datastore for outputs.
      verbose: if True will print out e.g. the function string.

    Returns a dictionary:
    {
    "output": <console output>,
    "results": {<frame_name>: <frame>, ... }
    }
    """

    ## first deal with any files that could contain function def'ns and/or import statements
    file_contents = ""
    for v in file_content_dict.values():
        file_contents += v
        file_contents += "\n"

    func_string = construct_func_string(file_contents,
                                        code,
                                        input_val_dict,
                                        return_vars,
                                        output_hash)
    if verbose:
        print(func_string)
    try:
        exec(func_string)
    except SyntaxError as e:
        ## there is a problem either with the code fragment or with the file_contents -
        ## see if we can narrow it down in order to provide a more helpful error msg
        for fn, fc in file_content_dict.items():
            try:
                exec(fc)
            except SyntaxError as se:
                output = "SyntaxError when trying to execute imported file: {}".format(fn)
                raise ApiException(output, status_code=500)
        output = "SyntaxError when trying to execute code in cell: {}".format(e)
        raise ApiException(output, status_code=500)
    return_dict = {"output": "", "results": []}
    try:
        with stdoutIO() as s:
            ### wrapping function wrattler_f should now be in the namespace
            func_output = eval('wrattler_f()')
            return_dict["output"] = s.getvalue().strip()
            if "html" in func_output.keys():
                return_dict['html'] = func_output['html']
            return_dict["results"] = {}
            for k,v in func_output['frames'].items():
                result = convert_from_pandas(v)
                if result:
                    return_dict["results"][k] = result

    except Exception as e:
        output = "{}: {}".format(type(e).__name__, e)
        raise ApiException(output, status_code=500)

    return return_dict

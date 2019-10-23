"""
slightly higher-level tests than those in test_execute_code" -
in addition to checking we execute the code block correcly, we also
check that we get the correct return values and imports.
We mock the datastore using a simple fixture that stores dictionaries.
"""

import os
import shutil
import contextlib
import pytest
import pandas as pd
from unittest.mock import patch

from wrattler_python_service.python_service_utils import handle_eval, read_frame, DATASTORE_URI
from wrattler_python_service.exceptions import ApiException

from flask import Flask
from flask_restful import Api

import pytest



def test_hello_world():
    """
    test that a simple print statement gives text output but no
    output frames.
    """
    shutil.rmtree("/tmp/testhash3", ignore_errors=True)
    input_code = 'print("hello world")'
    with patch('wrattler_python_service.python_service_utils.write_frame') as mock_write_frame:

        return_dict = handle_eval({"code":input_code,
                                   "frames": [],
                                   "hash": "irrelevant"})
        assert(return_dict["output"]=="hello world")
        assert(len(return_dict["frames"])==0)


def test_assignment():
    """
    test that a simple assignment outputs the url for a dataframe
    """
    input_code = 'df = pd.DataFrame({"x":[1,2,3]})'
    with patch('wrattler_python_service.python_service_utils.write_frame') as mock_write_frame:
        return_dict = handle_eval({"code":input_code,
                                   "frames": [],
                                   "hash": "irrelevant"})
        assert(return_dict["output"]=="")
        assert(len(return_dict["frames"])==1)
        assert(return_dict["frames"][0]["name"]=="df")
        assert(return_dict["frames"][0]["url"].endswith("/df"))


def test_concat():
    """
    test that we can concatenate two dataframes
    """
    input_code = 'df1 = pd.DataFrame({"name":["Alice","Bob"],"occupation":["cryptographer","crook"]})\n'
    input_code += 'df2 = pd.DataFrame({"name":["Carol"],"occupation":["copper"]})\n'
    input_code += 'df3 = df1.append(df2)\n'
    with patch('wrattler_python_service.python_service_utils.write_frame', return_value=True) as mock_write_frame:
        return_dict = handle_eval({"code":input_code,
                                   "frames": [],
                                   "hash": "testhash1"})
        assert(len(return_dict["frames"])==3)
        assert(return_dict["frames"][2]["url"].endswith("df3"))


def test_create_plot():
    """
    test that if we make a pyplot, it creates a file fig.png in /tmp/<cell_hash>/
    """
    shutil.rmtree("/tmp/testhash2",ignore_errors=True)
    input_code = "import matplotlib.pyplot as plt\nplt.plot([1,2,3])\n"
    with patch('wrattler_python_service.python_service_utils.write_frame') as mock_write_frame:
        with patch('wrattler_python_service.python_service_utils.write_image') as mock_write_image:
            return_dict = handle_eval({"code": input_code,
                                       "frames": [],
                                       "hash": "testhash32"})
            assert(os.path.exists("/tmp/testhash32/fig.png"))


def test_use_func_from_file():
    """
    test that we can read a file from the datastore containing a function
    definition and use that function in a code fragment.
    """

    file_content = "import numpy\ndef testfunc(input_val):\n return numpy.sqrt(input_val)\n"
    input_code = 'print("Result is {}".format(testfunc(9))) \n'
    cell_hash = "testhash3"
    filename = "testfile.py"
    with patch('wrattler_python_service.python_service_utils.get_file_content', return_value=file_content) as mock_get_file_content:
        with patch('wrattler_python_service.python_service_utils.write_frame') as mock_write_frame:
            return_dict = handle_eval({"code": input_code,
                                       "frames": [],
                                       "hash": "testhash3",
                                       "files": ["http://dummy_datastore:7102/some/file"]
            })
            assert("Result is 3" in return_dict["output"])


def test_html_output():
    """
    test that we get an 'html_output' field in the return_dict if we
    call the addOutput function in our code fragment.
    """

    file_content = ""
    input_code = 'addOutput("some_html")\n'
    cell_hash = "testhash4"
    with patch('wrattler_python_service.python_service_utils.write_frame') as mock_write_frame:
        return_dict = handle_eval({"code": input_code,
                                   "frames": [],
                                   "hash": "testhash3",
                                   "files": []
            })
        assert("html" in return_dict.keys())

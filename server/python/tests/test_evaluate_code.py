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

from python_service import evaluate_code, read_frame
from exceptions import ApiException
from .fixtures import mock_datastore, mock_read_frame, mock_write_frame, mock_write_image


def test_hello_world(mock_datastore):
    """
    test that a simple print statement gives text output but no
    output frames.
    """
    input_code = 'print("hello world")'
    with patch('python_service.write_frame') as mock_write_frame:

        return_dict = evaluate_code({"code":input_code,
                                     "frames": [],
                                     "hash": "irrelevant"})
        assert(return_dict["output"]=="hello world")
        assert(len(return_dict["frames"])==0)


def test_assignment(mock_datastore):
    """
    test that a simple assignment outputs the url for a dataframe
    """
    input_code = 'df = pd.DataFrame({"x":[1,2,3]})'
    with patch('python_service.write_frame') as mock_write_frame:
        return_dict = evaluate_code({"code":input_code,
                                     "frames": [],
                                     "hash": "irrelevant"})
        assert(return_dict["output"]=="")
        assert(len(return_dict["frames"])==1)
        assert(return_dict["frames"][0]["name"]=="df")
        assert(return_dict["frames"][0]["url"].endswith("/df"))


def test_concat(mock_datastore):
    """
    test that we can concatenate two dataframes
    """
    input_code = 'df1 = pd.DataFrame({"name":["Alice","Bob"],"occupation":["cryptographer","crook"]})\n'
    input_code += 'df2 = pd.DataFrame({"name":["Carol"],"occupation":["copper"]})\n'
    input_code += 'df3 = df1.append(df2)\n'
    with patch('python_service.write_frame') as mock_write_frame:
        return_dict = evaluate_code({"code":input_code,
                                     "frames": [],
                                     "hash": "testhash1"})
        assert(len(return_dict["frames"])==3)
        assert(return_dict["frames"][2]["url"].endswith("df3"))


def test_create_plot(mock_datastore):
    """
    test that if we make a pyplot, it creates a file fig.png in /tmp/<cell_hash>/
    """
    shutil.rmtree("/tmp/testhash2",ignore_errors=True)
    input_code = "import matplotlib.pyplot as plt\nplt.plot([1,2,3])\n"
    with patch('python_service.write_frame') as mock_write_frame:
        with patch('python_service.write_image') as mock_write_image:
            return_dict = evaluate_code({"code": input_code,
                                         "frames": [],
                                         "hash": "testhash2"})
            assert(os.path.exists("/tmp/testhash2/fig.png"))

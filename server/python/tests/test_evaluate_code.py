"""
slightly higher-level tests than those in test_execute_code" -
in addition to checking we execute the code block correcly, we also
check that we get the correct return values and imports.
"""

import os
import pytest
import pandas as pd

from python_service import evaluate_code
from exceptions import ApiException

@pytest.mark.skipif("WRATTLER_LOCAL_TEST" in os.environ.keys(),
                    reason="Needs data-store to be running")
def test_hello_world():
    """
    test that a simple print statement gives text output but no
    output frames.
    """
    input_code = 'print("hello world")'
    return_dict = evaluate_code({"code":input_code,
                                 "frames": [],
                                 "hash": "irrelevant"})
    assert(return_dict["output"]=="hello world")
    assert(len(return_dict["frames"])==0)

@pytest.mark.skipif("WRATTLER_LOCAL_TEST" in os.environ.keys(),
                    reason="Needs data-store to be running")
def test_assignment():
    """
    test that a simple assignment outputs the url for a dataframe
    """
    input_code = 'df = pd.DataFrame({"x":[1,2,3]})'
    return_dict = evaluate_code({"code":input_code,
                                 "frames": [],
                                 "hash": "irrelevant"})
    assert(return_dict["output"]=="")
    assert(len(return_dict["frames"])==1)
    assert(return_dict["frames"][0]["name"]=="df")
    assert(return_dict["frames"][0]["url"].endswith("/df"))

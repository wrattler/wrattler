"""
Test that we can execute a variety of simple python commands and get the expected result
"""
import pytest
import json
import pandas as pd

from python_service import execute_code, find_assignments
from exceptions import ApiException

def test_execute_pd_concat():
    """
    given an input dict of value assignments and a code snippet,
    substitute the values in, and evaluate.
    """
    input_code = "z = pd.concat([x,y],join='outer', ignore_index=True)"
    input_vals = {"x" : [{"a":1, "b":2},{"a":2,"b":3}],
                  "y": [{"b":4,"c": 2},{"b": 5,"c": 7}]}
    output_hash = "somehash"
    return_targets = find_assignments(input_code)["targets"]
    result_dict = execute_code(input_code, input_vals, return_targets, output_hash)
    result = result_dict["results"]
    print(result)  # result will be a list of lists of dicts
    assert(len(result) == 1) # only one output of function
    assert(len(json.loads(result[0])) == 4) # four 'rows' of dataframe
    assert(len(json.loads(result[0])[0]) == 3) # three 'columns'


def test_execute_simple_func():
    """
    import numpy, and define a trivial function in the code snippet, which is
    then used when filling a dataframe
    """
    input_code='import numpy\ndef squareroot(x):\n  return numpy.sqrt(x)\n\ndf= pd.DataFrame({\"a\":[numpy.sqrt(9),squareroot(12),13],\"b\":[14,15,16]})'
    input_vals={}
    return_targets = find_assignments(input_code)["targets"]
    output_hash = "somehash"
    result_dict = execute_code(input_code, input_vals, return_targets, output_hash)
    result = result_dict["results"]
    assert(result)
    assert(isinstance(result,list))


def test_get_error_output():
    """
    Do something stupid (division by zero) and test that we get an error in the output
    """
    input_code='x = 1/0'
    input_vals={}
    return_targets = find_assignments(input_code)["targets"]
    output_hash = "somehash"
    with pytest.raises(ApiException) as exc:
        result_dict = execute_code(input_code, input_vals, return_targets, output_hash)
        assert("ZeroDivisionError" in exc.message)


def test_get_normal_output():
    """
    Write simple print statement and test that we get it in the output
    """
    input_code='print("hello world")'
    input_vals={}
    return_targets = find_assignments(input_code)["targets"]
    output_hash = "somehash"
    result_dict = execute_code(input_code, input_vals, return_targets, output_hash)
    output = result_dict["output"]
    assert(output)
    assert(isinstance(output,str))
    assert("hello world" in output)
    assert(len(result_dict["results"])==0)


def test_get_two_normal_outputs():
    """
    Write two simple print statement and test that we get a single output string with two lines
    """
    input_code='print("hello world")\nprint("hi again")\n'
    input_vals={}
    return_targets = find_assignments(input_code)["targets"]
    output_hash = "somehash"
    result_dict = execute_code(input_code, input_vals, return_targets, output_hash)
    output = result_dict["output"]
    print(output)
    assert(output)
    assert(isinstance(output,str))
    assert("hello world" in output)
    assert("hi again" in output)
    assert(output.count("\n")==1)


def test_get_normal_output_in_func():
    """
    Write simple print statement inside a function and test that we get it in the output
    """
    input_code='def printy():\n print("hello funcky world")\n\nprinty()'
    input_vals={}
    return_targets = find_assignments(input_code)["targets"]
    output_hash = "somehash"
    result_dict = execute_code(input_code, input_vals, return_targets, output_hash)
    output = result_dict["output"]
    assert(output)
    assert(isinstance(output,str))
    assert("hello funcky world" in output)

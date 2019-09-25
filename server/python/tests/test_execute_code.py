"""
Test that we can execute a variety of simple python commands and get the expected result
"""
import pytest
import json
import pandas as pd
import pyarrow as pa

from wrattler_python_service.python_service_utils import execute_code, find_assignments, convert_to_pandas
from wrattler_python_service.exceptions import ApiException

def test_execute_pd_concat():
    """
    given an input dict of value assignments and a code snippet,
    substitute the values in, and evaluate.
    """
    input_code = "z = pd.concat([x,y],join='outer', ignore_index=True, sort=True)"
    input_vals = {"x" : [{"a":1, "b":2},{"a":2,"b":3}],
                  "y": [{"b":4,"c": 2},{"b": 5,"c": 7}]}
    output_hash = "somehash"
    file_contents = {}
    return_targets = find_assignments(input_code)["targets"]
    result_dict = execute_code(file_contents,
                               input_code,
                               input_vals,
                               return_targets,
                               output_hash)
    result = result_dict["results"]
    assert(len(result) == 1) # only one output of function
    assert(isinstance(result['z'], bytes))
    result_df = convert_to_pandas(result['z'])
    assert(result_df.size == 12) ## 4 rows * 3 columns


def test_execute_simple_func():
    """
    import numpy, and define a trivial function in the code snippet, which is
    then used when filling a dataframe
    """
    input_code = 'import numpy\ndef squareroot(x):\n  return numpy.sqrt(x)\n\ndf= pd.DataFrame({\"a\":[numpy.sqrt(9),squareroot(16),13],\"b\":[14,15,16]})'
    input_vals = {}
    file_contents = {}
    return_targets = find_assignments(input_code)["targets"]
    output_hash = "somehash"
    result_dict = execute_code(file_contents,
                               input_code,
                               input_vals,
                               return_targets,
                               output_hash)
    result = result_dict["results"]
    assert(result)
    assert(isinstance(result,dict))
    assert("df" in result.keys())
    pddf = convert_to_pandas(result["df"])
    assert(isinstance(pddf, pd.DataFrame))
    assert(pddf["a"][0]==3)
    assert(pddf["a"][1]==4)


def test_non_df_assignment():
    """
    Check that things that can't be converted into dataframes do not get added to the
    results dict
    """
    input_code = "x='hello'\ndf=pd.DataFrame({'a':[1,2,3]})\n"
    file_contents = {}
    output_hash = "doesntmatter"
    input_vals = {}
    return_targets = ["df","x"]
    result_dict = execute_code(file_contents,
                               input_code,
                               input_vals,
                               return_targets,
                               output_hash)
    result = result_dict["results"]
    assert(result)
    assert("df" in result.keys())
    assert("x" not in result.keys())


def test_get_error_output():
    """
    Do something stupid (division by zero) and test that we get an error in the output
    """
    input_code='x = 1/0'
    input_vals={}
    file_contents = {}
    return_targets = find_assignments(input_code)["targets"]
    output_hash = "somehash"
    with pytest.raises(ApiException) as exc:
        result_dict = execute_code(file_contents,
                                   input_code,
                                   input_vals,
                                   return_targets,
                                   output_hash)
        assert("ZeroDivisionError" in exc.message)


def test_get_normal_output():
    """
    Write simple print statement and test that we get it in the output
    """
    input_code = 'print("hello world")'
    input_vals = {}
    file_contents = {}
    return_targets = find_assignments(input_code)["targets"]
    output_hash = "somehash"
    result_dict = execute_code(file_contents,
                               input_code,
                               input_vals,
                               return_targets,
                               output_hash)
    output = result_dict["output"]
    assert(output)
    assert(isinstance(output,str))
    assert("hello world" in output)
    assert(len(result_dict["results"])==0)


def test_get_two_normal_outputs():
    """
    Write two simple print statement and test that we get a single output string with two lines
    """
    input_code = 'print("hello world")\nprint("hi again")\n'
    input_vals = {}
    file_contents = {}
    return_targets = find_assignments(input_code)["targets"]
    output_hash = "somehash"
    result_dict = execute_code(file_contents,
                               input_code,
                               input_vals,
                               return_targets,
                               output_hash)
    output = result_dict["output"]
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
    file_contents = {}
    return_targets = find_assignments(input_code)["targets"]
    output_hash = "somehash"
    result_dict = execute_code(file_contents,
                               input_code,
                               input_vals,
                               return_targets,
                               output_hash)
    output = result_dict["output"]
    assert(output)
    assert(isinstance(output,str))
    assert("hello funcky world" in output)


def test_use_function_from_file():
    """
    imagine we had a file from the datastore containing
    a function definition and an import statement - test
    we can then use these in the code cell.
    """
    input_code = 'print("Result is {}".format(myfunc(4)))'
    input_vals = {}
    file_contents = {'someFile.py': 'import numpy\ndef myfunc(inputval):\n  return numpy.sqrt(inputval)\n'}
    return_targets = find_assignments(input_code)["targets"]
    output_hash = "irrelevant"
    result_dict = execute_code(file_contents,
                               input_code,
                               input_vals,
                               return_targets,
                               output_hash)
    output = result_dict["output"]
    assert(output)
    assert(isinstance(output,str))
    assert("Result is 2" in output)


def test_syntax_error_in_file():
    """
    imagine we had a file from the datastore containing
    a function definition and an import statement, but there's a syntax error
    (e.g. 'dfe' rather than 'def') - should throw an ApiException and tell us the
    filename.
    """
    input_code = 'print("Hello world")\n'
    input_vals = {}

    file_contents = {'someFile.py': 'import numpy\ndfe myfunc(inputval):\n  return numpy.sqrt(inputval)\n'}
    return_targets = find_assignments(input_code)["targets"]
    output_hash = "irrelevant"
    with pytest.raises(ApiException) as exc:
        result_dict = execute_code(file_contents,
                                   input_code,
                                   input_vals,
                                   return_targets,
                                   output_hash)

        assert('someFile.py' in exc.message)


def test_syntax_error_in_code():
    """
    We have a function definition in someFile.py but we have a typo in our code fragment
    """
    input_code = 'pritn(printHello("Wrattler"))\n'
    input_vals = {}

    file_contents = {'someFile.py': 'def printHello(inputname):\n  return "hello {}".format(inputname)\n'}
    return_targets = find_assignments(input_code)["targets"]
    output_hash = "irrelevant"
    with pytest.raises(ApiException) as exc:
        result_dict = execute_code(file_contents,
                                   input_code,
                                   input_vals,
                                   return_targets,
                                   output_hash)

        assert('code in cell' in exc.message)


def test_html_output_string():
    """
    Test the addOutput functionality with a string argument
    """
    input_code = 'addOutput("<html></html>")\n'
    input_vals = {}
    file_contents = {}
    return_targets = find_assignments(input_code)["targets"]
    output_hash = "irrelevant"
    result_dict = execute_code(file_contents,
                               input_code,
                               input_vals,
                               return_targets,
                               output_hash)

    assert('html' in result_dict.keys())
    assert(result_dict["html"]=="<html></html>")

def test_html_output_wrong_type():
    """
    Test the addOutput functionality with a string argument
    """
    input_code = 'addOutput(42)\n'
    input_vals = {}
    file_contents = {}
    return_targets = find_assignments(input_code)["targets"]
    output_hash = "irrelevant"
    with pytest.raises(ApiException) as exc:
        result_dict = execute_code(file_contents,
                                   input_code,
                                   input_vals,
                                   return_targets,
                                   output_hash)

        assert('code in cell' in exc.message)

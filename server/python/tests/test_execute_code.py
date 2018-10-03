"""
Test that we can write some frames with simple variable
assignments, then use these to do a simple join
"""
import pandas as pd

from python_service import execute_code, find_assignments

def test_execute_pd_concat():
    """
    given an input dict of value assignments and a code snippet,
    substitute the values in, and evaluate.
    """
    input_code = "z = pd.concat([x,y],join='outer', ignore_index=True)"
    input_vals = {"x" : [{"a":1, "b":2},{"a":2,"b":3}],
                  "y": [{"b":4,"c": 2},{"b": 5,"c": 7}]}
    return_targets = find_assignments(input_code)["targets"]
    result = execute_code(input_code, input_vals, return_targets)
    print(result)  # result will be a list of lists of dicts
    assert(len(result) == 1) # only one output of function
    assert(len(result[0]) == 4) # four 'rows' of dataframe
    assert(len(result[0][0]) == 3) # three 'columns'


def test_execute_simple_func():
    """
    import numpy, and define a trivial function in the code snippet, which is
    then used when filling a dataframe
    """
    input_code='import numpy\ndef squareroot(x):\n  return numpy.sqrt(x)\n\ndf= pd.DataFrame({\"a\":[numpy.sqrt(9),squareroot(12),13],\"b\":[14,15,16]})'
    input_vals={}
    return_targets = find_assignments(input_code)["targets"]
    result = execute_code(input_code, input_vals, return_targets)
    assert(result)
    assert(isinstance(result,list))

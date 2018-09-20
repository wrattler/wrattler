"""
Test that we can write some frames with simple variable
assignments, then use these to do a simple join
"""

from python_service import execute_code, find_assignment_targets

def test_execute():
    """
    given an input dict of value assignments and a code snippet,
    substitute the values in, and evaluate.
    """
    input_code = "z = pd.concat([x,y],join='outer', ignore_index=True)"
    input_vals = {"x" : [{"a":1, "b":2},{"a":2,"b":3}],
                  "y": [{"b":4,"c": 2},{"b": 5,"c": 7}]}
    return_targets = find_assignment_targets(input_code)
    result = execute_code(input_code, input_vals, return_targets)
    print(result)
    assert(len(result) == 4)
    assert(len(result[0]) == 3)

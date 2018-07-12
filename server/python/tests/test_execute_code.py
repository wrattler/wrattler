"""
Test that we can write some frames with simple variable 
assignments, then use these to do 2+2=4
"""

from python_service import execute_code

def test_execute():
    """
    given an input dict of value assignments and a code snippet,
    substitute the values in, and evaluate.
    """
    input_code = "x+y"
    input_vals = {"x" : 3, "y": 5}
    result = execute_code(input_code, input_vals)
    assert(result==8)

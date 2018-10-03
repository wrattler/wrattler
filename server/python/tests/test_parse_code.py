"""
See if we can get the input and output frames from a code snippet
"""

from python_service import analyze_code

def test_simple_exports():
    """
    check we can understand a simple variable assignment
    """
    testdata = {"code": "x = 5",
                "frames": [],
                "hash": "doesnmatter"}
    result = analyze_code(testdata)
    print(result)
    assert(result["exports"][0]=="x")

def test_simple_imports():
    """
    check we can understand a simple variable assignment where
    one term on the rhs is an existing frame
    """
    testdata = {"code": "x = y + 5",
                "frames": ["y"],
                "hash": "doesnmatter"}
    result = analyze_code(testdata)
    print(result)
    assert(result["imports"][0]=="y")


def test_multiple_assignment():
    """
    function might have two return values to unpack
    """
    testdata = {"code": "x,y = funcoutput(z)",
                "frames": ["z","a","b"],
                "hash": "doesntmatter"}
    result = analyze_code(testdata)
    print(result)
    assert(result["exports"] == ["x","y"])
    assert(result["imports"] == ["z"])


def test_confusing_names():
    """
    Need to tell the difference between e.g. "x" and "xx"
    """
    testdata = {"code": "xx = xxx(x) + yy",
                "frames": ["x","y"],
                "hash": "doesntmatter"}
    result = analyze_code(testdata)
    print(result)
    assert(result["exports"]==["xx"])
    assert(result["imports"]==["x"])

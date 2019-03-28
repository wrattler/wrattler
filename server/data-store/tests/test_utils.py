"""
Test the utility functions that convert between json and arrows,
and filter just the first N rows of the returned data.
"""

import json
import pyarrow as pa
import pytest

from utils import *

def test_json_to_arrow():
    """
    Check we can go from json object to arrow buffer
    """
    dfj = [{"a": 1, "b": 10, "c": 100},
           {"a": 2, "b": 20, "c": 200},
           {"a": 3, "b": 30, "c": 300}]
    buf = json_to_arrow(dfj)
    assert(isinstance(buf, pa.lib.Buffer))

"""
Test the utility functions that convert between json and arrows,
and filter just the first N rows of the returned data.
"""

import json
import pyarrow as pa
import pandas as pd
import pytest

from utils import *

def is_arrow_format(data):
    """
    utility function to see if something
    is interpretable as an Apache Arrow buffer
    """
    try:
        reader = pa.ipc.open_file(data)
        return True
    except(pa.lib.ArrowTypeError):
        return False


def test_json_to_arrow():
    """
    Check we can go from json object to arrow buffer
    """
    dfj = [{"a": 1, "b": 10, "c": 100},
           {"a": 2, "b": 20, "c": 200},
           {"a": 3, "b": 30, "c": 300}]
    buf = json_to_arrow(dfj)
    assert(is_arrow_format(buf))


def test_arrow_to_json():
    """
    Check we can get a row-wise json representation of a df from an arrow buffer
    """
    df = pd.DataFrame({"a":[1,2,3],"b":[4,5,6]})
    batch = pa.RecordBatch.from_pandas(df, preserve_index=False)
    sink = pa.BufferOutputStream()
    writer = pa.RecordBatchFileWriter(sink, batch.schema)
    writer.write_batch(batch)
    writer.close()
    arrow_buffer = sink.getvalue()
    assert(is_arrow_format(arrow_buffer))
    jdf = json.loads(arrow_to_json(arrow_buffer))
    assert(isinstance(jdf, list))
    assert(len(jdf)==3)
    assert(isinstance(jdf[0],dict))
    assert(jdf[0]["a"] == 1)



def test_filter_json_rowwise():
    """
    Check we can get just the first 5 rows of a 'records' oriented json df representation
    """
    jdf = []
    for i in range(10):
        jdf.append({"a": i, "b": 10*i})
    assert(len(jdf)==10)
    new_jdf = json.loads(filter_json(jdf, 5))
    assert(isinstance(new_jdf, list))
    assert(len(new_jdf)==5)
    assert(new_jdf[-1]["a"]==4)
    assert(new_jdf[-1]["b"]==40)


def test_filter_json_columnwise():
    """
    Check we can get the first 5 rows of a column-wise json df representation.
    """
    jdf = {"a": list(range(10)), "b": list(range(0,100,10))}
    new_jdf = json.loads(filter_json(jdf, 5))
    assert(isinstance(new_jdf, dict))
    assert(len(new_jdf["a"]) == 5)
    assert(new_jdf["a"][-1] == 4)
    assert(new_jdf["b"][-1] == 40)


def test_filter_arrow():
    """
    Check we can get the first 5 rows of an arrow buffer
    """
    jdf = []
    for i in range(10):
        jdf.append({"a": i, "b": 10*i})
    buf = json_to_arrow(jdf)
    assert(is_arrow_format(buf))
    new_buf = filter_arrow(buf, 5)
    assert(is_arrow_format(new_buf))
    new_jdf = json.loads(arrow_to_json(new_buf))
    assert(isinstance(new_jdf, list))
    assert(len(new_jdf)==5)


def test_convert_to_arrow():
    """
    Check we can convert different forms of json
    (actual json list, string, bytes) into arrow
    """

    jdf = [{"a":1,"b":2},{"a":3,"b":4}]
    a1 = convert_to_arrow(jdf)
    assert(is_arrow_format(a1))
    sdf = '[{"a":1,"b":2},{"a":3,"b":4}]'
    a2 = convert_to_arrow(sdf)
    assert(is_arrow_format(a2))
    bdf = b'[{"a":1,"b":2},{"a":3,"b":4}]'
    assert(isinstance(bdf,bytes))
    a3 = convert_to_arrow(bdf)
    assert(is_arrow_format(a3))

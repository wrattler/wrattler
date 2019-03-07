"""
test reading and writing binary and json strings to
local storage
"""

import os
import pytest
import json
import uuid
import pandas as pd
import pyarrow as pa


from storage import *


def test_write_json_string():
    """
    Write a simple json string
    """
    j = '[{"name": "Alice", "occupation": "researcher"}]'
    s = Store("Local")
    frame_hash = str(uuid.uuid4())
    frame_name = str(uuid.uuid4())
    s.write(j, frame_hash, frame_name)
    assert(os.path.exists(os.path.join(s.store.dirname, frame_hash, frame_name)))


def test_read_json_string():
    """
    Read a json string
    """
    j = '[{"name": "Bob", "occupation": "student"}]'
    s = Store("Local")
    frame_hash = str(uuid.uuid4())
    frame_name = str(uuid.uuid4())
    os.makedirs(os.path.join(s.store.dirname, frame_hash), exist_ok=True)
    with open(os.path.join(s.store.dirname,frame_hash, frame_name),"w") as outfile:
        outfile.write(j)
    result = s.read(frame_hash, frame_name)
    assert(result == j)


def test_write_arrow():
    """
    Write an arrow buffer
    """
    buf = pa.py_buffer(b'abcdefghijklmnopqrstuvwxyz')
    s = Store("Local")
    frame_hash = str(uuid.uuid4())
    frame_name = str(uuid.uuid4())
    s.write(buf, frame_hash, frame_name)
    assert(os.path.exists(os.path.join(s.store.dirname, frame_hash, frame_name)))


def test_read_arrow():
    """
    Read an arrow file.  First create one from a pandas df
    """
    df = pd.DataFrame({"a":[1,3,5],"b":[2,4,6]})
    batch = pa.RecordBatch.from_pandas(df, preserve_index=False)
    sink = pa.BufferOutputStream()
    writer = pa.RecordBatchFileWriter(sink, batch.schema)
    writer.write_batch(batch)
    writer.close()
    arrow_buffer = sink.getvalue()
    # now write this to disk
    s = Store("Local")
    frame_hash = str(uuid.uuid4())
    frame_name = str(uuid.uuid4())
    os.makedirs(os.path.join(s.store.dirname, frame_hash), exist_ok=True)
    with open(os.path.join(s.store.dirname,frame_hash, frame_name),"wb") as outfile:
        outfile.write(arrow_buffer)
    # now try and read it back
    result = s.read(frame_hash, frame_name)
    reader = pa.ipc.open_file(result)
    df_new = reader.read_pandas()
    assert(pd.DataFrame.equals(df,df_new))

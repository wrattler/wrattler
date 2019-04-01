"""
Test reading and writing binary and json strings to
Azure blob storage
"""

import os
import pytest
import json
import uuid
import pandas as pd
import pyarrow as pa


from storage import *

@pytest.mark.skipif("WRATTLER_LOCAL_STORAGE" in os.environ.keys(),
                    reason="Relies on Azure backend")
def test_json_round_trip():
    """
    Write a simple json string and read it back
    """
    j = '[{"name": "Alice", "occupation": "researcher"}]'
    s = Store("Azure")
    frame_hash = str(uuid.uuid4())
    frame_name = str(uuid.uuid4())
    s.write(j, frame_hash, frame_name)
    result = s.read(frame_hash, frame_name).decode("utf-8")
    assert(result == j)


@pytest.mark.skipif("WRATTLER_LOCAL_STORAGE" in os.environ.keys(),
                    reason="Relies on Azure backend")
def test_arrow_round_trip():
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
    # now write this to the datastore
    s = Store("Azure")
    frame_hash = str(uuid.uuid4())
    frame_name = str(uuid.uuid4())
    s.write(arrow_buffer.to_pybytes(), frame_hash, frame_name)
    # now try and read it back
    result = s.read(frame_hash, frame_name)
    reader = pa.ipc.open_file(result)
    df_new = reader.read_pandas()
    assert(pd.DataFrame.equals(df,df_new))

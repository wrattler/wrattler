"""
Utility functions for data-store flask app
"""

import json
import pyarrow as pa
import pandas as pd

def filter_json(data, nrow):
    """
    return the first nrow rows of a json object,
    that can be structured as a list of rows [{"colname": val1, ..},...]
    or a dict with keys as column headings and vals as lists of column values
    {"col":[val1,val2,...], ...}
    """
    if isinstance(data, list):
        return data[:nrow]
    elif isinstance(data, dict):
        new_dict = {}
        for k, v in data.items():
            new_dict[k] = v[:nrow]
        return new_dict
    else:  ## unknown format - just return data as-is
        return data


def filter_arrow(data, nrow):
    """
    Use the 'slice' method of an arrow RecordBatch to return
    the first nrow rows.
    Necessitates conversion between FileBuffer and RecordBatch
    and vice versa.
    """
    reader = pa.ipc.open_file(data)
    record_batch = reader.get_record_batch(0)
    sliced_batch = record_batch.slice(length=nrow)
    sink = pa.BufferOutputStream()
    writer = pa.RecordBatchFileWriter(sink, sliced_batch.schema)
    writer.write_batch(sliced_batch)
    writer.close()
    arrow_buffer = sink.getvalue()
    return arrow_buffer


def filter_data(data, nrow):
    """
    return the first nrow rows of data.
    """
    if isinstance(data, list) or isinstance(data, dict):
        return filter_json(data, nrow)
    elif isinstance(data, pa.lib.Buffer):
        return filter_arrow(data, nrow)
    else: ### unknown format - just return data as-is
        return data


def arrow_to_json(data):
    """
    Convert an arrow FileBuffer into a row-wise json format.
    Go via pandas (To be revisited!!)
    """
    reader = pa.ipc.open_file(data)
    frame = reader.read_pandas()
    return frame.to_json(orient='records')


def json_to_arrow(data):
    """
    Convert a row-wise json object to an arrow FileBuffer.
    Going via pandas (to be revisited!)
    """
    frame = None
    try:
        frame = pd.DataFrame.from_records(data)
    except():
        return data

    batch = pa.RecordBatch.from_pandas(frame, preserve_index=False)
    sink = pa.BufferOutputStream()
    writer = pa.RecordBatchFileWriter(sink, batch.schema)
    writer.write_batch(batch)
    writer.close()
    arrow_buffer = sink.getvalue()
    return arrow_buffer

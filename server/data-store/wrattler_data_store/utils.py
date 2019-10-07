"""
Utility functions for data-store flask app
"""

import json
import pyarrow as pa
import pandas as pd
from .exceptions import DataStoreException


def filter_json(data, nrow):
    """
    return the first nrow rows of a json object,
    that can be structured as a list of rows [{"colname": val1, ..},...]
    or a dict with keys as column headings and vals as lists of column values
    {"col":[val1,val2,...], ...}
    """
    if isinstance(data, list):
        return json.dumps(data[:nrow])
    elif isinstance(data, dict):
        new_dict = {}
        for k, v in data.items():
            new_dict[k] = v[:nrow]
        return json.dumps(new_dict)
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
    return arrow_buffer.to_pybytes()


def filter_data(data, nrow):
    """
    return the first nrow rows of data.
    """
    if isinstance(data, bytes):
        try:
            filtered_arrow = filter_arrow(data, nrow)
            return filtered_arrow
        except:
            try:
                data = data.decode("utf-8")
            except(UnicodeDecodeError):
                raise DataStoreError("Bytes data doesn't seem to be arrow or unicode")
    ## see if we can decode as JSON
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except(JSONDecodeError):
            raise DataStoreException("String does not seem to be JSON")
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
    try:
        frame = reader.read_pandas()
        return frame.to_json(orient='records')
    except:
        raise DataStoreException("Unable to convert to JSON")


def json_to_arrow(data):
    """
    Convert a row-wise json object to an arrow FileBuffer.
    Going via pandas (to be revisited!)
    """
    frame = None
    try:
        frame = pd.DataFrame.from_records(data)
    except:
        return data

    batch = pa.RecordBatch.from_pandas(frame, preserve_index=False)
    sink = pa.BufferOutputStream()
    writer = pa.RecordBatchFileWriter(sink, batch.schema)
    writer.write_batch(batch)
    writer.close()
    arrow_buffer = sink.getvalue()
    return arrow_buffer.to_pybytes()


def convert_to_json(data):
    """
    Try to convert a few different formats (bytes, str, arrow)
    into a JSON string
    """
    if (isinstance(data, list) or isinstance(data,dict)):
        return json.dumps(data)
    elif (isinstance(data,str)):
        try:
            json_obj = json.loads(data)
            ## if that worked, it was already a json string
            return data
        except:
            raise DataStoreException("Received string, but not json format")
    elif (isinstance(data, bytes)):
        ## see if it is a json string in bytes format
        try:
            data = json.loads(data.decode('utf-8'))
        except(UnicodeDecodeError):
            try:
                data = arrow_to_json(data)
            except(DataStoreException):
                raise DataStoreException("Receieved 'bytes' data but not Apache Arrow format")
    elif (isinstance(data, pa.lib.Buffer)):
        data = arrow_to_json(data)
    else:
        raise DataStoreException("Unknown data format - cannot convert to JSON")
    return data


def convert_to_arrow(data):
    """
    Try to convert into arrow format if it wasn't already
    """
    if isinstance(data, pa.lib.Buffer):
        return data.to_pybytes()
    elif isinstance(data, bytes):
        try:
            reader = pa.ipc.open_file(data)
            ## if that line worked, must be arrow buffer
            return data
        except(pa.lib.ArrowInvalid):
            try:
                strdata = data.decode("utf-8")
                jsondata = json.loads(strdata)
                return json_to_arrow(jsondata)
            except:
                raise DataStoreException("Unknown bytes data format - cannot convert to Arrow")
    elif (isinstance(data, list) or isinstance(data,dict)):
        return json_to_arrow(data)
    elif (isinstance(data, str)):
        try:
            data = json.loads(data)
            return json_to_arrow(data)
        except:
            raise DataStoreException("Cannot convert string to Arrow")
    else:
        raise DataStoreException("Unknown data format - cannot convert to Arrow")

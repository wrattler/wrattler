"""
Check we can read and write to the data store.
"""

import os
import pytest

from python_service import read_frame, write_frame, retrieve_frames

frame_hash = 'abc123def'
frame_name = 'testframe'
if "DATASTORE_URI" in os.environ.keys():
    datastore_base_url = os.environ["DATASTORE_URI"]
else:
    datastore_base_url = 'http://localhost:7102'

@pytest.mark.skipif("WRATTLER_LOCAL_TEST" in os.environ.keys(),
                    reason="Needs data-store to be running")
def test_write_frame():
    """
    Write a frame
    """
    test_data = [
        {"var_1": "123", "var_2": "abc"},
        {"var_1": "456", "var_2": "def"}
    ]
    wrote_ok = write_frame(test_data,
                           frame_name,
                           frame_hash)
    assert(wrote_ok==True)

@pytest.mark.skipif("WRATTLER_LOCAL_TEST" in os.environ.keys(),
                    reason="Needs data-store to be running")
def test_read_frame():
    """
    Read back the same frame
    """
    data = read_frame(frame_name, frame_hash)
    assert(len(data)==2)
    assert(data[0]["var_1"]=="123")
    assert(data[0]["var_2"]=="abc")
    assert(data[1]["var_1"]=="456")
    assert(data[1]["var_2"]=="def")

@pytest.mark.skipif("WRATTLER_LOCAL_TEST" in os.environ.keys(),
                    reason="Needs data-store to be running")
def test_retrieve_frames():
    """
    as used by eval function - get frames from url,
    and put contents into a dictionary.
    """
    frame_list = [{"name": "test_frame",
                   "url":  '{}/{}/{}'.format(datastore_base_url,
                                             frame_hash,
                                             frame_name)}]
    data = retrieve_frames(frame_list)
    print(data)

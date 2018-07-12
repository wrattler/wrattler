"""
Check we can read and write to the data store.
"""

from python_service import read_frame, write_frame, retrieve_frames

frame_hash = 'abc123def'
frame_name = 'testframe'
datastore_base_url = 'http://localhost:7102'


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


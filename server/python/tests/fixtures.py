"""
mock flask app and mock datastore for use in tests
"""

from flask import Flask
from flask_restful import Api

import pytest


@pytest.fixture(scope='module')
def demo_app():
    """
    setup a flask app
    """
    app = Flask(__name__)
    app.testing = True
    api = Api(app)
    return app


class MockDataStore(object):
    def __init__(self):
        self.data_dict = {}
    def store(self,content, frame, cell_hash):
        self.data_dict[cell_hash+"/"+frame] = content

    def retrieve(self,frame, cell_hash):
        return self.data_dict[cell_hash+"/"+frame]


@pytest.fixture
def mock_datastore(scope='module'):
    """
    instantiate a MockDataStore object that can hold values in memory.
    """
    ds = MockDataStore()
    return ds


def mock_write_frame(mock_datastore, data, frame_name, cell_hash):
    mock_datastore.store(data,frame_name, cell_hash)
    print("In mock_write_frame!")
    return True


def mock_write_image(mock_datastore, data, cell_hash):
    print("In mock_write_image!")
    return True


def mock_get_file_content(mock_datastore, url):
    print("In mock_get_file_content!")
    cell_hash, filename = url.split("/")[-2:]
    file_content = mock_datastore.retrieve(filename, cell_hash)
    return file_content


def mock_read_frame(mock_datastore, frame_name, cell_hash):
    print("In mock_read_frame!")
    data = mock_datastore.retrieve(frame_name, cell_hash)
    print(data)
    return data

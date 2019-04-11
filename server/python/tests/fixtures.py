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
    def store(self,content, frame, hash):
        self.data_dict[hash+"/"+frame] = content

    def retrieve(self,frame, hash):
        return self.data_dict[hash+"/"+frame]


@pytest.fixture
def mock_datastore(scope='module'):
    ds = MockDataStore()
    return ds



def mock_write_frame(mock_datastore,data, frame_name,cell_hash):
    mock_datastore.store(data,frame_name, cell_hash)
    return True

def mock_write_image(mock_datastore,data, cell_hash):
    return True



def mock_read_frame(mock_datastore, frame_name, cell_hash):
    data = mock_datastore.retrieve(frame_name, cell_hash)
    print(data)
    return data

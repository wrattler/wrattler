"""
test hitting the api endpoints.
Use a test fixture to mock the datastore.
"""

"""
test the API endpoints using a mock datastore
"""

from unittest.mock import patch

from .fixtures import *
from python_service import *


def test_exports(mock_datastore):
    with patch('python_service.write_frame') as mock_write_frame:
        write_frame({"a":4},"a","abc")


def test_eval(mock_datastore):
    with patch('python_service.read_frame') as mock_read_frame:
        f=read_frame("a","abc")
        print(f)

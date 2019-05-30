"""
test hitting the api endpoints.
Use a test app to mask .
"""

import pytest
from unittest.mock import patch
import json

from app import create_app


@pytest.fixture(scope='module')
def test_client():
    flask_app = create_app("python_test")
    testing_client = flask_app.test_client()

    ## Establish application context.
    ctx = flask_app.app_context()
    ctx.push()

    yield testing_client
    ctx.pop()


def test_exports_simple_assignment(test_client):
    """
    test the exports endpoint.
    """
    testcode = 'x = pd.DataFrame({"a": [1,2,3]})'
    testframes = []
    testhash = "abcdef"

    response = test_client.post("/exports",data=json.dumps({"code": testcode,
                                                            "frames": testframes,
                                                            "hash": testhash}))
    assert response.status_code == 200
    response_data = json.loads(response.data.decode('utf-8'))
    assert "imports" in response_data.keys()
    assert response_data["imports"] == []
    assert "exports" in response_data.keys()
    assert response_data["exports"] == ["x"]


def test_eval_simple_assignment(test_client):
    """
    test the eval endpoint - will need to mock some things
    """
    testcode = 'print("hello world")\nx = pd.DataFrame({"a": [1,2,3]})'
    testframes = []
    testhash = "abcdef"
    with patch('python_service.write_frame', return_value=True) as mock_write_frame:
        response = test_client.post("/eval",data=json.dumps({"code": testcode,
                                                             "frames": testframes,
                                                             "hash": testhash}))
        assert response.status_code == 200
        response_data = json.loads(response.data.decode('utf-8'))
        assert "output" in response_data.keys()
        assert "hello world" in response_data["output"]
        assert "frames" in response_data.keys()
        assert len(response_data["frames"]) == 1
        assert "figures" in response_data.keys()
        assert len(response_data["figures"]) == 0

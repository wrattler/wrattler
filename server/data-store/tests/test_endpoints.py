"""
Test that we get sensible responses back when we hit the API endpoints
"""

import os
import flask
import pytest
import json
import uuid
import pyarrow as pa

from app import create_app, storage_backend
from utils import json_to_arrow, arrow_to_json

## create a test flask app and a test client to send requests

@pytest.fixture(scope='module')
def test_client():
    flask_app = create_app("datastore_test")
    testing_client = flask_app.test_client()

    ## Establish application context.
    ctx = flask_app.app_context()
    ctx.push()

    yield testing_client
    ctx.pop()


def test_put_json_string(test_client):
    """
    Test that we can put a JSON string onto the datastore
    """
    cell_hash = "test1"
    frame_name = str(uuid.uuid4())
    json_data = '[{"a":1}]'
    response = test_client.put('/{}/{}'.format(cell_hash, frame_name),data=json_data)
    assert response.status_code == 200
    res = storage_backend.read(cell_hash, frame_name)
    assert(res==json_data)


def test_get_simple_text(test_client):
    """
    Write a text string by hand onto the storage backend,
    then retrieve it with a GET request
    """
    cell_hash = "test2"
    frame_name = str(uuid.uuid4())
    test_str = "this is a test"
    storage_backend.write(test_str, cell_hash, frame_name)
    response = test_client.get('/{}/{}'.format(cell_hash,frame_name))
    assert(response.status_code == 200)
    assert(response.data.decode('utf-8') == "this is a test")


def test_put_arrow(test_client):
    """
    Convert a simple json object to arrow, and write it to the datastore.
    """
    jdf = [{"a":1,"b":10},{"a":2,"b":20}]
    buf = json_to_arrow(jdf)
    assert(isinstance(buf, bytes))
    cell_hash = "test3"
    frame_name = str(uuid.uuid4())
    response = test_client.put('/{}/{}'.format(cell_hash, frame_name),data=buf,
                               content_type='application/octet-stream')
    assert(response.status_code == 200)
    assert(os.path.exists('{}/{}/{}'.format(storage_backend.store.dirname,
                                            cell_hash,
                                            frame_name)))
    f = pa.OSFile('{}/{}/{}'.format(storage_backend.store.dirname,
                                    cell_hash,
                                    frame_name))
    buf = f.read_buffer(10000)
    new_jdf = json.loads(arrow_to_json(buf))
    assert(new_jdf == jdf)



def test_write_arrow_read_json(test_client):
    """
    test that we can write an arrow file and read it back as
    JSON by specifying content-type=application/json
    """
    jdf = [{"a":1,"b":10},{"a":2,"b":20}]
    buf = json_to_arrow(jdf)
    assert(isinstance(buf, bytes))
    cell_hash = "test3"
    frame_name = str(uuid.uuid4())
    response = test_client.put('/{}/{}'.format(cell_hash, frame_name),data=buf,
                               content_type='application/octet-stream')
    assert(response.status_code == 200)
    response = test_client.get('/{}/{}'.format(cell_hash, frame_name),
                               headers={'Accept':'application/json'})
    assert(response.status_code == 200)
    assert(response.headers['Content-Type'] == "application/json")
    new_jdf = json.loads(response.data.decode("utf-8"))
    assert(new_jdf == jdf)


def test_throws_exception_requesting_json(test_client):
    """
    If data is a random string, and content-type application/json
    is requested, should get a DataStoreException
    """
    cell_hash = "test4"
    frame_name = str(uuid.uuid4())
    test_str = "this is a not-very-random string"
    storage_backend.write(test_str, cell_hash, frame_name)
    response = test_client.get('{}/{}'.format(cell_hash, frame_name),
                               headers={'Accept':'application/json'})
    assert(response.status_code==500)
    content = json.loads(response.data.decode("utf-8"))
    assert(content["status"]=="error")
    assert(content["error"]=="Received string, but not json format")


def test_return_filtered_json(test_client):
    """
    Check that we can use the nrow option to get just the first few rows
    of a json dataframe
    """
    orig_df = [{"a":i,"b":i*10} for i in range(10)]
    assert(len(orig_df)==10)
    cell_hash = "test5"
    frame_name = str(uuid.uuid4())
    storage_backend.write(orig_df, cell_hash, frame_name)
    response = test_client.get('/{}/{}?nrow=5'.format(cell_hash, frame_name),
                               headers={'Accept':'application/json'})
    assert(response.status_code==200)
    new_df = json.loads(response.data.decode("utf-8"))
    assert(isinstance(new_df, list))
    assert(len(new_df)==5)


def test_return_filtered_arrow(test_client):
    """
    check that we can use the nrow option to get the first few
    rows while also converting to arrow
    """
    orig_df = [{"a":i,"b":i*10} for i in range(10)]
    assert(len(orig_df)==10)
    cell_hash = "test6"
    frame_name = str(uuid.uuid4())
    storage_backend.write(json.dumps(orig_df), cell_hash, frame_name)
    response = test_client.get('/{}/{}?nrow=5'.format(cell_hash, frame_name),
                               headers={'Accept':'application/octet-stream'})
    assert(response.status_code==200)
    new_df = response.data
    assert(isinstance(new_df, bytes))
    json_new_df = json.loads(arrow_to_json(new_df))
    assert(len(json_new_df)==5)

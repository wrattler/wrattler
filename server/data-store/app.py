"""
PUT requests store data.
GET requests retrieve it.

Use a flask Blueprint to setup the routes so we can create apps with
a function (and therefore make one for testing).
"""

import os

from flask import Blueprint, Flask, Response, request, jsonify
from flask_cors import CORS
import requests
import json

from storage import Store
from utils import convert_to_json
from exceptions import DataStoreException


if "WRATTLER_LOCAL_STORAGE" in os.environ.keys():
    BACKEND = "Local"
else:
    BACKEND = "Azure"
    from config import AzureConfig
    from azure.storage.blob import BlockBlobService, PublicAccess


storage_backend = Store(BACKEND)

datastore_blueprint = Blueprint("datastore",__name__)


@datastore_blueprint.errorhandler(DataStoreException)
def handle_exception(error):
    response = jsonify(error.to_dict())
    response.status_code = error.status_code
    return response


@datastore_blueprint.route("/<cell_hash>/<frame_name>", methods=['PUT','GET'])
def store_or_retrieve(cell_hash, frame_name):
    """
    deal with PUT or GET requests, using the storage backend to
    write or read data.
    """
    if request.method == "PUT":
        if 'Content-Type' in request.headers.keys() \
           and 'application/json' in request.headers['Content-Type']:
            data = json.loads(request.data.decode("utf-8"))
        elif 'Content-Type' in request.headers.keys() \
             and 'text/html' in request.headers['Content-Type']:
            data = request.data.decode("utf-8")
        else: ## try and decode as text, otherwise assume it's binary data
            try:
                data = request.data.decode("utf-8")
            except(UnicodeDecodeError):
                data = request.data
        wrote_ok = storage_backend.write(data, cell_hash, frame_name)
        if wrote_ok:
            return jsonify({"status_code": 200})
        else:
            return jsonify({"status_code": 500})

    elif request.method == "GET":
        ## if GET request specifies a number of rows, pass that on to the store
        if "nrow" in request.args.keys():
            nrow = int(request.args.get('nrow'))
        else:
            nrow = None
        data = storage_backend.read(cell_hash, frame_name, nrow=nrow)
        ## if the GET request has Content-Type=application/json in its header, return json
        if 'Content-Type' in request.headers.keys() \
           and 'application/json' in request.headers['Content-Type']:
            data = convert_to_json(data)
            return Response(data, mimetype='application/json')
        else: ## return the data as is
            return Response(data, mimetype='application/octet-stream')


def create_app(name = __name__):
    app = Flask(name)
    CORS(app)
    app.register_blueprint(datastore_blueprint)
    return app

if __name__ == "__main__":
    ## create and run the flask app

    app = create_app()
    app.run(host='0.0.0.0',port=7102, debug=True)

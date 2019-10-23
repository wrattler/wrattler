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

from .storage import Store
from .exceptions import DataStoreException


if "WRATTLER_AZURE_STORAGE" in os.environ.keys():
    BACKEND = "Azure"
    from .config import AzureConfig
    from azure.storage.blob import BlockBlobService, PublicAccess
else:
    BACKEND = "Local"


storage_backend = Store(BACKEND)

datastore_blueprint = Blueprint("datastore",__name__)


@datastore_blueprint.errorhandler(DataStoreException)
def handle_exception(error):
    response = jsonify(error.to_dict())
    response.status_code = error.status_code
    return response


def handle_get(request, cell_hash, frame_name):
    """
    GET requests should retrieve frame from the storage backend,
    filter the first nrow rows if requested, and return in
    either json or Arrow format, depending on the 'Accept' header
    in the request.
    """
    ## if GET request specifies a number of rows, pass that on to the store
    if "nrow" in request.args.keys():
        nrow = int(request.args.get('nrow'))
    else:
        nrow = None

    ## Return json or arrow based on content types in 'Accept' header
    content_type = "text/html" ## default if we don't know what it is
    if 'Accept' in request.headers.keys():
        if 'application/json' in request.headers['Accept'] \
           and not 'application/octet-stream' in request.headers["Accept"]:
            content_type = "application/json" ## return a json string
        elif 'application/octet-stream' in request.headers["Accept"] \
             and not 'application/json' in request.headers["Accept"]:
            content_type = "application/octet-stream"  ## return an Apache Arrow buffer

    data = storage_backend.read(cell_hash, frame_name, data_format=content_type, nrow=nrow)

    return Response(data, mimetype=content_type)


def handle_put(request, cell_hash, frame_name):
    """
    PUT requests store data on the storage backend.  If the body of the request can be
    decoded as utf-8, it is stored as a string, otherwise just as bytes.
    """
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


@datastore_blueprint.route("/<cell_hash>/<frame_name>", methods=['PUT','GET'])
def store_or_retrieve(cell_hash, frame_name):
    """
    deal with PUT or GET requests, using the storage backend to
    write or read data.
    """
    if request.method == "PUT":
        return handle_put(request, cell_hash, frame_name)

    elif request.method == "GET":
        return handle_get(request, cell_hash, frame_name)


def create_app(name = __name__):
    app = Flask(name)
    CORS(app)
    app.register_blueprint(datastore_blueprint)
    return app


def run_app(host='0.0.0.0', port=7102, debug=True):
    ## create and run the flask app
    app = create_app()
    app.run(host, port, debug)

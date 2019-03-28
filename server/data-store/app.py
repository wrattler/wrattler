"""
PUT requests store data.
GET requests retrieve it.
"""

import os

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json

from storage import Store

app = Flask(__name__)
CORS(app)

storage_backend = Store()

@app.route("/<frame_hash>/<frame_name>", methods=['PUT','GET'])
def store_or_retrieve(frame_hash, frame_name):

    if request.method == "PUT":
        print("HEADERS {}".format(request.headers))

        if 'Content-Type' in request.headers.keys() \
           and 'application/json' in request.headers['Content-Type']:
            data = json.loads(request.data.decode("utf-8"))
        elif 'Content-Type' in request.headers.keys() \
             and 'text/html' in request.headers['Content-Type']:
            data = request.data.decode("utf-8")
        else: ## assume it's binary data
            data = request.data
        wrote_ok = storage_backend.write(data, frame_hash, frame_name)
        if wrote_ok:
            return jsonify({"status_code": 200})
        else:
            return jsonify({"status_code": 500})

    elif request.method == "GET":
        print("ARGS {}".format(request.args))
        ## if GET request specifies a number of rows, pass that on to the store
        if "nrow" in request.args.keys():
            nrow = int(request.args.get('nrow'))
        else:
            nrow = None
        print("NROW = {}".format(nrow))
        print("HEADERS {}".format(request.headers))
        data = storage_backend.read(frame_hash, frame_name, nrow=nrow)
        ## if the GET request has Content-Type=application/json in its header, return json
        if 'Content-Type' in request.headers.keys() \
           and 'application/json' in request.headers['Content-Type']:
            return convert_to_json(data)
        else: ## return the data as is
            return data



if __name__ == "__main__":
    app.run(host='0.0.0.0',port=7102, debug=True)

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
        if 'Content-Type' in request.headers.keys():
            if 'application/json' in request.headers['Content-Type']:
                data = json.loads(request.data.decode("utf-8"))
            elif 'test/html' in request.headers['Content-Type']:
                data = request.data.decode("utf-8")
        else: ## assume it's binary data
            data = request.data
        wrote_ok = storage_backend.write(data, frame_hash, frame_name)
        if wrote_ok:
            return jsonify({"status_code": 200})
        else:
            return jsonify({"status_code": 500})

    elif request.method == "GET":
        data = storage_backend.read(frame_hash, frame_name)
        return data



if __name__ == "__main__":
    app.run(host='0.0.0.0',port=7102, debug=True)

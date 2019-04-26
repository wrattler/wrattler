"""
PUT requests store data.
GET requests retrieve it.
"""

import os

from flask import Flask, request, jsonify
from flask_cors import CORS
import json


app = Flask(__name__)
CORS(app)


@app.route("/<frame_hash>/<frame_name>", methods=['PUT','GET'])
def store_or_retrieve(frame_name, frame_hash):
    filename = "/tmp/{}/{}".format(frame_hash, frame_name)
    dirname = os.path.dirname(filename)
    if request.method == "PUT":
        data = json.loads(request.data.decode("utf-8"))
        os.makedirs("/tmp/{}".format(frame_hash), exist_ok=True)
        outfile = open(filename, "w")
        outfile.write(json.dumps(data))
        outfile.close()
        return jsonify({"status_code": 200})
    elif request.method == "GET":
        if not os.path.exists(filename):
            print("Error - no such dataframe")
            return None
        data = json.load(open(filename))
        return jsonify(data)



if __name__ == "__main__":
    app.run(host='0.0.0.0',port=7102, debug=True)

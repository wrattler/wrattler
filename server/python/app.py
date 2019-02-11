"""
Two API endpoints 'eval' and 'exports' representing the wrattler python service.

A POST request to 'exports' will analyze a code fragment and return lists of 'imports' and 'exports',
i.e. frames that the code will read in from the datastore and write back to the datastore.

A POST request to 'eval' will evaluate the code fragment and write the output frames to the datastore,
then return the names and URLs of these frames.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import requests

from python_service import analyze_code, evaluate_code
from exceptions import ApiException


app = Flask(__name__)
CORS(app)


@app.errorhandler(ApiException)
def handle_api_exception(error):
    response = jsonify(error.to_dict())
    response.status_code = error.status_code
    return response


@app.route("/exports", methods=['POST'])
def exports():
    data = json.loads(request.data.decode("utf-8"))
    imports_exports = analyze_code(data)
    return jsonify(imports_exports)


@app.route("/eval", methods=['POST'])
def eval():
    data = json.loads(request.data.decode("utf-8"))
    eval_result = evaluate_code(data)
    return jsonify(eval_result)


@app.route("/test", methods=["GET"])
def test():
    return "Python service is alive!"



if __name__ == "__main__":
    app.run(host='0.0.0.0',port=7101, debug=True)

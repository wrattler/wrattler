"""
Two API endpoints mocking a python kernel.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import requests

from python_service import analyze_code, evaluate_code


app = Flask(__name__)
CORS(app)


@app.route("/exports", methods=['POST'])
def exports():
    data = json.loads(request.data)
    imports_exports = analyze_code(data)

    print("code is {}".format(data["code"]))
    return jsonify(imports_exports)

@app.route("/eval", methods=['POST'])
def eval():
    data = json.loads(request.data)
    eval_result = evaluate_code(data)

    return jsonify(eval_result)



if __name__ == "__main__":
    app.run(hist='0.0.0.0',port=7101, debug=True)

#!/usr/bin/env python3
"""
Two API endpoints 'eval' and 'exports' representing the wrattler python service.

A POST request to 'exports' will analyze a code fragment and return lists of 'imports' and 'exports',
i.e. frames that the code will read in from the datastore and write back to the datastore.

A POST request to 'eval' will evaluate the code fragment and write the output frames to the datastore,
then return the names and URLs of these frames.
"""

from flask import Blueprint, Flask, request, jsonify
from flask_cors import CORS
import json
import requests

from python_service import handle_exports, handle_eval
from exceptions import ApiException


python_service_blueprint = Blueprint("python_service", __name__)


@python_service_blueprint.errorhandler(ApiException)
def handle_api_exception(error):
    response = jsonify(error.to_dict())
    response.status_code = error.status_code
    return response


@python_service_blueprint.route("/exports", methods=['POST'])
def exports():
    data = json.loads(request.data.decode("utf-8"))
    imports_exports = handle_exports(data)
    return jsonify(imports_exports)


@python_service_blueprint.route("/eval", methods=['POST'])
def eval():
    data = json.loads(request.data.decode("utf-8"))
    eval_result = handle_eval(data)
    return jsonify(eval_result)


@python_service_blueprint.route("/test", methods=["GET"])
def test():
    return "Python service is alive!"


def create_app(name = __name__):
    app = Flask(name)
    CORS(app)
    app.register_blueprint(python_service_blueprint)
    return app


def main():
    app = create_app()
    app.run(host='0.0.0.0',port=7101, debug=True)


if __name__ == "__main__":
    main()

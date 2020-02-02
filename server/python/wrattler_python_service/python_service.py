"""
Collection of functions called by the flask app that provide the
functionality of the wrattler python service.
"""
import os
import sys
import json
import re
from flask import Blueprint, Flask, request, jsonify
from flask_cors import CORS
import parser

from .python_service_utils import handle_exports, handle_eval
from .exceptions import ApiException

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


def run_app(host='0.0.0.0',port=7101, debug=True):
    app = create_app()
    app.run(host=host, port=port, debug=debug)

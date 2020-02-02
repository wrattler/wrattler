#!/usr/bin/env python3
"""
Two API endpoints 'eval' and 'exports' representing the wrattler python service.

A POST request to 'exports' will analyze a code fragment and return lists of 'imports' and 'exports',
i.e. frames that the code will read in from the datastore and write back to the datastore.

A POST request to 'eval' will evaluate the code fragment and write the output frames to the datastore,
then return the names and URLs of these frames.
"""

from wrattler_python_service.python_service import create_app

def main():
    app = create_app()
    app.run(host='0.0.0.0',port=7101, debug=True)


if __name__ == "__main__":
    main()

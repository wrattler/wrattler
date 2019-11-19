#!/usr/bin/env python3
"""
Run the flask application as a development server
"""


from wrattler_data_store.data_store import create_app


def main():
    ## create and run the flask app
    app = create_app()
    app.run(host='0.0.0.0',port=7102, debug=True)


if __name__ == "__main__":
    main()

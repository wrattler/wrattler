#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
CleverCSV AI Assistant

Author: G.J.J. van den Burg

  { "name": "CleverCSV",
    "id": "clevercsv",
    "process": "python",
    "arguments": "ccsv.py",
    "inputs": ["input"],
    "description": "CleverCSV helps import data from messy CSV files"
  }

Notes:
    if the query is empty, the output dataframe should be CleverCSV's best 
    guess.

"""

import io
import os
import sys
import tempfile
import unicodedata

import clevercsv
import pandas as pd
import numpy as np
import requests

# dialect components that we're considering
COMPONENTS = ["delimiter", "quotechar", "escapechar"]


def query2constraints(query):
    """ Parse a query to a dictionary of constraints

    Constraints are either "block" with a list of characters or "fix" with a 
    single character.
    """
    constraints = {}
    for component in COMPONENTS:
        constraints[component] = dict(block=[], fix=None)

    if query.strip() == "":
        return constraints

    elements = query.split("/")
    for el in elements:
        try:
            component, name = el.split("=", maxsplit=1)
        except ValueError:
            error("Internal error: unpacking query failed for element: " + el)

        if name == "EMPTY":
            char = ""
        else:
            char = unicodedata.lookup(name)

        action = None
        if component.startswith("not_"):
            action = "block"
            component = component[len("not_") :]
        elif component.startswith("is_"):
            action = "set"
            component = component[len("is_") :]
        else:
            error("Internal error: schema error for component: " + component)

        if not component in COMPONENTS:
            error("Internal error: unknown component: " + component)

        if action == "block":
            constraints[component]["block"].append(char)
        else:
            constraints[component]["fix"] = char

    return constraints


def dialects_satisfying_constraints(data, constraints):
    options = clevercsv.potential_dialects.get_dialects(data)
    satisfying = []
    for dialect in options:
        cont = False
        for comp in COMPONENTS:
            comp_const = constraints[comp]
            v = getattr(dialect, comp)
            if v in comp_const["block"]:
                cont = True
                break
            if comp_const["fix"] is not None and not v == comp_const["fix"]:
                cont = True
                break
        if cont:
            continue

        satisfying.append(dialect)
    return satisfying


def load_data(csvfile):
    # load the data from a Wrattler CSV file (i.e. a DataFrame with a single
    # cell in the "data"/"url"/"filename" column)

    # we can use pandas here because this is the csv file written by wrattler
    df = pd.read_csv(csvfile)
    if "data" in df.columns:
        return df["data"][0]
    elif "url" in df.columns:
        req = requests.get(df["url"][0])
        return req.content
    elif "filename" in df.columns:
        filename = df["filename"][0]
        enc = clevercsv.utils.get_encoding(filename)
        with open(filename, "r", newline="", encoding=enc) as fp:
            data = fp.read()
        return data
    else:
        error(
            "Please provide a DataFrame with a 'data', 'url', or 'filename' column."
        )


def get_options(satisfying_dialects, constraints):
    # must be a mapping of is_component/not_component to a list of unicode
    # names for characters
    options = {}
    for component in COMPONENTS:
        available = set()

        # if the component is already fixed, there are no valid options
        if constraints[component]["fix"] is not None:
            continue

        for dialect in satisfying_dialects:
            val = getattr(dialect, component)
            available.add(val)

        # there has to be more than one option for choice to make sense
        if len(available) > 1:
            options["not_" + component] = sorted(available)
            options["is_" + component] = sorted(available)
    return options


def nice_name(opt, char, chrname):
    # assuming opt in [is_component, not_component] and val is uppercase
    # unicode name of character
    pre, comp = opt.split("_")
    out = comp
    if pre == "is":
        out += " is " + chrname.lower() + " (" + char + ")"
    else:
        out += " is not " + chrname.lower() + " (" + char + ")"
    return out


def charname(char):
    if char:
        return unicodedata.name(char)
    return "EMPTY"


def error(msg):
    hdl, tmpfname = tempfile.mkstemp(prefix="clevercsv_", suffix=".csv")
    with os.fdopen(hdl, "w") as fp:
        fp.write("Error\n")
        fp.write(msg)
    print(tmpfname)
    sys.stdout.flush()


def main():
    while True:
        inputs = sys.stdin.readline()
        cmd = sys.stdin.readline()
        query = sys.stdin.readline()  # e.g. delimiter=comma
        query = query.strip("\n")

        # get the input filename
        filename = inputs.strip().split(",")[0].split("=")[-1]

        constraints = query2constraints(query)
        data = load_data(filename)
        satisfying = dialects_satisfying_constraints(data, constraints)
        dialect = clevercsv.consistency.detect_consistency_dialects(
            data, satisfying
        )
        options = get_options(satisfying, constraints)
        if cmd == "completions\n":
            for opt in sorted(options.keys()):
                for char in sorted(options[opt]):
                    name = charname(char)
                    print(
                        nice_name(opt, char, name)
                        + "\n"
                        + query
                        + "/%s=%s" % (opt, name)
                    )
            print("")
            sys.stdout.flush()
        elif cmd == "data\n":
            buf = io.StringIO(data)
            reader = clevercsv.reader(buf, dialect)
            tmp_df = pd.DataFrame.from_records(list(reader))
            clean_df = tmp_df.replace(np.nan, "", regex=True)

            hdl, tmpfname = tempfile.mkstemp(
                prefix="clevercsv_", suffix=".csv"
            )
            with os.fdopen(hdl, "w") as fp:
                clean_df.to_csv(fp)
            print(tmpfname)
            sys.stdout.flush()
        else:
            error("Unknown command: " + cmd)


if __name__ == "__main__":
    main()

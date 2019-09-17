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

# TODO:
# - ensure no two "is_delimiter" queries can be passed
# - handle empty string delimiter in pandas
# - remove mutually exclusive options: i.e. "quotechar is empty" and "quotechar 
# is not empty" as only options is not meaningful.

import io
import os
import sys
import tempfile
import unicodedata

import pandas as pd
import clevercsv

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


def dialects_satisfying_constraints(filename, constraints):
    data = load_data(filename)
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
    return data, satisfying


def load_data(csvfile):
    # load the data from a Wrattler CSV file (i.e. a DataFrame with a single
    # cell in the "data" column)
    df = pd.read_csv(csvfile)
    if not "data" in df:
        error("Please provide a data frame with a single 'data' column.")
    return df["data"][0]


def get_options(satisfying):
    # must be a mapping of is_component/not_component to a list of unicode
    # names for characters
    options = {}
    for component in COMPONENTS:
        available = set()
        for dialect in satisfying:
            val = getattr(dialect, component)
            available.add(val)
        if len(available):
            options["not_" + component] = sorted(available)
            options["is_" + component] = sorted(available)
    return options


def nice_name(opt, char, chrname):
    # assuming opt in is_component, not_component and val is uppercase unicode
    # name of character
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
        data, satisfying = dialects_satisfying_constraints(
            filename, constraints
        )
        dialect = clevercsv.consistency.detect_consistency_dialects(
            data, satisfying
        )
        options = get_options(satisfying)
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
            raw_df = pd.read_csv(filename)
            csvdialect = None
            if not dialect is None:
                csvdialect = dialect.to_csv_dialect()
            if not "data" in raw_df:
                error(
                    "Please provide a data frame with a single 'data' column."
                )
                continue
            buf = io.StringIO(data)
            clean_df = pd.read_csv(buf, dialect=csvdialect)

            hdl, tmpfname = tempfile.mkstemp(
                prefix="clevercsv_", suffix=".csv"
            )
            with os.fdopen(hdl, "w") as fp:
                clean_df.to_csv(fp)
            print(tmpfname)
            sys.stdout.flush()
        else:
            print("Unknown command: " + cmd)


def oldmain():
    while True:
        inputs = (
            sys.stdin.readline()
        )  # clean=/app/input.csv,messy=/app/input.csv
        cmd = sys.stdin.readline()  # completions | data
        query = sys.stdin.readline()  # e.g. geo=EU28

        if cmd == "completions\n":
            print("first completion\npath1")
            print("second completion\npath2")
            print("third completion\npath3")
            print("")
            sys.stdout.flush()
        else:
            hdl, tmpfname = tempfile.mkstemp(
                prefix="clevercsv_", suffix=".csv"
            )
            with os.fdopen(hdl, "w") as fp:
                fp.write("one,two\n")
                fp.write("1,2\n")
                fp.write("3,4")
            print(tmpfname)
            sys.stdout.flush()


if __name__ == "__main__":
    main()

#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
CleverCSV AI Assistant

Author: G.J.J. van den Burg

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


class AIAssistantError(Exception):
    def __init__(self, message, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.message = message


class AIAssistantInfo(Exception):
    def __init__(self, message, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.message = message


class CleverCSVAssistant:
    def __init__(self, inputs, query):
        self.inputs = inputs
        self.query = query
        self.initialize(inputs, query)

    def initialize(self, inputs, query):
        filename = inputs.strip().split(",")[0].split("=")[-1]
        self.data = load_data(filename)

        constraints = query2constraints(query)
        satisfying = dialects_satisfying_constraints(self.data, constraints)
        self.dialect = clevercsv.consistency.detect_consistency_dialects(
            self.data, satisfying
        )
        self.options = get_options(satisfying, constraints)

    def get_completions(self):
        for opt in sorted(self.options.keys()):
            for char in sorted(self.options[opt]):
                name = charname(char)
                print(
                    nice_name(opt, char, name)
                    + "\n"
                    + self.query
                    + "/%s=%s" % (opt, name)
                )
        print("")
        sys.stdout.flush()

    def get_data(self):
        buf = io.StringIO(self.data)
        if self.dialect is None:
            message = tie_break_message(buf)
            raise AIAssistantInfo(message)
        reader = clevercsv.reader(buf, self.dialect)
        tmp_df = pd.DataFrame.from_records(list(reader))
        clean_df = tmp_df.replace(np.nan, "", regex=True)

        hdl, tmpfname = tempfile.mkstemp(prefix="clevercsv_", suffix=".csv")
        with os.fdopen(hdl, "w") as fp:
            clean_df.to_csv(fp, index=False, header=False)
        print(tmpfname)
        sys.stdout.flush()


def DEBUG(msg):
    print("[CCSV_DEBUG] " + msg, file=sys.stderr)
    sys.stderr.flush()


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
            raise AIAssistantError(
                "Internal error: unpacking query failed for element: %r" % el
            )
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
            raise AIAssistantError(
                "Internal error, unknown component: %r" % component
            )

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
        return req.content.decode(req.encoding)
    elif "filename" in df.columns:
        filename = df["filename"][0]
        enc = clevercsv.utils.get_encoding(filename)
        with open(filename, "r", newline="", encoding=enc) as fp:
            data = fp.read()
        return data
    else:
        raise AIAssistantError(
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
    if char == "":
        post = ""
    # TODO: this is a "failure" of the language used to talk to Wrattler: we
    # can't have a literal ':' in the completion because that's what the query
    # name/url are separated on.
    elif char == ":":
        post = ""
    else:
        post = " (" + char + ")"
    if pre == "is":
        out += " is " + chrname.lower() + post
    else:
        out += " is not " + chrname.lower() + post
    return out


def charname(char):
    if char:
        return unicodedata.name(char)
    return "EMPTY"


def send_message(messages, header="Info"):
    hdl, tmpfname = tempfile.mkstemp(prefix="clevercsv_", suffix=".csv")
    table = [[header]]
    if isinstance(messages, str):
        table.append([messages])
    else:
        for line in messages:
            table.append([line])
    with os.fdopen(hdl, "w") as fp:
        writer = clevercsv.writer(fp)
        writer.writerows(table)
    print(tmpfname)
    sys.stdout.flush()


def info(msg):
    send_message(msg, header="Info")


def error(msg):
    send_message(msg, header="Error")


def tie_break_message(buf):
    message = [
        "CleverCSV couldn't determine a unique dialect, please provide constraints to help.",
        "Here is a preview of the first few rows:",
    ]
    for _ in range(5):
        line = next(buf, None)
        if line is None:
            break
        message.append(line.strip("\r\n"))
    return message


def main():
    while True:
        # Read stdin
        inputs = sys.stdin.readline()
        command = sys.stdin.readline()
        query = sys.stdin.readline()  # e.g. delimiter=comma

        # strip newlines
        inputs = inputs.strip("\n")
        command = command.strip("\n")
        query = query.strip("\n")

        try:
            assistant = CleverCSVAssistant(inputs, query)
            if command == "completions":
                assistant.get_completions()
            elif command == "data":
                assistant.get_data()
        except AIAssistantError as err:
            error(err.message)
        except AIAssistantInfo as err:
            info(err.message)


if __name__ == "__main__":
    main()

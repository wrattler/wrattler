"""
test functions related to manipulating dataframes
"""

import json
import numpy as np
import pandas as pd

from python_service import convert_to_pandas_df, \
    convert_from_pandas_df



def test_convert_pandas():
    """
    convert a wrattler dataframe into a pandas one,
    and back again, and check we get the same one
    back.
    """
    d_orig = [{"Col1":123, "Col2":"Abc"},
              {"Col1":456, "Col2":"Def"}]
    pd_df = convert_to_pandas_df(d_orig)
    assert(isinstance(pd_df, pd.DataFrame))
    d_new = json.loads(convert_from_pandas_df(pd_df))
    assert(d_orig == d_new)


def test_convert_list():
    """
    start with a list, should get converted into a dataframe and then into
    json, then should get the same df back again
    """
    start_list = ["a","b","c","d"]
    j1 = json.loads(convert_from_pandas_df(start_list))
    df = convert_to_pandas_df(j1)
    j2 = json.loads(convert_from_pandas_df(df))
    assert(j1==j2)


def test_dont_convert_non_df():
    """
    Check that if we just give a number or a string or something else,
    we get None back
    """
    x_orig = 345
    x_conv = convert_to_pandas_df(x_orig)
    x_new = convert_from_pandas_df(x_conv)
    assert(x_new == None)

    y_orig = "testing"
    y_conv = convert_to_pandas_df(y_orig)
    y_new = convert_from_pandas_df(y_conv)
    assert(y_new == None)


def test_convert_null_to_nan():
    """
    check we get NaN in the Pandas DF when we have null in the JSON, in a column that has other numbers
    """
    json_string = '[{"a": 1, "b": 33},{"a": 2, "b": null}]'
    json_obj = json.loads(json_string)
    ## should be converted to None
    assert(json_obj[1]["b"] == None)
    df = convert_to_pandas_df(json_obj)
    ## will now be NaN
    assert(np.isnan(df["b"][1]))
    ## but when we convert it back into json, we want it to be None
    new_json = json.loads(convert_from_pandas_df(df))
    assert(new_json[1]["b"] == None)

"""
test functions related to manipulating dataframes
"""

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
    d_new = convert_from_pandas_df(pd_df)
    assert(d_orig == d_new)


def test_convert_list():
    """
    start with a list, should get converted into a dataframe and then into
    json, then should get the same df back again
    """
    start_list = ["a","b","c","d"]
    j1 = convert_from_pandas_df(start_list)
    df = convert_to_pandas_df(j1)
    j2 = convert_from_pandas_df(df)
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

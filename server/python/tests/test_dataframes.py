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

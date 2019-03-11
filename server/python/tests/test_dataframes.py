"""
test functions related to manipulating dataframes
"""

import json
import numpy as np
import pandas as pd
import pyarrow as pa
import pytest

from exceptions import ApiException
from python_service import pandas_to_arrow, arrow_to_pandas, \
    pandas_to_json, json_to_pandas, \
    convert_to_pandas, convert_from_pandas


def test_pandas_to_arrow():
    """
    Create a pandas dataframe and convert to Apache Arrow format
    """
    df = pd.DataFrame({"a":[1,2,3],"b":[4,5,6]})
    arr = pandas_to_arrow(df)
    assert(isinstance(arr,pa.lib.Buffer))


def test_pandas_to_arrow_to_pandas():
    """
    Create a pandas dataframe, convert to Arrow, then back.
    """
    df1 = pd.DataFrame({"a":[1,2,3],"b":[4,5,6]})
    df2 = arrow_to_pandas(pandas_to_arrow(df1))
    assert(pd.DataFrame.equals(df1,df2))


def test_pandas_to_json():
    """
    Create a pandas dataframe and convert to row-wise JSON
    """
    df = pd.DataFrame({"a":[1,2,3],"b":[4,5,6]})
    jdf = json.loads(pandas_to_json(df))
    assert(jdf[0]["a"]==1)


def test_json_to_pandas():
    """
    Convert a JSON object to a pandas df
    """
    jdata = [{"name":"Bob","age": 44},{"name": "Charlie","age":43}]
    df = json_to_pandas(jdata)
    assert(isinstance(df,pd.DataFrame))


def test_pandas_to_json_to_pandas():
    """
    pandas to json to pandas
    """
    df = pd.DataFrame({"a":[1,2,3],"b":[4,5,6]})
    jdf = json.loads(pandas_to_json(df))
    newdf = json_to_pandas(jdf)
    assert(pd.DataFrame.equals(df, newdf))


def test_json_to_pandas_to_json():
    """
    convert a json dataframe into a pandas one,
    and back again, and check we get the same one
    back.
    """
    d_orig = [{"Col1":123, "Col2":"Abc"},
              {"Col1":456, "Col2":"Def"}]
    pd_df = convert_to_pandas(d_orig)
    assert(isinstance(pd_df, pd.DataFrame))
    d_new = json.loads(convert_from_pandas(pd_df, max_size_json=1024))
    assert(d_orig == d_new)


def test_json_size_limit():
    """
    When converting from pandas, we have an argument max_size_json which
    determines whether we convert to json or to arrows.  Try a couple of
    values of this and check we get expected output.
    """
    df = pd.DataFrame({"col1": ["blah", "blah"], "col2": ["BLAH","BLAH"]})
    output_1 = convert_from_pandas(df, max_size_json=0)
    assert(isinstance(output_1, pa.lib.Buffer))
    output_2 = convert_from_pandas(df, max_size_json=1024)
    assert(isinstance(output_2, str))


def test_convert_list():
    """
    start with a list, should get converted into a dataframe and then into
    json, then should get the same df back again
    """
    start_list = ["a","b","c","d"]
    j1 = json.loads(pandas_to_json(start_list))
    df = json_to_pandas(j1)
    j2 = json.loads(pandas_to_json(df))
    assert(j1==j2)


def test_dont_convert_non_df_to_pandas():
    """
    Check that if we just give a number or a string or something else,
    we get an ApiException
    """

    with pytest.raises(ApiException) as exception_int:
        x_conv = convert_to_pandas(345)
    with pytest.raises(ApiException) as exception_str:
        x_conv = convert_to_pandas("abc")


def test_convert_null_to_nan():
    """
    check we get NaN in the Pandas DF when we have null in the JSON, in a column that has other numbers
    """
    json_string = '[{"a": 1, "b": 33},{"a": 2, "b": null}]'
    json_obj = json.loads(json_string)
    ## should be converted to None
    assert(json_obj[1]["b"] == None)
    df = convert_to_pandas(json_obj)
    ## will now be NaN
    assert(np.isnan(df["b"][1]))
    ## but when we convert it back into json, we want it to be None
    new_json = json.loads(convert_from_pandas(df, max_size_json=1024))
    assert(new_json[1]["b"] == None)

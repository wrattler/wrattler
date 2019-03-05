# Welcome to Wrattler

## HES wrangling + analysis challenge
### 1. Load data
We read a subset of the data from agd-1a. This corresponds to "houses that were monitored for approximately one month at 2 minute intervals (most households)". There are two further chunks of this category of data (agd-1b and agd-1b)
```python

# Imports
import itertools
import os
import re

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, mean_absolute_error
from sklearn.linear_model import ElasticNetCV


# load the data
df_appliance_type_codes = pd.read_csv("csv/small/appliance_type_codes.csv")
df_appliance_types = pd.read_csv("csv/small/appliance_types.csv")
df_appliance_codes = pd.read_csv("csv/small/appliance_codes.csv")
```
```python

# clean column headers and remove "other" and "unknown" categories
df_appliance_types.columns = df_appliance_types.columns.str.strip()
df_appliance_type_codes.columns = df_appliance_type_codes.columns.str.strip()
df_appliance_types = df_appliance_types.merge(
    df_appliance_type_codes,
    left_on="GroupCode",
    right_on="Code"
)
df_appliance_types = df_appliance_types.loc[
    ~df_appliance_types["Name"].isin(["Other", "Unknown"]),
    ["ApplianceCode", "GroupCode"]
]
```

```python
df_profiles =  pd.read_csv("csv/agd-1a/appliance_group_data-1a_0.01.csv",header=None,names=['IntervalID','Household','ApplianceCode','DateRecorded','Data','TimeRecorded'])

#get the appliance group codes by joining the tables
df_profiles = df_profiles.merge(df_appliance_types, how='left', on='ApplianceCode')
df_profiles.columns = df_profiles.columns.str.strip()
```


### 2. Drop rows with temperature readings
Some of the rows correspond to temperature readings, which are not appliances, and therefore must be dropped.

```python
temp_rows = df_profiles[df_profiles['GroupCode'].isnull()].index
df_profiles.drop(temp_rows, inplace=True)

```


### 3. Demographic data
Try a simple model where we use some of the demographic information and the monitoring information to infer the fraction of energy usage that comes from different appliance groups.

```python

# ADD your data path here!
df_demo = pd.read_csv("csv/anonhes/ipsos-anonymised-corrected_310713.csv")
```

```python
df_feat = df_demo.copy()[
    ["Household",
    "HouseholdOccupancy",
    "SinglePensioner",
    "SingleNonPensioner",
    "MultiplePensioner",
    "HouseholdWithChildren",
    "MultiplePersonWithNoDependentChildren",
    "HouseholdType",
    "House.age",
    "Social.Grade"]
]
```


#### Wrangling
There's redundancy of information in the table, so we will engineer some new features.

1. In the HouseholdOccupancy column, the occupancy is recorded for up to 6 people, and for more than this it is recorded as "6+". As a simple fix for this, I'll replace "6+" with 6, and cast the column to int.
2. PensionerOnly feature: 0 if anyone who lives in the house is not a pensioner, 1 otherwise. If we create this feature, we can remove several others and reduce redundancy.
3. HouseholdType is a redundant feature, it is simply a combination of the other features. So is MultiplePersonWithNoDependentChildren, and the pensioner features (after creating the PensionerOnly feature).
4. Social grade is categorical but ordered, and has a single missing value. I'll fill this in with the most frequent value and then convert the social grade to a number.
5. The House.age column is a string, e.g. "1950-1966". I will convert this to a number by taking the midpoint of the range. There are some missing values set to -1, which I will replace with the most common value.

```python
# Fix household occupancy column
df_feat.loc[:, "HouseholdOccupancy"] = df_feat[
    "HouseholdOccupancy"
].str.replace("+", "").astype(int)

# Make pensioner only feature
df_feat.loc[:, "PensionerOnly"] = (
    df_feat["SinglePensioner"] | df_feat["MultiplePensioner"]
).astype(int)

# Drop redundant features
df_feat = df_feat.drop(labels=["HouseholdType",
                               "MultiplePersonWithNoDependentChildren",
                               "SinglePensioner",
                               "MultiplePensioner",
                               "SingleNonPensioner"]
                       , axis=1)

# Social grade feature
social_cats = np.sort(df_feat["Social.Grade"].dropna().unique())
df_feat = df_feat.replace(
    to_replace={
        "Social.Grade": {v: int(i) for i, v in enumerate(social_cats)}
    }
)
df_feat.loc[:, "Social.Grade"] = df_feat.loc[:, "Social.Grade"].fillna(
    df_feat["Social.Grade"].value_counts().index[0]
)

# Age of house
def get_age(yrs):
    if yrs == '-1':
        return get_age("1950-1966")
    else:
        try:
            start, end = [int(i) for i in yrs.split('-')]
            yr = start + (end - start) // 2
        except ValueError:
            yr = 2007
    return 2010 - yr

df_feat.loc[:, "House.age"] = df_feat["House.age"].apply(get_age)
```

Now join this table to the electricity monitoring data and do some further preprocessing:


```python

# make table of usage in each appliance group per house on each day
df_y = df_profiles.groupby(
    ['Household', 'DateRecorded', 'GroupCode']
)["Data"].sum().unstack("GroupCode").stack(dropna=False)

# make features table
df_X = df_y.groupby(
    ["Household", "DateRecorded"]
).sum(skipna=True).reset_index().merge(
    df_feat,
    how="inner",
    left_on="Household",
    right_on="Household"
).rename(columns={0: "TotalUsage"})
```
```python

df_X["dt"] = pd.to_datetime(df_X['DateRecorded'])
df_X["dow"] = df_X["dt"].dt.weekday_name
df_X["month"] = df_X["dt"].dt.month
df_X = df_X.drop(labels=["dt"], axis=1).set_index(
    ["Household", "DateRecorded"]
)
df_X = pd.concat(
    (df_X, pd.get_dummies(df_X["dow"])), axis=1
).drop(labels=["dow"],axis=1)
```
```python

# make table of usage per appliance group
df_y = df_y.reset_index().merge(
    df_X.reset_index(),
    how="inner",
    left_on=["Household", "DateRecorded"],
    right_on=["Household", "DateRecorded"]
)[["Household", "DateRecorded", "GroupCode", 0, "TotalUsage"]]
df_y.loc[:, 0] = np.log1p(df_y[0]) # log transform usage
df_y = df_y.drop(labels=["TotalUsage"], axis=1)
df_y = df_y.set_index(
    ["Household", "DateRecorded"]
).pivot(columns="GroupCode")[0]

# fourier features
def make_fourier_features(t, order=2):
    # ripped off from fbprophet
    return np.column_stack([
        trig((2.0 * (i + 1) * np.pi * t / 12))
        for i in range(order)
        for trig in (np.sin, np.sin)
    ])

fourier_feats = np.array(
    [make_fourier_features(t) for t in df_X["month"].values]
)[:, 0, :]
for i in range(fourier_feats.shape[1]):
    df_X["fourier"+str(i)] = fourier_feats[:, i]
df_X = df_X.drop(labels=["month"], axis=1)


```

```python
from sklearn.preprocessing import MinMaxScaler

# standardise columns where appropriate
for column in ["TotalUsage", "House.age", "HouseholdOccupancy", "Social.Grade"]:
    scaler = MinMaxScaler()
    val_scaled = scaler.fit_transform(df_X[column].values.reshape(-1, 1))
    df_X.loc[:, column] = val_scaled
    
for column in df_y.columns:
    scaler = MinMaxScaler()
    val_scaled = scaler.fit_transform(df_y[column].fillna(0.).values.reshape(-1, 1))
    df_y.loc[:, column] = val_scaled    
    
# prepare data for modelling
df_all = df_X.merge(df_y, left_index=True, right_index=True)
X = df_all[df_all.columns[:-13]].values
y = df_all[df_all.columns[-1:-13:-1]].values
```

### Model energy usage of houses
We attempt to predict the quantity of energy that a given household

```python
from sklearn.model_selection import train_test_split

# split the houses into train/test sets
houses = df_all.reset_index()["Household"].unique()
houses_train, houses_test = train_test_split(houses, random_state=2)

# use the above train/test houses to create train/test dataframes
df_train = df_all.reset_index()[
    df_all.reset_index()["Household"].isin(houses_train)
].set_index(["Household", "DateRecorded"])
df_test = df_all.reset_index()[
    df_all.reset_index()["Household"].isin(houses_test)
].set_index(["Household", "DateRecorded"])


def get_X_y(df):
    # create X and y arrays for scikit learn from dataframes
    X = df[df.columns[:-9]].values
    y = df[df.columns[-1:-10:-1]].values
    return X, y

X_train, y_train = get_X_y(df_train)
X_test, y_test = get_X_y(df_test)

# drop columns with all zeros
ind = np.copy(~np.all(y_test == 0, axis=0))
y_train = y_train[:, ind]
y_test = y_test[:, ind]
appliances = df_appliance_type_codes.set_index("Code").loc[
    df_all[df_all.columns[-1:-10:-1]].columns[ind],
    "Name"
].values

```
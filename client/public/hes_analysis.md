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
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler
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
df_profiles =  pd.read_csv("csv/agd-1a/appliance_group_data-1a.csv",header=None,names=['IntervalID','Household','ApplianceCode','DateRecorded','Data','TimeRecorded'])
```

```python
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

In the HouseholdOccupancy column, the occupancy is recorded for up to 6 people, and for more than this it is recorded as "6+". As a simple fix for this, I'll replace "6+" with 6, and cast the column to int.
PensionerOnly feature: 0 if anyone who lives in the house is not a pensioner, 1 otherwise. If we create this feature, we can remove several others and reduce redundancy.
HouseholdType is a redundant feature, it is simply a combination of the other features. So is MultiplePersonWithNoDependentChildren, and the pensioner features (after creating the PensionerOnly feature).
Social grade is categorical but ordered, and has a single missing value. I'll fill this in with the most frequent value and then convert the social grade to a number.
The House.age column is a string, e.g. "1950-1966". I will convert this to a number by taking the midpoint of the range. There are some missing values set to -1, which I will replace with the most common value.

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

#df_profiles = pd.read_csv("agd-1a/appliance_group_data-1a.csv",header=None,names=['IntervalID','Household','ApplianceCode','DateRecorded','Data','TimeRecorded'])
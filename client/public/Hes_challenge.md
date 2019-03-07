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
df_profiles["Household2"] = df_profiles["Household"]


### 2. Drop rows with temperature readings
# Some of the rows correspond to temperature readings, which are not appliances, and therefore must be dropped.


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
df_feat["Household2"] = df_feat["Household"]
test = pd.DataFrame(list(df_feat.dtypes))
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

df_X["dt"] = pd.to_datetime(df_X['DateRecorded'])
df_X["dow"] = df_X["dt"].dt.weekday_name
df_X["month"] = df_X["dt"].dt.month



df_X = df_X.drop(labels=["dt"], axis=1).set_index(
    ["Household", "DateRecorded"]
)
df_X = pd.concat(
    (df_X, pd.get_dummies(df_X["dow"])), axis=1
).drop(labels=["dow"],axis=1)

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
    

```

### Model energy usage of houses
We attempt to predict the quantity of energy that a given household


```python

from sklearn.model_selection import train_test_split
# prepare data for modelling
df_all = df_X.merge(df_y, left_index=True, right_index=True)

# split the houses into train/test sets
houses = df_all["Household2"].unique()
houses_train, houses_test = train_test_split(houses, random_state=2)

# use the above train/test houses to create train/test dataframes
df_train = df_all.loc[df_all['Household2'].isin(houses_train)]
df_test = df_all.loc[df_all['Household2'].isin(houses_test)]


def get_X_y(df):
    # create X and y arrays for scikit learn from dataframes
    
    columns_X = ['TotalUsage', 'HouseholdOccupancy', 'HouseholdWithChildren',
       'House.age', 'Social.Grade', 'PensionerOnly', 'Friday', 'Monday',
       'Saturday', 'Sunday', 'Thursday', 'Tuesday', 'Wednesday', 'fourier0',
       'fourier1', 'fourier2', 'fourier3']
    columns_y = ['1013.0', '1008.0', '1007.0', '1006.0', '1005.0', '1004.0', '1003.0', '1002.0', '1001.0']
    X = df[columns_X].values
    y = df[columns_y].values
    return X, y

X_train, y_train = get_X_y(df_train)
X_test, y_test = get_X_y(df_test)
```

```python
# drop columns with all zeros
ind = np.copy(~np.all(y_test == 0, axis=0))
y_train_final = y_train.loc[:, ind]
y_test_final = y_test.loc[:, ind]

apply_rows =[1013.0, 1008.0, 1007.0, 1006.0, 1004.0, 1002.0, 1001.0]

appliances = df_appliance_type_codes.set_index("Code").loc[apply_rows,"Name"].values


from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import ElasticNetCV


def train_predict_models(X_train, y_train,X_test):
    """A simple model that first classifies the measurement as being 0 or non zero, then 
    predicts the non-zero values."""
    
    X_train = X_train.values
    y_train = y_train.values
    # train classifier to detect zeros
    y_bin = np.copy(y_train)
    y_bin[y_bin != 0.0] = 1.0
    clf = RandomForestClassifier(
        class_weight="balanced_subsample",
        random_state=42
    )
    clf.fit(X_train, y_bin)
    
    # train regression to predict non-zero values
    # have to do this separately for each of the outputs
    y_reg = np.copy(y_train)
    X_reg = np.copy(X_train)
    regressors = dict()
    for i in range(y_reg.shape[1]):
        regressors[i] = ElasticNetCV(
            random_state=42
        )
        y_i = y_reg[:, i]
        ind = y_i != 0
        X_i = X_reg[ind, :]
        y_i = y_i[ind]
        regressors[i].fit(X_i, y_i)

    """Given a classifier and set of regressors, produce predictions."""
    X_test = X_test.values
    y_bin = clf.predict(X_test)
    
    y_pred = np.copy(y_bin)
    for i in range(y_bin.shape[1]):
        y_i = y_pred[:, i]
        ind = y_i != 0
        if ind.sum() != 0:
            y_pred[ind, i] = regressors[i].predict(X_test[ind, :])
    
    return y_bin, y_pred
    

    
# fit the models and predict on the test set
y_bin, y_pred = train_predict_models(X_train, y_train_final,X_test)

```

```python
from sklearn.metrics import classification_report, confusion_matrix, mean_absolute_error
y_baseline = np.repeat(y_train_final.mean(axis=0)[:, None], y_test_final.shape[0], axis=1).T


y_test_final = y_test_final.values
y_train_final = y_train_final.values


mean_absolute_error_model =  np.repeat(mean_absolute_error(y_test_final, y_pred),1)
mean_absolute_error_baseline = np.repeat(mean_absolute_error(y_test_final, y_baseline),1)


# produce a baseline that is closer to the model
np.random.seed(42)
y_baseline_better = np.zeros_like(y_test_final)

for i in range(y_test_final.shape[1]):
    y_baseline_better[:, i] = np.random.binomial(1,
        (y_train_final[:, i] != 0.0).sum() / len(y_train_final[:, i]),
        size=y_baseline_better.shape[0]
    )
    ind = y_baseline_better[:, i] != 0.0
    val = np.mean(y_train_final[:, i][y_train_final[:, i] != 0.0])
    y_baseline_better[ind, i] = val

mean_absolute_error_baseline_better = np.repeat(mean_absolute_error(y_test_final, y_baseline_better),1)

```

The model beats the very naive baseline of the mean of each column. Instead, we try a different baseline that mimics the more sophisticated model (y_baseline_better). It assings a nonzero value at random to each entry in `y` using a binomial distribution with rate set by the fraction of nonzero entries in that column of the training set. The nonzero values are then set to the mean of the nonzero values of that column in the training set.

##  Modeling results

In the next figures, the results for the modeling for each appliance is shown. The figures compare the data, the 
baseline and the full model.  
```python
import seaborn as sns
import matplotlib.pyplot as plt
from sklearn.metrics import mean_absolute_error


y_test_final = y_test_final.values
y_train_final = y_train_final.values
y_pred = y_pred.values
y_baseline_better = y_baseline_better.values
appliances = appliances.values

# plot the distribution of the test set, model and baseline
# the mean absolute error for each appliance group is in brackets in the legend
fig, ax = plt.subplots(7, 1, figsize=(10, 22.5))

model_label = "Model ({:.4f})".format( mean_absolute_error(y_test_final[:, 0], y_pred[:, 0]))
baseline_label = "Baseline ({:.4f})".format(mean_absolute_error(y_test_final[:, 0], y_baseline_better[:, 0]))
sns.distplot(y_test_final[:, 0], norm_hist=False, kde=False, label="Data", ax=ax[0])
sns.distplot(y_pred[:, 0], norm_hist=False, kde=False, label=model_label, ax=ax[0])
sns.distplot(y_baseline_better[:, 0], norm_hist=False, kde=False, label=baseline_label, ax=ax[0])
ax[0].set_title(appliances[0],fontsize=15)
ax[0].set_ylabel("Frequency",fontsize=14)
ax[0].legend(fontsize=14)


model_label1 = "Model ({:.4f})".format( mean_absolute_error(y_test_final[:, 1], y_pred[:, 1]))
baseline_label1 = "Baseline ({:.4f})".format(mean_absolute_error(y_test_final[:, 1], y_baseline_better[:, 1]))
sns.distplot(y_test_final[:, 1], norm_hist=False, kde=False, label="Data", ax=ax[1])
sns.distplot(y_pred[:, 1], norm_hist=False, kde=False, label=model_label1, ax=ax[1])
sns.distplot(y_baseline_better[:, 1], norm_hist=False, kde=False, label=baseline_label1, ax=ax[1])
ax[1].set_title(appliances[1],fontsize=15)
ax[1].set_ylabel("Frequency",fontsize=14)
ax[1].legend(fontsize=14)

model_label2 = "Model ({:.4f})".format( mean_absolute_error(y_test_final[:, 2], y_pred[:, 2]))
baseline_label2 = "Baseline ({:.4f})".format(mean_absolute_error(y_test_final[:, 2], y_baseline_better[:, 2]))
sns.distplot(y_test_final[:, 2], norm_hist=False, kde=False, label="Data", ax=ax[2])
sns.distplot(y_pred[:, 2], norm_hist=False, kde=False, label=model_label2, ax=ax[2])
sns.distplot(y_baseline_better[:, 2], norm_hist=False, kde=False, label=baseline_label2, ax=ax[2])
ax[2].set_title(appliances[2],fontsize=15)
ax[2].set_ylabel("Frequency",fontsize=14)
ax[2].legend(fontsize=14)

model_label3 = "Model ({:.4f})".format( mean_absolute_error(y_test_final[:, 3], y_pred[:, 3]))
baseline_label3 = "Baseline ({:.4f})".format(mean_absolute_error(y_test_final[:, 3], y_baseline_better[:, 3]))
sns.distplot(y_test_final[:, 3], norm_hist=False, kde=False, label="Data", ax=ax[3])
sns.distplot(y_pred[:, 3], norm_hist=False, kde=False, label=model_label3, ax=ax[3])
sns.distplot(y_baseline_better[:, 3], norm_hist=False, kde=False, label=baseline_label3, ax=ax[3])
ax[3].set_title(appliances[3],fontsize=15)
ax[3].set_ylabel("Frequency",fontsize=14)
ax[3].legend(fontsize=14)

model_label4 = "Model ({:.4f})".format( mean_absolute_error(y_test_final[:, 4], y_pred[:, 4]))
baseline_label4 = "Baseline ({:.4f})".format(mean_absolute_error(y_test_final[:, 4], y_baseline_better[:, 4]))
sns.distplot(y_test_final[:, 4], norm_hist=False, kde=False, label="Data", ax=ax[4])
sns.distplot(y_pred[:, 4], norm_hist=False, kde=False, label=model_label4, ax=ax[4])
sns.distplot(y_baseline_better[:, 4], norm_hist=False, kde=False, label=baseline_label4, ax=ax[4])
ax[4].set_title(appliances[4],fontsize=15)
ax[4].set_ylabel("Frequency",fontsize=14)
ax[4].legend(fontsize=14)

model_label5 = "Model ({:.4f})".format( mean_absolute_error(y_test_final[:, 5], y_pred[:, 5]))
baseline_label5 = "Baseline ({:.4f})".format(mean_absolute_error(y_test_final[:, 5], y_baseline_better[:, 5]))
sns.distplot(y_test_final[:, 5], norm_hist=False, kde=False, label="Data", ax=ax[5])
sns.distplot(y_pred[:, 5], norm_hist=False, kde=False, label=model_label5, ax=ax[5])
sns.distplot(y_baseline_better[:, 5], norm_hist=False, kde=False, label=baseline_label5, ax=ax[5])
ax[5].set_title(appliances[5],fontsize=15)
ax[5].set_ylabel("Frequency",fontsize=14)
ax[5].legend(fontsize=14)

model_label6 = "Model ({:.4f})".format( mean_absolute_error(y_test_final[:, 6], y_pred[:, 6]))
baseline_label6 = "Baseline ({:.4f})".format(mean_absolute_error(y_test_final[:, 6], y_baseline_better[:, 6]))
sns.distplot(y_test_final[:, 6], norm_hist=False, kde=False, label="Data", ax=ax[6])
sns.distplot(y_pred[:, 6], norm_hist=False, kde=False, label=model_label6, ax=ax[6])
sns.distplot(y_baseline_better[:, 6], norm_hist=False, kde=False, label=baseline_label6, ax=ax[6])
ax[6].set_title(appliances[6],fontsize=15)
ax[6].set_ylabel("Frequency",fontsize=14)
ax[6].legend(fontsize=14)
ax[6].set_xlabel("Normalised consumption",fontsize=14)

plt.tight_layout()
```

# Welcome to Wrattler
## Model "time to patient death" from the Clean EHR dataset

The analytical challenge we set ourselves is the somewhat artificial prediction of
the amount of time it takes for a patient to die (in minutes), once arrived at the hospital ICU.

The CleanEHR data contains a sample of anonymised medical record data from a
number of hospitals, including demographic data, drug dosage data, and
physiological time-series measurements. The sample used in this analysis is very small and the output of the
analysis is just for purpose of this demo. The full dataset can be requested online. 

### Data preparation on R

The dataset comes as a well-formed R object, and is processed using the cleanEHR toolkit which is an R package that covers
 the most common processing and cleaning operations for this type of data.
 
For the purposes of the analytical challenge we have to process and convert some variables. More specifically, 
time-varying and single-value fields need to be used in the same model, thus the former have been distilled into a few time-series descriptive variables 
such as mean, standard deviation or min and max values.

The pre-processing in R returns two dataframes, one containing only the demographic fields and another including the time-series descriptive fields. 

```r
library(purrr)
library(cleanEHR)

# download and read full dataset
load("anon_public_d.RData")
dt <- ccd_demographic_table(anon_ccd, dtype=TRUE)

mean_tail_diff <- function(vector) {
  
  diff <- mean(vector,na.rm=TRUE) - tail(vector,n=1)
  return (diff)
}

# get the codes of time series variables
names_ts_variables <- c()
counter <- 1
for (i in 1:length(anon_ccd@episodes)){
  for (n in names(anon_ccd@episodes[[i]]@data)){
    if (length(anon_ccd@episodes[[i]]@data[n][[1]]) == 2){ # guarantee time series
      names_ts_variables[[counter]] <- n
      counter <- counter+1
    }
  }
}
names_ts_variables <- sort(unique(names_ts_variables))
short_names_ts_variables <- lapply(names_ts_variables, FUN = code2stname)

# our index is NIHR_HIC_ICU_0005, corresponding to a unique (per episode/patient) admission number, or ADNO
index_variable <- "NIHR_HIC_ICU_0005"
# prepare lists of measurements from time series
ts_measures <- c("mean","std","last","mean_tail_diff")
ts_measures_funcs <- c(partial(mean,na.rm=TRUE),partial(sd),partial(tail,n=1),partial(mean_tail_diff))

names_for_dts <- c("ADNO")
for (sn in short_names_ts_variables){
  for (mes in ts_measures){
    names_for_dts <- append(names_for_dts,paste(sn,mes,sep = "_"))
  }
}
dts <- data.frame(matrix(NA, nrow=0, ncol=length(names_for_dts)))
names(dts) <- names_for_dts

## prepare TS dataset
## length(anon_ccd@episodes)
for (i in 1:length(anon_ccd@episodes)){
  adno <- as.numeric(anon_ccd@episodes[[i]]@data[index_variable][[1]])
  measurements <- c(adno)
  for (n in names_ts_variables){
      # Add time limit of 10 hours to measure TS data!
      dts_episode <- anon_ccd@episodes[[i]]@data[n][[1]]

      dts_episode_sub <- subset(dts_episode, dts_episode$time < 10)

      values <- dts_episode_sub["item2d"][[1]]
      
    if (!is_empty(values)){
      for (measure in ts_measures_funcs){
        
        measurements <- c(measurements,measure(as.numeric(values))[[1]])
      }
    } else {
      measurements <- c(measurements,rep(NA,length(ts_measures)))
    }
  }
  dts <- rbind(dts,measurements)
  names(dts) <- names_for_dts
}
```

### Data wrangling on Python

After pre-processing the data in R with the cleanEHR dedicated libraries, we move to python where we
start with merging the two data frames (for fixed-value and time-varying fields) into a single one using the ADNO (admission number) field. 

For this exercise the data wrangling and modelling is done in both the demographic only dataset as well as the demographic plus time-series sample.
The performance of the modeling in the two samples is meant to be compared.

```python
# merge the two dataframes
dtf = dt.merge(dts, left_on="ADNO", right_on="ADNO", how="inner")
```
we drop rows without entries, missing death timestamps or completely null columns.
```python
dtf = dtf.replace(['NULL'], np.nan)
dt = dt.replace(['NULL'], np.nan)

dtf = dtf[pd.notnull(dtf['DAICU'])&pd.notnull(dtf['DOD'])&pd.notnull(dtf['TOD'])] # columns needed for target (time to die)
dt = dt[pd.notnull(dt['DAICU'])&pd.notnull(dt['DOD'])&pd.notnull(dt['TOD'])] # columns needed for target (time to die)
dtf = dtf.dropna(axis=1, how='all')
dt = dt.dropna(axis=1, how='all')

dtf_1= list(dtf.shape)
dt_1= list(dt.shape)
```

Create functions to help with the wrangling challenges such as datetime format processing: 
```python
import numpy as np
def export_datetime_slash(input_):
    s = str(input_)
    if s == 'None' or s == np.datetime64('NaT') or s=='NULL' or s=='NaT' or s==None or ('NULL' in s):
        return np.nan
    else:    
        return str(pd.to_datetime(s,infer_datetime_format=True))

def export_datetime(input_):
    s = str(input_)
    if s == 'None' or s == np.datetime64('NaT') or s=='NULL' or s=='NaT' or ('NULL' in s):
        return np.nan
        
    elif "T" in s:
        if len(s.split("T")[1].split(":")) > 2:
            return str(s.split("T")[0]+" "+s.split("T")[1])
        else:
            return str(s.split("T")[0]+" "+s.split("T")[1]+":00")
    
    elif " " in s:
        if len(s.split(" ")[1].split(":")) > 2:
            return str(s.split(" ")[0]+" "+s.split(" ")[1])
        else:
            return str(s.split(" ")[0]+" "+s.split(" ")[1]+":00")

# process the dates of arrival and death            
dtf["time_arrive_hospital"] = dtf["DAH"].apply(export_datetime_slash)
dtf["time_arrive"] = dtf["DAICU"].apply(export_datetime)
dtf["time_death"] = dtf["DOD"] +"T"+ dtf["TOD"]
dtf["time_death"] = dtf["time_death"].apply(export_datetime)

# do the same for demographic only data frame
dt["time_arrive_hospital"] = dt["DAH"].apply(export_datetime_slash)
dt["time_arrive"] = dt["DAICU"].apply(export_datetime)
dt["time_death"] = dt["DOD"] +"T"+ dt["TOD"]
dt["time_death"] = dt["time_death"].apply(export_datetime)

# get AGE using DOB 
dtf["time_of_birth"] = dtf["DOB"].apply(export_datetime)
dt["time_of_birth"] = dt["DOB"].apply(export_datetime)
```

Create new variables such as the time the patient was on the hospital before getting to the ICU, the time to dieand the time from birth. Then build
a function to transform these datetime type variables (time_to_ICU, time_to_die) to minutes.


```python  
dtf = dtf.dropna(subset=['time_death'])

dtf["time_to_ICU"] = (pd.to_datetime(dtf["time_arrive"],infer_datetime_format=True) -pd.to_datetime(dtf["time_arrive_hospital"],infer_datetime_format=True))
dtf["time_to_die"] = (pd.to_datetime(dtf["time_death"],infer_datetime_format=True)-pd.to_datetime(dtf["time_arrive"],infer_datetime_format=True))

dt["time_to_ICU"] = (pd.to_datetime(dt["time_arrive"],infer_datetime_format=True) -pd.to_datetime(dt["time_arrive_hospital"],infer_datetime_format=True))
dt["time_to_die"] = (pd.to_datetime(dt["time_death"],infer_datetime_format=True)-pd.to_datetime(dt["time_arrive"],infer_datetime_format=True))

# Create funtion to transform datetime type variables (time_to_ICU, time_to_die) to minutes.
import numpy as np
def get_ttd(td):
    
    if td=='NULL' or td=='NaN' or td==np.nan or td == np.datetime64('NaT'):
        return 0
    else:
        return (td.days*24*60) + (td.seconds/60)
        
# convert time to ICU and time to die to minutes
dtf["time_to_ICU"] = dtf["time_to_ICU"].apply(get_ttd)
dtf["time_to_die"] = dtf["time_to_die"].apply(get_ttd)

dt["time_to_die"] = dt["time_to_die"].apply(get_ttd)
dt["time_to_ICU"] = dt["time_to_ICU"].apply(get_ttd)

# remove persons arrived dead
dtf = dtf[dtf["time_arrive"] <= dtf["time_death"]] 
dt = dt[dt["time_arrive"] <= dt["time_death"]] 

```
For the classification task, create target variable to classify patients that died within the first 100 hours and the ones that did not.

```python
def get_survival_class(time):
        # Classify people that died in the first 100 hours  after admission.
    if time<6000:
        return 1
    else:
        return 0
# add target survival class
dtf["survival_class"] = dtf["time_to_die"].apply(get_survival_class)

# add survival class
dt["survival_class"] = dt["time_to_die"].apply(get_survival_class)
```
Function to parse the time from birth into age in years.

```python
dtf["time_from_birth"] = (pd.to_datetime(dtf["time_arrive"],infer_datetime_format=True) -pd.to_datetime(dtf["time_of_birth"],infer_datetime_format=True))
dt["time_from_birth"] = (pd.to_datetime(dt["time_arrive"],infer_datetime_format=True) -pd.to_datetime(dt["time_of_birth"],infer_datetime_format=True))

def get_age(td):
    if td=='NULL' or td=='NaN' or td==np.nan or td == np.datetime64('NaT')     :
        return 0
    else:
        # returns years 
        return np.abs(td.days)/365
        
# apply conversion from date-time object to years.
dtf["time_from_birth"] = dtf["time_from_birth"].apply(get_age)
dt["time_from_birth"] = dt["time_from_birth"].apply(get_age)
dtf["age"] = dtf["time_from_birth"]
dt["age"] = dt["time_from_birth"]
```
Transform the taxonomies used for diagnoses into dummy variables by one-hot encoding (`RAICU1`, `RAICU2` and `OCPMH` above).

```python
def process_diagnosis(s,level=2):
    # takes a diagnosis code and returns only the first level items.
    # E.g. "1.1" is Respiratory (Surgical), while "1" is just Surgical and "2" non-Surgical.
    if not s or type(s) != str: # !!!
        return np.nan      
    s = s.split(".")
    return ".".join(s[:level])

# process reasons for admission (taxonomy)
dtf["RAICU1_trim"] = dtf["RAICU1"].apply(process_diagnosis)
dtf["RAICU2_trim"] = dtf["RAICU2"].apply(process_diagnosis)
dtf["OCPMH_trim"] = dtf["OCPMH"].apply(process_diagnosis)
dt["RAICU1_trim"] = dt["RAICU1"].apply(process_diagnosis)
dt["RAICU2_trim"] = dt["RAICU2"].apply(process_diagnosis)
dt["OCPMH_trim"] = dt["OCPMH"].apply(process_diagnosis)
```
Create dummy variables from all remaining categorical variables, by one-hot encoding.

```python
# make variables categorical
dummied = ["RAICU1_trim","RAICU2_trim","OCPMH_trim","SOHA","SEX","RESA","HLOCA","LOCA","PA_V3","SCODE","CLASSNS","PLOCA","TYPEIHA","CCA","CPR_V3","DEP","TNESSA","ITW_V3","OD_V3"]
dtf_final = pd.get_dummies(dtf, columns=dummied, dummy_na=False)
dt_final = pd.get_dummies(dt, columns=dummied, dummy_na=False)
```

As the first 10 hours of time-series data is used to build the model, the  predictions are done only in patients that have lived at least those 10 hours.
```python
# drop all patients that didnt live 10 hours
dtf_final = dtf_final[dtf_final['time_to_die']>60*10]
```
Drop unneccessary columns (either judged as not predictive or duplicated after the creation of dummy variables) as well as
columns that can leak the time of death target information (eg. number of days on the ICU `CCL3D`).
```python
# drop columns not needed for predictions
columns_to_drop = ["time_arrive_hospital",'REFOD','BCSD','DSD','ARSD','BRSD','ACSD',"GSD",'DHRS','ORGAN_SUPPORT','NSD','LSD','RSD','CCL3D','CCL2D',"time_from_birth","time_of_birth","SOHD","DWFRD","TWFRD","UDIS","DDICU","DDH","HDIS","RESD","UHDIS","URAICU","DDBSD","TDBSD","pid","spell","index","ADNO","ICNNO","bed02","bed03","bed05","time_arrive","time_death", "HCMEST","WKGEST","DAH","DAICU","DIS","DOAH","DOAICU","DLCCA","DTW","TTW","DOB","DOD","TOD","TBRICU","DBRICU","RAICU1","RAICU2","OCPMH","ITW_V3_B","ITW_V3_H","ITW_V3_N","ITW_V3_W","OD_V3_H","OD_V3_N","OD_V3_O","OD_V3_T","BSDTP",'AMUAI','apache_score','apache_prob']

dtf_final = dtf_final.drop(columns=columns_to_drop)
dt_final = dt_final.drop(columns=columns_to_drop)
```
Deal with NaN values on every column: Intuitively, NaN values usually entail a lack of observation due to the measurement
deemed as not important for the patient/condition at hand. Considering this, it is decided to drop all columns containing more than 50%
of NaN values. For the remaining NaN values, the default value of -1 was chosen to represent such
a situation (the default value of 0 is first considered, however there are fields where zero can be the result of a measurement).
```python
# convertinf infs to nans 
dtf_final = dtf_final.replace([np.inf, -np.inf], np.nan)
dt_final = dt_final.replace([np.inf, -np.inf], np.nan)

# dealing with NULLs by turning them all to nans
dtf_final.replace(['NULL'], np.nan,inplace=True)
dt_final.replace(['NULL'], np.nan,inplace=True)

# removing columns with more than 50% of nans 
dtf_final.dropna(thresh=0.50*len(dtf_final), axis=1,inplace=True)
dt_final.dropna(thresh=0.50*len(dt_final), axis=1,inplace=True)

# dealing with nans by turning them all to -1 (definitely suboptimal!)
dtf_final.replace([np.nan], -1,inplace=True)
dt_final.replace([np.nan], -1,inplace=True)

dtf_final_n= list(dtf_final.shape)
dt_final_n= list(dt_final.shape)
```
Prepare the final dataset for modelling.
```python
# Prepare input features, drop target variables
dtf_final_X = dtf_final.drop(["time_to_die",'survival_class'], axis=1)
dt_final_X = dt_final.drop(["time_to_die",'survival_class'], axis=1)
```
### Data modelling on Python
#### Regression modelling
First, a linear regression model with ElasticNet regularization (joint L1 and L2) is implemented to try to predict the amount of time (in minutes) elapsed from admission to death. 

Start preparing the features and target samples.
```python
# demographic plus time-series data
y = dtf_final["time_to_die"].values
X = dtf_final_X.values

# demographic only data
y_nts = dt_final["time_to_die"].values
X_nts = dt_final_X.values
```

Split datasets into training/testing samples. Standardise both datasets and run the modelling. 


```python
import sklearn
from sklearn.model_selection import train_test_split

# demographic only data
X_nts_train, X_nts_test, y_nts_train, y_nts_test = train_test_split(X_nts, y_nts, test_size=0.20, random_state=42)


# demographic + time series data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42)

# apply transformations to data: standardize X
from sklearn.preprocessing import StandardScaler
X_scaler = StandardScaler()
X_train = X_scaler.fit_transform(X_train)
X_test = X_scaler.transform(X_test)

# demographic only data
X_nts_scaler = StandardScaler()
X_nts_train = X_nts_scaler.fit_transform(X_nts_train)
X_nts_test = X_nts_scaler.transform(X_nts_test)

from sklearn.linear_model import ElasticNet
from sklearn.metrics import explained_variance_score, r2_score

# Training on demographic only data

clf_nts = ElasticNet(alpha=5.0,l1_ratio=0.5)
clf_nts.fit(X_nts_train, y_nts_train)

y_nts_true_reg, y_nts_pred_reg = y_nts_test, clf_nts.predict(X_nts_test)
metrics_nts_testing =[explained_variance_score(y_nts_true_reg, y_nts_pred_reg), r2_score(y_nts_true_reg, y_nts_pred_reg)]

# Training on demographic+ time series data:
clf = ElasticNet(alpha=5.0,l1_ratio=0.3)
clf.fit(X_train, y_train)

y_true_reg, y_pred_reg = y_test, clf.predict(X_test)
metrics_testing =[explained_variance_score(y_true_reg, y_pred_reg), r2_score(y_true_reg, y_pred_reg)]
```
#### Visualisation of the results from the modeling

```javascript
let y_pred_list = []
let y_true_list = []
let y_nts_pred_list = []
let y_nts_true_list = []

for (let i = 0; i < y_pred_reg.length; i++){
	y_pred_list.push(y_pred_reg[i][0]/60)
  y_true_list.push(y_true_reg[i][0]/60)
  
  y_nts_pred_list.push(y_nts_pred_reg[i][0]/60)
  y_nts_true_list.push(y_nts_true_reg[i][0]/60)
}

var trace1 = {
  x: y_true_list,
  y: y_pred_list,
  mode: 'markers',
  name: 'All data',
};

var trace2 = {
  x: y_nts_true_list,
  y: y_nts_pred_list,
  mode: 'markers',
  name: 'Demographic-only data',
};

var layout_reg_nts = {
  margin: { t: 50 },
  title: 'Model Time to Death',
  xaxis: {
    title: 'True Time to death (hours)',
    titlefont: {
      family: 'Courier New, monospace',
      size: 13,
      color: '#7f7f7f'
    }
  },
  yaxis: {
    title: 'Predicted Time to death (hours)',
    titlefont: {
      family: 'Courier New, monospace',
      size: 13,
      color: '#7f7f7f'
    }
  }
};

addOutput(function(id) {
  Plotly.newPlot( document.getElementById(id),[trace1, trace2],layout_reg_nts);
})
```

#### Classification modelling on the time to die (classification the survival potential on the first 100 hours):

The dataset is almost divided in half with patients that survive the first 100 hours from admition to the ICU, and the patients that doesnt.


```python
# Demographic only data"
# Class 1; time of death within the first 100 hours'
Class_1_nts = [round(dt_final[dt_final["survival_class"]==1].shape[0]/dt_final.shape[0],3)]
#Class 2: time of death after the first 100 hours',
Class_2_nts = [round(dt_final[dt_final["survival_class"]==0].shape[0]/dt_final.shape[0],3)]

#Demographic plus time series data")
#Class 1: time of death within the first 100 hours',
Class_1= [round(dtf_final[dtf_final["survival_class"]==1].shape[0]/dtf_final.shape[0],3)]
#Class 2: time of death after the first 100 hours'
Class_2= [round(dtf_final[dtf_final["survival_class"]==0].shape[0]/dtf_final.shape[0],3)]
```

```python
dt_1= list(dt_final[dt_final["survival_class"]==1].shape)
dt_0= list(dt_final[dt_final["survival_class"]==0].shape)

dtf_1 = list(dtf_final[dtf_final["survival_class"]==1].shape)
dtf_0= list(dtf_final[dtf_final["survival_class"]==0].shape)
```
Prepare input features, drop target variables

```python
#  Demographic + time series data
y_class = dtf_final["survival_class"].values
dtf_final_X = dtf_final.drop(["time_to_die",'survival_class'], axis=1)
X_columns_class = dtf_final_X.columns
X_class = dtf_final_X.values

# Only demographic data
y_nts_class = dt_final["survival_class"].values
dt_final_X = dt_final.drop(["time_to_die",'survival_class'], axis=1)
X_nts_columns_class = dt_final_X.columns
X_nts_class = dt_final_X.values
```
split training and testing datasets and standardize the data.

```python
# demographic + time series data
import sklearn
from sklearn.model_selection import train_test_split

X_train_class, X_test_class, y_train_class, y_test_class = train_test_split(X_class, y_class, test_size=0.20, random_state=42)

# demographic only data
X_nts_train_class, X_nts_test_class, y_nts_train_class, y_nts_test_class = train_test_split(X_nts_class, y_nts_class, test_size=0.20, random_state=42)
from sklearn.preprocessing import StandardScaler, MinMaxScaler

X_scaler_class = StandardScaler()
X_train_class = X_scaler_class.fit_transform(X_train_class)
X_test_class = X_scaler_class.transform(X_test_class)

# no TS data
X_nts_scaler_class = StandardScaler()
X_nts_train_class = X_nts_scaler_class.fit_transform(X_nts_train_class)
X_nts_test_class = X_nts_scaler_class.transform(X_nts_test_class)

#Import Random Forest Model
from sklearn.ensemble import RandomForestClassifier
from sklearn import metrics

#Create a random forest Classifier with optimised parameters
clf_nts_rf=RandomForestClassifier(n_estimators=100,bootstrap= True, criterion='gini', max_depth=10,max_features=10, min_samples_split=20)

# #Train the model using the training sets y_pred=clf.predict(X_test)
clf_nts_rf.fit(X_nts_train_class,y_nts_train_class)

y_nts_true_class, y_nts_pred_class = y_nts_test_class, clf_nts_rf.predict(X_nts_test_class)

# #Testing metrics:
y_true_class, y_pred_class = y_nts_test_class, clf_nts_rf.predict(X_nts_test_class)
metrics_Rf_testing_nts=[metrics.accuracy_score(y_true_class, y_pred_class)]


# Compute confusion matrix
cnf_matrix_nts = metrics.confusion_matrix(y_nts_test_class, y_nts_pred_class)
```
#### Visualise the confusion matrix for the sample with demographic only data

```javascript
let xValues =  ['< 100 hours', '> 100 hours']
let yValues =  ['> 100 hours','< 100 hours']
let zValues = []
let aRow = [];
for ( var i = xValues.length-1; i >=0; i-- ) {
  aRow = [];
  for (let j  = 0; j < yValues.length; j++) {
    aRow.push((cnf_matrix_nts[i][j]/(cnf_matrix_nts[i][0]+cnf_matrix_nts[i][1])).toFixed(2))
  }
  zValues.push(aRow)
}

let trace3 = {
  x: xValues, 
  y: yValues,
  z: zValues, 
  showscale: true,
  type: 'heatmap', 
  zmax: 1.0,
  zmin: 0
};

let layout_nts = {
  title: 'Confusion Matrix for Demographic-only data',
  annotations: [],
  xaxis: {
    title: 'Predicted value', 
    titlefont: {
      color: '#7f7f7f', 
      size: 12
    },
    ticks: '',
    side: 'bottom'
  }, 
  yaxis: {
    title: 'True value', 
    titlefont: {
      color: '#7f7f7f', 
      size: 12
    },
    ticks: '',
    side: 'top',
    width: 700,
    height: 700,
    autosize: false
  }
};

for ( var i = yValues.length-1; i >=0; i-- ) {
  for ( var j = 0; j < xValues.length; j++ ) {
    var currentValue = zValues[i][j];
    if (currentValue != 0.0) {
      var textColor = 'white';
    }else{
      var textColor = 'black';
    }
    var result = {
      xref: 'x1',
      yref: 'y1',
      x: xValues[j],
      y: yValues[i],
      text: zValues[i][j],
      font: {
        family: 'Arial',
        size: 12,
        color: 'rgb(50, 171, 96)'
      },
      showarrow: false,
      font: {
        color: textColor
      }
    };
    layout_nts.annotations.push(result)
  }
}
  
addOutput(function(id) {
  Plotly.newPlot(document.getElementById(id), [trace3], layout_nts);
});
```
Now we run the classification for the sample with demographic plus time-series data.
```python
from sklearn.ensemble import RandomForestClassifier
from sklearn import metrics

clf_rf=RandomForestClassifier(n_estimators=100,bootstrap= False, criterion='entropy', max_depth=100,max_features=10, min_samples_split=2)
#Train the model using the training sets y_pred=clf.predict(X_test)
clf_rf.fit(X_train_class,y_train_class)

y_true_class, y_pred_class = y_test_class, clf_rf.predict(X_test_class)

#Training metrics:
y_true_class, y_pred_class = y_train_class, clf_rf.predict(X_train_class)
metrics_Rf_training = [metrics.accuracy_score(y_true_class, y_pred_class)]

#Testing metrics:
y_true_class, y_pred_class = y_test_class, clf_rf.predict(X_test_class)
metrics_Rf_testing=[metrics.accuracy_score(y_true_class, y_pred_class)]

# Compute confusion matrix
cnf_matrix = metrics.confusion_matrix(y_test_class, y_pred_class)
```
#### Visualise the confusion matrix for the sample with demographic plus time-series data

```javascript
let xValues_cnf_ = ['< 100 hours', '> 100 hours']
let yValues_cnf_ =  ['> 100 hours','< 100 hours']

let zValues_cnf_ = []
let aRow_cnf_ = [];
for ( var i = xValues.length-1; i >=0; i-- ) {
  aRow_cnf_ = [];
  for (let j  = 0; j < yValues_cnf_.length; j++) {
    aRow_cnf_.push((cnf_matrix[i][j]/(cnf_matrix[i][0]+cnf_matrix[i][1])).toFixed(2))
  }
  zValues_cnf_.push(aRow_cnf_)
}

let trace4 = {
  x: xValues_cnf_, 
  y: yValues_cnf_,
  z: zValues_cnf_, 
  showscale: true,
  type: 'heatmap', 
  zmax: 1.0,
  zmin: 0
};

let layout_cnf= {
  title: 'Confusion Matrix for All data',
  annotations: [],
  xaxis: {
    title: 'Predicted value', 
    titlefont: {
      color: '#7f7f7f', 
      size: 12
    },
    ticks: '',
    side: 'bottom'
  }, 
  yaxis: {
    title: 'True value', 
    titlefont: {
      color: '#7f7f7f', 
      size: 12
    },
    ticks: '',
    side: 'top',
    width: 700,
    height: 700,
    autosize: false
  }
};

for ( var i = yValues_cnf_.length-1; i >=0; i-- ) {
  for ( var j = 0; j < xValues_cnf_.length; j++ ) {
    var currentValue_ = zValues_cnf_[i][j];
    if (currentValue_ != 0.0) {
      var textColor_ = 'white';
    }else{
      var textColor_ = 'black';
    }
    var result_ = {
      xref: 'x1',
      yref: 'y1',
      x: xValues_cnf_[j],
      y: yValues_cnf_[i],
      text: zValues_cnf_[i][j],
      font: {
        family: 'Arial',
        size: 12,
        color: 'rgb(50, 171, 96)'
      },
      showarrow: false,
      font: {
        color: textColor_
      }
    };
    layout_cnf.annotations.push(result_)
  }
}
  
addOutput(function(id) {
  Plotly.newPlot(document.getElementById(id), [trace4], layout_cnf);
});
```


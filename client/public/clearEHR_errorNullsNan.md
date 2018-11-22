# Welcome to Wrattler
### This is an attempt to load an data file in R, manipulate it a bit, and output multiple (two, really) dataframes that will be used for some analysis in Python.

```r

library(purrr)
library(cleanEHR)
# full dataset



# full dataset
#load(paste(data_folder,"anon_public_d.RData",sep="/"))
#ccd <- anon_ccd

#dt1 <- ccd_demographic_table(anon_ccd, dtype=TRUE)

file <- paste(tempdir(), "/ccd.rdata", sep="")
download.file("https://github.com/ropensci/cleanEHR/raw/master/data/sample_ccd.RData", file)
load(file)


mean_tail_diff <- function(vector) {
  diff <- mean(vector,na.rm=TRUE) - tail(vector,n=1)
  return (diff)
}


dt <- ccd_demographic_table(ccd, dtype=TRUE)

# get the codes of time series variables
names_ts_variables <- c()
counter <- 1
for (i in 1:length(ccd@episodes)){
  for (n in names(ccd@episodes[[i]]@data)){
    if (length(ccd@episodes[[i]]@data[n][[1]]) == 2){ # guarantee time series
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
for (i in 1:length(ccd@episodes)){
  adno <- as.numeric(ccd@episodes[[i]]@data[index_variable][[1]])
  measurements <- c(adno)
  for (n in names_ts_variables){
      # Add time limit of 10 hours to measure TS data!
      dts_episode <- ccd@episodes[[i]]@data[n][[1]]

      ## the following line broke wrattler (but runs in normal R), as alternative i used the subset function:
      #dts_episode_sub <- dts_episode[dts_episode$time < 10,]

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

```python


dtf = dt.merge(dts, left_on="ADNO", right_on="ADNO", how="inner")

dtf0_headers = list(dtf.shape)

# drop rows without entry and death timestamps or completely null columns
dtf = dtf[pd.notnull(dtf['DAICU'])&pd.notnull(dtf['DOD'])&pd.notnull(dtf['TOD'])] # columns needed for target (time to die)
dt = dt[pd.notnull(dt['DAICU'])&pd.notnull(dt['DOD'])&pd.notnull(dt['TOD'])] # columns needed for target (time to die)
dtf = dtf.dropna(axis=1, how='all')
dt = dt.dropna(axis=1, how='all')

dtf_headers = list(dtf.shape)

import numpy as np

def export_datetime_slash(s):
    
    return str(pd.to_datetime(s,infer_datetime_format=True))
    

dtf["time_arrive_hospital"] = dtf["DAH"].apply(export_datetime_slash)

dtf_time_hospital = dtf["time_arrive_hospital"]


def export_datetime(s):

    if 'NULL' in s or 'None' in s or 'NaN' in s or s == np.datetime64('NaT'):
        return "1969-01-01	01:00:00"
        
    if "T" in s:
        if len(s.split("T")[1].split(":")) > 2:
            return str(s.split("T")[0]+" "+s.split("T")[1])
        else:
            return str(s.split("T")[0]+" "+s.split("T")[1]+":00")
    
    elif " " in s:
        if len(s.split(" ")[1].split(":")) > 2:
            return str(s.split(" ")[0]+" "+s.split(" ")[1])
        else:
            return str(s.split(" ")[0]+" "+s.split(" ")[1]+":00")
     
 

   

dtf["time_arrive"] = dtf["DAICU"].apply(export_datetime)
dtf["time_death"] = dtf["DOD"] +"T"+ dtf["TOD"]
dtf["time_death"] = dtf["time_death"].apply(export_datetime)

dtf = dtf.dropna(subset=['time_death'])


dtf["time_to_ICU"] = (pd.to_datetime(dtf["time_arrive"],infer_datetime_format=True) -pd.to_datetime(dtf["time_arrive_hospital"],infer_datetime_format=True))
dtf["time_to_die"] = (pd.to_datetime(dtf["time_death"],infer_datetime_format=True)-pd.to_datetime(dtf["time_arrive"],infer_datetime_format=True))

from datetime import datetime

def get_ttd(td):
    
    if td=='NULL' or td=='NaN' or td==np.nan or td == np.datetime64('NaT')     :
        return 0
    else:
        return (td.days*24*60) + (td.seconds/60)
        

dtf["time_to_ICU"] = dtf["time_to_ICU"].apply(get_ttd)
dtf["time_to_die"] = dtf["time_to_die"].apply(get_ttd)

def process_diagnosis(s,level=2):
    # takes a diagnosis code and returns only the first level items.
    # E.g. "1.1" is Respiratory (Surgical), while "1" is just Surgical and "2" non-Surgical.
    if not s or type(s) != str: # !!!
        return np.nan      
    s = s.split(".")
    return ".".join(s[:level])

def get_survival_class(time):
        # Classify people that died in the first 100 hours  after admission.
    if time<6000:
        return 1
    else:
        return 0

def get_age(td):
    if td=='NULL' or td=='NaN' or td==np.nan or td == np.datetime64('NaT')     :
        return 0
    else:
        # returns years 
        return np.abs(td.days)/365


# remove persons arrived dead
dtf = dtf[dtf["time_arrive"] <= dtf["time_death"]] # remove persons arrived dead

# add target survival class
dtf["survival_class"] = dtf["time_to_die"].apply(get_survival_class)

# do the same for demographic only data frame
dt["time_arrive_hospital"] = dt["DAH"].apply(export_datetime_slash)
dt["time_arrive"] = dt["DAICU"].apply(export_datetime)
dt["time_death"] = dt["DOD"] +"T"+ dt["TOD"]
dt["time_death"] = dt["time_death"].apply(export_datetime)


dt["time_to_ICU"] = (pd.to_datetime(dt["time_arrive"],infer_datetime_format=True) -pd.to_datetime(dt["time_arrive_hospital"],infer_datetime_format=True))
dt["time_to_die"] = (pd.to_datetime(dt["time_death"],infer_datetime_format=True)-pd.to_datetime(dt["time_arrive"],infer_datetime_format=True))

dt["time_to_die"] = dt["time_to_die"].apply(get_ttd)

dt["time_to_ICU"] = dt["time_to_ICU"].apply(get_ttd)
# remove persons arrived dead
dt = dt[dt["time_arrive"] <= dt["time_death"]] 

# add survival class
dt["survival_class"] = dt["time_to_die"].apply(get_survival_class)


# get AGE using DOB (this needs to be updated)
dtf["time_of_birth"] = dtf["DOB"].apply(export_datetime)
dt["time_of_birth"] = dt["DOB"].apply(export_datetime)

dtf["time_from_birth"] = (pd.to_datetime(dtf["time_arrive"],infer_datetime_format=True) -pd.to_datetime(dtf["time_of_birth"],infer_datetime_format=True))
dt["time_from_birth"] = (pd.to_datetime(dt["time_arrive"],infer_datetime_format=True) -pd.to_datetime(dt["time_of_birth"],infer_datetime_format=True))

dtf["time_from_birth"] = dtf["time_from_birth"].apply(get_age)
dt["time_from_birth"] = dt["time_from_birth"].apply(get_age)

# process reasons for admission (taxonomy)
dtf["RAICU1_trim"] = dtf["RAICU1"].apply(process_diagnosis)
dtf["RAICU2_trim"] = dtf["RAICU2"].apply(process_diagnosis)
dtf["OCPMH_trim"] = dtf["OCPMH"].apply(process_diagnosis)
dt["RAICU1_trim"] = dt["RAICU1"].apply(process_diagnosis)
dt["RAICU2_trim"] = dt["RAICU2"].apply(process_diagnosis)
dt["OCPMH_trim"] = dt["OCPMH"].apply(process_diagnosis)

dtf["age"] = dtf["time_from_birth"]
dt["age"] = dt["time_from_birth"]


# make variables categorical
dummied = ["RAICU1_trim","RAICU2_trim","OCPMH_trim","SOHA","SEX","RESA","HLOCA","LOCA","PA_V3","SCODE","CLASSNS","PLOCA","TYPEIHA","CCA","CPR_V3","DEP","TNESSA","ITW_V3","OD_V3"]
dtf_final = pd.get_dummies(dtf, columns=dummied, dummy_na=False)
dt_final = pd.get_dummies(dt, columns=dummied, dummy_na=False)

# drop all patients that didnt live 10 hours
dtf_final = dtf_final[dtf_final['time_to_die']>60*10]


# In[10]:


# drop columns not needed for predictions
# columns_to_drop = ["time_arrive_hospital",'REFOD','BCSD','DSD','ARSD','BRSD','ACSD',"GSD",'DHRS','ORGAN_SUPPORT','NSD','LSD','RSD','CCL3D','CCL2D',"time_from_birth","time_of_birth","SOHD","DWFRD","TWFRD","UDIS","DDICU","DDH","HDIS","RESD","UHDIS","URAICU","DDBSD","TDBSD",                   "pid","spell","index","ADNO","ICNNO","bed02","bed03","bed05","time_arrive","time_death", "HCMEST","WKGEST","DAH","DAICU","DIS","DOAH","DOAICU","DLCCA","DTW","TTW","DOB","DOD",                   "TOD","TBRICU","DBRICU","RAICU1","RAICU2","OCPMH","ITW_V3_B","ITW_V3_H","ITW_V3_N",                   "ITW_V3_W","OD_V3_H","OD_V3_N","OD_V3_O","OD_V3_T","BSDTP",'AMUAI','apache_score','apache_prob']

columns_to_drop = ["time_arrive_hospital",'REFOD','BCSD','DSD','ARSD','BRSD','ACSD',"GSD",'ORGAN_SUPPORT','NSD','LSD','RSD','CCL3D','CCL2D',"time_from_birth","time_of_birth","SOHD","DWFRD","TWFRD","UDIS","DDICU","DDH","HDIS","RESD","UHDIS","URAICU","DDBSD","TDBSD",                   "pid","spell","index","ADNO","ICNNO","bed02","bed03","bed05","time_arrive","time_death", "HCMEST","WKGEST","DAH","DAICU","DIS","DOAH","DOAICU","DLCCA","DTW","TTW","DOB","DOD",                   "TOD","TBRICU","DBRICU","RAICU1","RAICU2","OCPMH","ITW_V3_B","ITW_V3_N", "ITW_V3_W","OD_V3_N","BSDTP",'AMUAI','apache_score','apache_prob']

dtf_final.drop(columns=columns_to_drop,inplace=True)
dt_final.drop(columns=columns_to_drop,inplace=True)


dtf_final.replace([np.inf, -np.inf], np.nan,inplace=True)
dt_final.replace([np.inf, -np.inf], np.nan,inplace=True)

dtf_final.dropna(thresh=0.50*len(dtf_final), axis=1,inplace=True)
dt_final.dropna(thresh=0.50*len(dt_final), axis=1,inplace=True)

# this line breaks the code
#dtf_final[dtf_final.isna()] = -1

```
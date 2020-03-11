# Neonatal timeseries

<br>

In this notebook, we will investigate whether we can detect patterns in the
monitoring traces of these premature babies in intensive care. Being able to
automatically artifactual events (such as when the probe disconnects),
in particular, would reduce the high number of false alarms when monitoring
for conditions of the baby and thus help to focus attention on the true state
of health of the baby.

We will compare the results of using the raw time series signal in change point
detection, to when features that are derived from the signal are used in a
decision tree based approach. 

<!-- REF previous work -->

<br>

## Data overview

The data loaded here is several physiological measurements on fifteen patients
in neonatal intensive care over 24 hours. The timeseries have been marked up by
experts to indicate clinical and external artefactual events.

The types of readings directly obtained from the babies and the environment are:

* Heartbeats per minute
* Blood pressure
* Oxygen saturation measure using transcutaneous probe
* Core temperature and peripheral temperature
* Incubator humidity
* Incubator temperature

The events that were annotated include:

* Bradycardia
* Incubator opening
* Recalibration of transcutaneous probe
* Normal and abnormal times
* Blood sampling
* Disconnection of core temperature probe

<br>

## Monitoring traces

Below we load the data described above and plot the raw signal of each
monitoring trace across the neonatals.

```python
import os
nInstall = os.system("python3 -m pip install --upgrade --user numpy")
mInstall = os.system("python3 -m pip install --upgrade --user matplotlib")
sInstall = os.system("python3 -m pip install seaborn")
print("Installation exit statuses:", nInstall, mInstall, sInstall)

import requests
import scipy.io
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

MISSING_VAL = -1

def getNeonatalData():
    """
    Download local copy of neonatal matlab data file and return data partitions
    :returns: data and intervals partitions
    """
    if not os.path.isfile("15days.mat"):
        response = requests.get("https://tadap.blob.core.windows.net/icuneonatal/15days.mat")
        f = open("15days.mat", 'wb')
        f.write(response.content)
        f.close()
    
    mat = scipy.io.loadmat("15days.mat")
    return mat['data'], mat['intervals']

def unravelValueFromArray(arr):
    """
    Recursively unravel nested array (with arbitrary nests)
    :returns: first inner int or string value found in array
    """
    if any([isinstance(arr, t) for t in [np.uint8, str]]):
        return arr
    elif (isinstance(arr, float) and np.isnan(arr)) or len(arr) == 0:
        return MISSING_VAL # [] or nan
    return unravelValueFromArray(arr[0])

def buildMetadata(dat):
    """
    Builds neonatal metadata from given raw data
    :returns: pandas dataframe (maps gestation, sex and day of life to baby id)
    """
    babyIds = list(range(15))
    metadataDict = {}
    for bId in babyIds:
        metadata = dat['preprocessed'][0][0][0][bId][0]
        metadataDict[bId] = {}
        metadataDict[bId]['gestation'] = unravelValueFromArray(metadata['gestation'])
        metadataDict[bId]['sex'] = unravelValueFromArray(metadata['sex'])
        metadataDict[bId]['dayoflife'] = unravelValueFromArray(metadata['dayoflife'])
    return pd.DataFrame.from_dict(metadataDict, orient="index")

def getListOfEventNames(intervals):
    """
    :returns: labels of annotations/events present in dataset
    """
    return intervals[0].dtype.names

def buildAnnotations(eNames, intervals):
    """
    Build intervals of annotations/events for each baby
    :returns: pandas dataframe with outer index of baby id where each row is
    tuple containing start and end times (intervals) of events
    """
    annotations = {}
    for conditionName in eNames:
        conditionIntervals = intervals[0][conditionName]
        babyData = {}
        for babyId in range (0, 15):
            intervalsForBaby = conditionIntervals[0][babyId][0]
            for i, v in enumerate(intervalsForBaby):
                if len(intervalsForBaby[i]) == 2:
                    babyData[(babyId, i)] = (v[0], v[1])
        annotations[conditionName] = babyData
    multiIndDf = pd.DataFrame(annotations).fillna(-1)
    unravelledDf = multiIndDf.reset_index().rename(columns={"level_0": "BabyId",
                                                            "level_1": "Instance"})
    return unravelledDf

def getChannelNames(dat, babyId):
    """
    :returns: list of labels of channels present for a given baby
    """
    return np.concatenate(dat['preprocessed'][0][0][0][babyId][0]['labels'][0][0]).ravel().tolist()

def buildTimeseries(dat, babyId):
    """
    Builds channel timeseries from given data for a given baby (nans replaced with -1)
    :returns: pandas dataframe with columns time (seconds), and channel readings
    """
    channelsForBaby = getChannelNames(dat, babyId)
    readingsForBaby = dat['preprocessed'][0][0][0][babyId][0]['channels'][0]
    df = pd.DataFrame(readingsForBaby, columns=channelsForBaby)
    return df.reset_index().rename(columns={"index": "tSeconds"})

def dfPlotAllBabies(dat, babies = range(0, 15), rowsToPlot = ['HR', 'SO']):
    """
    Plot the raw traces of the given channels, including the given number of babies on each plot
    :param babies: list/range of babies to include in each plot
    :param rowsToPlot: channels to plot
    """
    fig, axes = plt.subplots(len(rowsToPlot), 1, figsize = (16, 10 * len(rowsToPlot)))
    colours = sns.color_palette('husl', n_colors = len(range(0, 15)))
    for i, rowName in enumerate(rowsToPlot):
        for babyId in babies:
            if len(rowsToPlot) == 1:
                ax = axes
            else:
                ax = axes[i]
            babyDf = buildTimeseries(dat, babyId)
            ax.scatter(babyDf['tSeconds'], babyDf[rowName], label = babyId, s = 0.1, color = colours[babyId])
            ax.set_ylabel(rowName, fontsize = 18)
            ax.set_xlabel("Time (seconds)", fontsize = 18)
        ax.legend(title = "Baby", markerscale = 25, ncol = 3)
    plt.tight_layout()

#-----------------------------------
# load, build metadata, and annotations of corresponding events
data, intervals = getNeonatalData()
metadataDf = buildMetadata(data)
eventNames = getListOfEventNames(intervals)
annotationsDf = buildAnnotations(eventNames, intervals)

#-----------------------------------
# plot raw traces for each channel across neonatals
plt.clf() # remove previous plots
dfPlotAllBabies(data)
```

## Event conditions

Below we plot the presence of 'events' per baby and can overlay the raw trace of
individual monitoring traces.

```python
import scipy.io
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
import numpy as np                                                            

def expandEventData(eventAnnotations):
    """
    Flatten a list of intervals of events for a baby, and expand it so that
    consecutive times are returned.
    :param eventAnnotations: intervals of annotations of events for the baby
                             (list of lists of start and end times for an event)
    """
    consecutive_periods = [list(range(start, end)) for start, end in eventAnnotations]
    flatten = lambda l: [item for sublist in l for item in sublist]
    return flatten(consecutive_periods)

def dfPlotEventsForBaby(dat, annotateDf, eNames, babies = range(0, 15), overlayChannel = None):
    """
    Plot the presence/absence of events for a baby over time and overlay an accompanying channel
    trace.
    """
    fig, axes = plt.subplots(len(babies), 1, figsize = (16, 8 * len(babies)))
    colours = sns.color_palette('husl', n_colors=len(eNames))
    for i, babyId in enumerate(babies):
        if len(babies) == 1:
            ax = axes
        else:
            ax = axes[i]
        babyAnnot = annotateDf[annotateDf['BabyId'] == babyId]
        eventsForBaby = []
        for eNum, e in enumerate(eNames):
            j = len(eventsForBaby)
            annotations = babyAnnot[babyAnnot[e] != -1][e].values
            if len(annotations) > 0:
                eventsForBaby.append(e)
                expandedEventData = expandEventData(annotations)
                ax.scatter(x = expandedEventData, y = [j]*len(expandedEventData), c = [colours[eNum]])

        ax.set_title("Baby {}".format(babyId), fontsize=18)
        ax.set_xlabel("Time (seconds)", fontsize=18)
        ax.set_yticks(list(range(len(eventsForBaby))))
        ax.set_yticklabels(eventsForBaby, fontsize=18)
        
        if overlayChannel:
            channels = np.concatenate(dat['preprocessed'][0][0][0][babyId][0]['labels'][0][0]).ravel().tolist()                                                                          
            readings = dat['preprocessed'][0][0][0][babyId][0]['channels'][0]                                                   
            babyDf = pd.DataFrame(readings, columns=channels).reset_index().rename(columns={"index": "tSeconds"})

            ax2 = ax.twinx()
            ax2.scatter(babyDf['tSeconds'], babyDf[overlayChannel], label = overlayChannel, s = 0.1, color = "lightgrey")
            ax2.legend(title = "Channel", markerscale = 25, ncol = 3)
            ax2.set_ylabel(overlayChannel, fontsize = 18)  
    plt.tight_layout()

mat = scipy.io.loadmat("15days.mat")['data']
plt.clf()
dfPlotEventsForBaby(mat, annotationsDf, eventNames['0'].values, babies=[1,2,3,4], overlayChannel='HR')
```
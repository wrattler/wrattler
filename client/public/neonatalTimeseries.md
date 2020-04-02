# Neonatal timeseries

<br>

In this notebook, we will investigate whether we can detect patterns in the
monitoring traces of these premature babies in intensive care. Being able to
automatically artifactual events (such as when the probe disconnects),
in particular, would reduce the high number of false alarms when monitoring
for conditions of the baby and thus help to focus attention on the true state
of health of the baby.

<br>

## Data overview

The data loaded here is several physiological measurements on fifteen patients
in neonatal intensive care over 24 hours. The timeseries have been marked up by
experts to indicate clinical and external artefactual events.

The types of readings directly obtained from (at least some of) the babies and environment are:

- Heartbeats per minute
- Blood pressure
- Oxygen saturation measure using transcutaneous probe
- Core temperature and peripheral temperature
- Incubator humidity
- Incubator temperature

The events that were annotated include:

- Bradycardia
- Incubator opening
- Recalibration of transcutaneous probe
- Normal and abnormal times
- Blood sampling
- Disconnection of core temperature probe

<br>

## Monitoring traces

Below we load the data described above and plot the raw signal of each
monitoring trace across the neonatals.

```javascript
// temporary styling fix
loadInlineStyle(`
.tabs + * {
    margin-top: 10px
}
`)
```

```python
import os
n = os.system("python3 -m pip install --upgrade --user numpy")
m = os.system("python3 -m pip install --upgrade --user matplotlib")
s = os.system("python3 -m pip install seaborn")
print("Installation exit statuses:{},{},{}".format(n, m, s))

import requests
import scipy.io
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

MISSING_VAL = -1

def get_neonatal_data():
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

def unravel_value_from_array(arr):
    """
    Recursively unravel nested array (with arbitrary nests)
    :returns: first inner int or string value found in array
    """
    if any([isinstance(arr, t) for t in [np.uint8, str]]):
        return arr
    elif (isinstance(arr, float) and np.isnan(arr)) or len(arr) == 0:
        return MISSING_VAL # [] or nan
    return unravel_value_from_array(arr[0])

def build_metadata(dat):
    """
    Builds neonatal metadata from given raw data
    :returns: pandas dataframe (maps gestation, sex and day of life to baby id)
    """
    baby_ids = list(range(15))
    metadata_dict = {}
    for b_id in baby_ids:
        metadata = dat['preprocessed'][0][0][0][b_id][0]
        metadata_dict[b_id] = {}
        metadata_dict[b_id]['gestation'] = unravel_value_from_array(metadata['gestation'])
        metadata_dict[b_id]['sex'] = unravel_value_from_array(metadata['sex'])
        metadata_dict[b_id]['dayoflife'] = unravel_value_from_array(metadata['dayoflife'])
    return pd.DataFrame.from_dict(metadata_dict, orient="index")

def get_event_names(intervals):
    """
    :returns: labels of annotations/events present in dataset
    """
    return intervals[0].dtype.names

def build_annotations(e_names, intervals):
    """
    Build intervals of annotations/events for each baby
    :returns: pandas dataframe with outer index of baby id where each row is
    tuple containing start and end times (intervals) of events
    """
    annotations = {}
    for event in e_names:
        event_intervals = intervals[0][event]
        baby_data = {}
        for b_id in range(0, 15):
            intervals_for_baby = event_intervals[0][b_id][0]
            for i, v in enumerate(intervals_for_baby):
                if len(intervals_for_baby[i]) == 2:
                    baby_data[(b_id, i)] = (v[0], v[1])
        annotations[event] = baby_data
    multi_index_df = pd.DataFrame(annotations).fillna(-1)
    unravelled_df = multi_index_df.reset_index().drop(columns=["level_1"])
    return unravelled_df.rename(columns={"level_0": "baby_id"})

def get_channel_names(dat, baby_id):
    """
    :returns: list of labels of channels present for a given baby
    """
    return np.concatenate(dat['preprocessed'][0][0][0][baby_id][0]['labels'][0][0]).ravel().tolist()

def build_timeseries(dat, baby_id):
    """
    Builds channel timeseries from given data for a given baby (nans replaced with -1)
    :returns: pandas dataframe with columns time (seconds), and channel readings
    """
    channels_for_baby = get_channel_names(dat, baby_id)
    readings_for_baby = dat['preprocessed'][0][0][0][baby_id][0]['channels'][0]
    df = pd.DataFrame(readings_for_baby, columns=channels_for_baby)
    return df.reset_index().rename(columns={"index": "time_s"})

def plot_all_babies(dat, babies=range(0, 15), plot_features=['HR','SO']):
    """
    Plot the raw traces of the given channels, including the given number of babies on each plot
    :param babies: list/range of babies to include in each plot
    :param plot_features: channels to plot
    """
    fig, axes = plt.subplots(len(plot_features), 1, figsize = (16, 10*len(plot_features)))
    colours = sns.color_palette('husl', n_colors=len(range(0, 15)))
    for i, feature in enumerate(plot_features):
        for b_id in babies:
            if len(plot_features) == 1:
                ax = axes
            else:
                ax = axes[i]
            baby_df = build_timeseries(dat, b_id)
            if baby_df.get(feature) is not None:
                ax.scatter(baby_df['time_s'], baby_df[feature], label=b_id, s=0.1, color=colours[b_id])
                ax.set_ylabel(feature, fontsize=18)
                ax.set_xlabel("Time (seconds)", fontsize=18)
        ax.legend(title="Baby", markerscale=25, ncol=3)
    plt.tight_layout()

#-----------------------------------
# load, build metadata, and annotations of corresponding events
data, intervals = get_neonatal_data()
metadata_df = build_metadata(data)
event_names = get_event_names(intervals)
annotations_df = build_annotations(event_names, intervals)

#-----------------------------------
# plot raw traces for each channel across neonatals
plt.clf() # remove previous plots
plot_all_babies(data, plot_features=['HR', 'SO', 'Incu.Air Temp', 'TP', 'TC'])
```

The above figures shows the raw values of the channel recordings that are available for all of the babies:
* Heart rate (HR), in beats per minute (bpm)
* Saturation of oxygen in pulse (SO), as a percentage
* Temperature of the air in incubator (Inc.Air Temp), in degrees Celsius
* Peripheral body temperature (TP), in degrees Celsius
* Core temperature (TC), in degrees Celsius

Although we observe that there are generally boundaries of values for each channel,
the baselines of what might be considered normal for each neonatal vary quite considerably.
There are also periods in some signals where recordings drop to flat horizontal line (at zero heart rate, for example),
which may correspond to some of the artefactual events we are hoping to identify automatically.

<br>

## Event conditions

To investigate whether such unusual periods of readings do in fact correspond to some kind of
labelled event, below we plot the presence of 'events' per baby and can overlay the raw trace of
individual monitoring traces.

```python
import scipy.io
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
import numpy as np

def expand_event_data(event_annotations):
    """
    Flatten a list of intervals of events for a baby, and expand it so that
    consecutive times are returned
    :param event_annotations: intervals of annotations of events for the baby
                              (list of lists of start and end times for an event)
    """
    consecutive_data = [np.arange(start, end) for start, end in event_annotations]
    return np.concatenate(consecutive_data).ravel().tolist()

def plot_events_for_baby(dat, annotate_df, e_names, babies=range(0, 15), overlay_channel=None):
    """
    Plot the presence/absence of events for a baby over time and overlay an accompanying channel trace
    """
    fig, axes = plt.subplots(len(babies), 1, figsize=(20, 8*len(babies)))
    colours = sns.color_palette('husl', n_colors=len(e_names))
    for i, b_id in enumerate(babies):
        if len(babies) == 1:
            ax = axes
        else:
            ax = axes[i]
        annotations_for_baby = annotate_df[annotate_df['baby_id'] == b_id]
        events_for_baby = []
        for e_num, e in enumerate(e_names):
            j = len(events_for_baby)
            annotations = annotations_for_baby[annotations_for_baby[e] != -1][e].values
            if len(annotations) > 0:
                events_for_baby.append(e)
                expanded_e_data = expand_event_data(annotations)
                ax.scatter(x = expanded_e_data, y = [j]*len(expanded_e_data), c = [colours[e_num]])

        ax.set_title("Baby {}".format(b_id), fontsize=18)
        ax.set_xlabel('Time (seconds)', fontsize=18)
        ax.set_yticks(list(range(len(events_for_baby))))
        ax.set_yticklabels(events_for_baby, fontsize=18)

        if overlay_channel:
            channels = np.concatenate(dat['preprocessed'][0][0][0][b_id][0]['labels'][0][0]).ravel().tolist()
            readings = dat['preprocessed'][0][0][0][b_id][0]['channels'][0]
            baby_df = pd.DataFrame(readings, columns = channels).reset_index().rename(columns={"index": "time_s"})

            if baby_df.get(overlay_channel) is not None:
                ax2 = ax.twinx()
                ax2.scatter(baby_df['time_s'], baby_df[overlay_channel], label=overlay_channel, s=0.1, color='lightgrey')
                ax2.legend(title="Channel", markerscale=25, ncol=3)
                ax2.set_ylabel(overlay_channel, fontsize=18)
    plt.tight_layout()

#-----------------------------------
# overlay channel recording on events occuring
mat = scipy.io.loadmat("15days.mat")['data']
plt.clf()
plot_events_for_baby(mat, annotations_df, event_names['0'].values, overlay_channel='HR')
```

In the above figure, we overlap the raw heart rate recordings aligned with the intervals of events
recorded for each baby. Across the babies, we notice that they each have **different distribution of the events**:
some have no blood sample events, and some frequently experience Bradycardia whilst others dont.

As expected with overlaying the heart rate, we often see sharp drops in the reading co-occur with
the event of Bradycardia (which itself is a heart condition), as seen in `Baby 13`. We also seen several
instances of artefactual events too, however, such as in `Baby 14`'s reading at around 25,000 seconds in - where the heart rate
is seen falling steeply but is instead associated with the disconnection of a probe followed by a blood sample being taken.

<br>

## Windowing the data and deriving features

In order to structure the data in such a way that it can be easily fed into an algorithm, we choose to
segment the data into **fixed-length windows and either use the raw signal** (of each point in the window) or
preprocess each window to **obtain derived features** of it (such as the maximum and minimum point).

From running the cell below, we see that the average length of intervals for the different events differ quite a lot,
with Bradycardia having the smallest average length (36 seconds). Hence, the **optimal size of the window** for processing
the data will differ across events, and is a parameter that can be optimised in the future.

```python
import numpy as np

def get_average_interval_len(event_intervals):
    """
    Calculate the average length and standard deviation of the given intervals of events
    """
    diffs = [end-start for start, end in event_intervals.values]
    return round(np.mean(diffs), 2), round(np.std(diffs), 2)

#-----------------------------------
# print average length of intervals for events
for e in event_names['0'].values:
    intervls = annotations_df[e][annotations_df[e] != -1]
    avg_len, sd_len = get_average_interval_len(intervls)
    print("Event {}: {} mean (s), {} std\n".format(e, avg_len, sd_len))
```

The code below is responsible for building the dataset and running various training loops.
Note that we **test on babies that are unseen to provide a more realistic setting**, as to not test
on a baby that we may have already trained on parts of their trace.

In this first instance, we choose a window size, whether to use the raw signal or a derived one, as well as
which features/channels to use to predict some or all of the events.

Due to the **unbalanced** nature of the dataset, i.e. there are more 'negative' periods where there is no event taking place
than periods where there is an event occuring ('positive'), we choose to sample all the positive points available and sample
a similar number of negative periods in the data where no events are occuring.

- Alternatively, you could also have another parameter for an 'offset' between windows
(to avoid windows containing considerable overlap), and a parameter for how many windows to sample
leading up to, during and after the positive events.

```python
import scipy.io
import numpy as np
import pandas as pd
import sklearn.tree

def build_timeseries_for_baby(dat, baby_id):
    """
    Builds channel timeseries from given data for a given baby (nans replaced with -1)
    :returns: pandas dataframe with columns time (seconds), and channel readings
    """
    channels_for_baby = np.concatenate(dat['preprocessed'][0][0][0][baby_id][0]['labels'][0][0]).ravel().tolist()
    readings_for_baby = dat['preprocessed'][0][0][0][baby_id][0]['channels'][0]
    df = pd.DataFrame(readings_for_baby, columns=channels_for_baby)
    return df.reset_index().rename(columns={"index": "time_s"})

def compute_window_features(win, compute_differences=True):
    """
    Compute features (mean, SD, min, max, slope) of a given window
    :param win: window to compute features of (np.array)
    :param compute_differences: optional, transform window by computing differences in value per timestep
    """
    if compute_differences:
        win = np.diff(win, n=1, axis=0) # compute the differences in value per timestep
    funcs = [np.mean, np.std, np.min, np.max]
    feats = np.stack([f(win, axis=0) for f in funcs], axis=1) # shape = (len(channels), len(funcs))
    slope = win[-1] - win[0] # len(channels)
    return np.concatenate([feats, slope[:,None]], axis=1)

def build_dataset_for_baby(dat, baby_id, annotate_df, events, channels_to_use, window_size, raw_signal, for_js=False):
    """
    Builds data for training/test/validation of algorithm
    """
    ts = build_timeseries_for_baby(dat, baby_id)
    filtered_ts = ts[channels_to_use]
    baby_annotations = annotate_df[annotate_df["baby_id"] == baby_id].drop(columns=["baby_id"])

    event_labels = np.zeros((filtered_ts.shape[0], len(events)), dtype=bool)
    for i, e in enumerate(events):
        def fill_label(time_tup):
            if time_tup is -1:
                return time_tup
            start, end = time_tup
            event_labels[start:end, i] = True
            return time_tup
        baby_annotations[e].apply(fill_label)

    if for_js:
        # for js visualisation, take all full available
        sampled_indices = list(range(window_size, event_labels.size))
        y = event_labels[window_size:]
    else:
        # sample all positive points, sample same num of negative points
        indices_pos = np.where(event_labels)[0]
        num_pos = indices_pos.size
        indices_neg = np.where(event_labels == False)[0]
        sampled_indices = np.concatenate((indices_pos, np.random.choice(indices_neg, size=num_pos, replace=False)))
        sampled_indices = sampled_indices[sampled_indices > window_size] # filter indices shorter than window
        y = event_labels[sampled_indices]

    if raw_signal:
        num_features = window_size*len(channels_to_use)
    else:
        num_features = len(channels_to_use) * 5 # mean, sd, min, max, slope

    x = np.zeros((y.size, num_features))
    signal = np.zeros((y.size, len(channels_to_use)))
    for i, p in enumerate(sampled_indices):
        window = filtered_ts.values[max(p-window_size, 0):p]
        signal[i] = filtered_ts.values[max(p-window_size, 0)]

        if raw_signal:
            window = np.pad(window, ((window_size - window.shape[0],0),(0,0)))
            x[i] = window.flatten()
        else:
            x[i] = compute_window_features(window).flatten()

    if for_js:
        return {"input": x, "output": y, 'signal': signal}
    return {"input": x, "output": y}

def build_dataset(dat, annotate_df, e_names, channels, window_size=30, raw_signal=False, num_train=11, num_val=2, test_baby_id=None):
    """
    Returns training, test and validation datasets across number of babies specified
    :param channels: list of channels to include as feature, e.g. HR, SO, etc.
    :param window_size: size in which to window the data
    :param raw_signal: bool specifying whether to use the original raw signal windowed or compute features of windows
    :param num_train: number of babies to use to build training data
    :param num_val: number of babies to use to build validation data (left over babies will be test)
    :returns: dict with entries 'input' and 'output' (input data windows and according output ground truth labels)
    """
    babies = np.arange(15)
    np.random.shuffle(babies)

    if test_baby_id:
        babies = np.delete(babies, np.where(babies == test_baby_id))
        test_set = np.append(babies[-num_val:], [test_baby_id])
        print("Train on:{}, Val on:{}, Test on:{}".format(babies[:num_train],
                                                          babies[num_train: num_train + num_val],
                                                          test_set))
    else:
        test_set = babies[-num_val:]

    datasets = {"train": babies[:num_train],
                "val": babies[num_train: num_train + num_val],
                "test": test_set}

    def collect_baby_data(babies):
        da = [build_dataset_for_baby(dat, b_id, annotate_df, e_names, channels, window_size, raw_signal)
                for b_id in babies] # list of dicts

        concatenated_data = {} # concat list into dict
        for key in da[0].keys():
            concatenated_data[key] = np.concatenate([d[key] for d in da], axis=0)
        return concatenated_data

    return {k: collect_baby_data(v) for k, v in datasets.items()}

def per_class_accuracy(mod, dset):
    """
    Calculate the accuracy per class of the given trained model, on given dataset
    :returns: mean accuracy of model on passed data, and predictions array
    """
    pred = mod.predict(dset["input"])
    groundTruth = dset["output"]

    if pred.shape == groundTruth.shape:
        correct = (pred == groundTruth).astype(float)
    else:
        correct = (pred[:,None] == groundTruth).astype(float)
    return correct.mean(axis=0), pred

def train(mod, datasets):
    """
    Training function - fits model to training input, and returns report containing accuracies and
    raw prediction arrays of the train, validation and test splits of passed dataset
    :returns: output dict report of train/val/test accuracies and predictions
    """
    mod = mod.fit(datasets["train"]["input"], datasets["train"]["output"])

    train_acc, train_pred = per_class_accuracy(mod, datasets["train"])
    val_acc, val_pred = per_class_accuracy(mod, datasets["val"])
    test_acc, test_pred = per_class_accuracy(mod, datasets["test"])

    return {"train": {"acc": train_acc, "predictions": train_pred},
            "val": {"acc": val_acc, "predictions": val_pred},
            "test": {"acc": test_acc, "predictions": test_pred}}

#-----------------------------------
# define parameters, features to use and events to predict
wind_size = 30
raw_sig = False
features = [ 'HR', 'SO', 'Incu.Air Temp', 'TP', 'TC']
predict_events = ['BloodSample','Bradycardia','CoreTempProbeDisconnect', 'IncubatorOpen', 'Abnormal']

print("RAW SIGNAL ", raw_sig)
print("WINDOW SIZE ", wind_size)
print("FEATURES ", features)
print("PREDICT EVENTS ", predict_events)
print("\n#-----------------------------------")

#-----------------------------------
# train models on different combinations of the babies since some contain more or few of some events
data_matrix = scipy.io.loadmat("15days.mat")['data']

iterations = 3
reports = {}
for it in range(iterations):
    print("\nITERATION\n---------", it)
    for e in predict_events:
        dataset = build_dataset(data_matrix, annotations_df, [e], features, window_size=wind_size, raw_signal=raw_sig)
        for d, v in dataset.items():
            if v['input'].shape[0] == 0:
                raise Exception("No data found for {} set".format(d))

        model = sklearn.tree.DecisionTreeClassifier()
        rep = train(model, dataset)
        if reports.get(e) is None:
            reports[e] = []
        reports[e].append(rep['test']['acc'])
        print(e, "Acc: Train ", rep['train']['acc'], "Val ", rep['val']['acc'], "Test ", rep['test']['acc'])

print("\n")
for e in predict_events:
    test_acc = np.mean(reports[e], axis=0)
    print("Mean test accuracy for {}: {}".format(e, test_acc))
print("\n#-----------------------------------\n")

#-----------------------------------
# train model for predicting an event and gather predictions for visualisation of one baby
visualise_e = "Bradycardia"
predict_on = 10 # baby id to later predict on

ds = build_dataset(data_matrix, annotations_df, [visualise_e], features, window_size=wind_size, raw_signal=raw_sig, test_baby_id=predict_on)
e_model = sklearn.tree.DecisionTreeClassifier().fit(ds["train"]["input"], ds["train"]["output"])
e_correct, _ = per_class_accuracy(e_model, ds["test"])
print("Accuracy of vis model trained on {}: {}".format(visualise_e, e_correct))

# built dataset for baby to predict on for visualisation
baby_10_dataset = build_dataset_for_baby(data_matrix, predict_on, annotations_df, [visualise_e], features, window_size=wind_size, raw_signal=raw_sig, for_js=True)
accuracy, predictions = per_class_accuracy(e_model, baby_10_dataset)
print("Accuracy of vis model on baby {}: {}".format(predict_on, accuracy))

# arrange into dataframe to extract from js cell
visualise_feature = "HR"
index_feat = features.index(visualise_feature)
js_df = pd.DataFrame({'signal': baby_10_dataset['signal'][:,index_feat],
                      'prediction': predictions.astype(int),
                      'ground': baby_10_dataset['output'].flatten().astype(int)})
```

Above shows the output of a few iterations of training the models on different subset of babies.
Potentially non-surprisingly, the performance of models trained on particular events differ - with events such as
`BloodSample` and `Bradycardia` being the highest, and the event `Abnormal` and `IncubatorOpen` just above random.

These results could likely be improved by investigating the effect of window size, the features included in a model
as well as parameters of the models (such as maximum depth), using the validation set. You will also notice that rerunning the cell with `raw_sig = True` results in around 100% accuracy on the training set
for some events, and much lower scores on the validation and test sets, hence showing that deriving features for a window
reduces overfitting when compared to using the raw signal.

<br>

### Visualisation timeseries of model predictions

The cell above also trains another model on a subset of the babies which makes sure to exclude
a particular baby which we want to test on and visualise. Below we now visualise event predictions
made by this model for this particular baby (`Baby 10`), plotting the ground truth,
prediction as well as the recordings for a given channel, in this case heart rate.
To implement this, we use D3.js.

Since the total timeseries is around 24 hours, we can create a subset of the data to inspect smaller segments.
From looking at `Baby 10`'s earlier plots, there is an interval of Bradycardia around 5300 seconds in,
where the probe is not recorded as disconnected nor any other event other than 'Abnormal' is taking place,
which we can visualise.

```python
# choose a subset of the time period
subset_df = js_df.iloc[5300:5450] # sample of Bradycardia for baby 10
```
```javascript
//global loader.js
loadScript("http://d3js.org/d3.v3.min.js");
```
```javascript
loadInlineStyle(`
.graph .axis {
stroke-width: 1;
}
.graph .axis .tick line {
stroke: black;
}
.graph .axis .tick text {
fill: black;
font-size: 0.7em;
}
.graph .axis .domain {
fill: none;
stroke: black;
}
.graph .group {
fill: none;
stroke: black;
stroke-width: 1.5;
}
`);
```
```javascript
addOutput(function(id) {
  if (document.getElementById(id).innerHTML.length > 0) return;
  document.getElementById(id).innerHTML =
    "<div style='height: 500px; margin: 10px;' class='graph'></div>";

  function unpack(key) {
    return js_df.map(function(row) {
      return row[key];
    });
  }
  let featureRec = unpack("signal");
  let modelP = unpack("prediction");
  let groundTruth = unpack("ground");

  let minRec = Math.min(...featureRec),
    maxRec = Math.max(...featureRec);
  function diffVal(percentage) {
    return (maxRec - minRec) * percentage + minRec;
  }
  for (let i = 0; i < modelP.length; i++) {
    modelP[i] = (1 - modelP[i]) * minRec + modelP[i] * diffVal(0.1);
    groundTruth[i] =
      (1 - groundTruth[i]) * diffVal(0.15) + groundTruth[i] * diffVal(0.25);
  }

  let limit = 60 * 1,
    speed = 200, // speed of sliding window along
    width = 950,
    height = 500;

  let dataIndex = 0; // next point to be rendered
  let groups = {
    raw: {
      value: 0,
      color: "orange",
      data: featureRec,
      buffer: d3.range(limit).map(function() {
        return 0;
      })
    },
    target: {
      value: 0,
      color: "green",
      data: groundTruth,
      buffer: d3.range(limit).map(function() {
        return groundTruth[0];
      })
    },
    prediction: {
      value: 0,
      color: "grey",
      data: modelP,
      buffer: d3.range(limit).map(function() {
        return modelP[0];
      })
    }
  };

  function resetAnim() {
    // reset animation
    for (let i = 0; i < groups.raw.buffer.length; i++) {
      groups.raw.buffer[i] = 0;
      groups.target.buffer[i] = groundTruth[0];
      groups.prediction.buffer[i] = modelP[0];
    }
    dataIndex = 0;
  }

  let x = d3.scale
    .linear()
    .domain([-(limit - 2), -2])
    .range([0, width]);

  let y = d3.scale
    .linear()
    .domain([minRec, maxRec])
    .range([height, 0]);

  let line = d3.svg
    .line()
    .interpolate("basis")
    .x(function(d, i) {
      return x(i - (limit - 1) + dataIndex);
    })
    .y(function(d) {
      return y(d);
    });

  let svg = d3
    .select(".graph")
    .append("svg")
    .attr("class", "chart")
    .attr("width", width)
    .attr("height", height + 50);

  let xAxis = svg
    .append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")
    .call(
      (x.axis = d3.svg
        .axis()
        .scale(x)
        .orient("bottom"))
    );

  let yAxis = svg
    .append("g")
    .attr("class", "y axis")
    .attr("transform", "translate(50, 0)")
    .call(
      (y.axis = d3.svg
        .axis()
        .scale(y)
        .orient("left"))
    );

  svg
    .append("text")
    .attr("class", "x label")
    .attr("text-anchor", "end")
    .attr("x", width)
    .attr("y", height - 6)
    .text("Time (seconds)");

  svg
    .append("text")
    .attr("class", "y label")
    .attr("text-anchor", "end")
    .attr("y", 6)
    .attr("dy", ".75em")
    .attr("transform", "rotate(-90)")
    .text("Raw channel recording");

  let paths = svg.append("g");
  for (let name in groups) {
    let group = groups[name];
    group.path = paths
      .append("path")
      .data([group.buffer])
      .attr("class", name + " group")
      .style("stroke", group.color);
  }

  let yPos = 30;
  for (let name in groups) {
    svg
      .append("text")
      .attr("y", yPos)
      .attr("x", 70)
      .text(name)
      .style("fill", groups[name].color)
      .style("font-size", "16pt");
    yPos += 20;
  }

  function tick() {
    // Remove oldest data point from each group
    for (let name in groups) {
      let group = groups[name];
      group.buffer.shift();
    }
    // Add new values
    for (let name in groups) {
      let group = groups[name];
      group.buffer.push(group.data[dataIndex]);
      group.path.attr("d", line);
    }
    // Shift the domain of x-axis
    let domStart = -(limit - 2) + dataIndex + 1;
    x.domain([domStart, dataIndex - 1]);
    // Slide x-axis left
    xAxis
      .transition()
      .duration(speed)
      .ease("linear")
      .call(x.axis);
    // Slide paths left
    paths
      .attr("transform", null)
      .transition()
      .duration(speed)
      .ease("linear")
      .attr("transform", "translate(" + x(domStart - 1) + ")") // last element on screen that goes out screen
      .each("end", tick);
    dataIndex++;
    // loop back to start if reached end of data
    if (dataIndex === groups.raw.data.length) {
      resetAnim();
    }
  }
  tick();
});
```
In the sequence above, the `target` (ground truth) and (model) `prediction` lines are binary,
each separated vertically from each other in a fixed manner, and jump up by a fixed amount when
an event is occurring or predicted, respectively.

A couple of observations:
* The model predicts a sizeable overlapping period with labelled event (ground truth).
* The model's prediction starts after the labelled event start time and outlasts the labelled event too.
* Additionally, it seems potentially surprising that the start of the interval of Bradycardia is
labelled as soon as around 26 seconds in because the heart rate appears stable and only starts falling
around 55 seconds.
    * Simulatenously visualising the other channels may give an indicator as to why this is the case but
    it would be unexpected given the known association of heart rate with Bradycardia...
    * This poses the question of how accurately the labels have been placed, or more generally,
    what constitutes the label - does it include the precursor the the event as well as the event?
    This, along with the window size will have an impact on the model.
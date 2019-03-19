# Welcome to the Wrattler ptype demo

*ptype* is a helper tool that can identify the types of data values read in
from a text file



```python
import pandas as pd
import numpy as np
import time

import matplotlib.pyplot as plt
plt.rcdefaults()

from ptype.Ptype import Ptype
from ptype.utils import read_dataset, load_object
from ptype import constants

DATA_PATHS = constants.DATA_PATHS
types = {1:'integer', 2:'string', 3:'float', 4:'boolean', 5:'gender', 6:'date-iso-8601', 7:'date-eu', 8:'date-non-std-subtype', 9:'date-non-std'}
ptype = Ptype(_types=types)

# load the broadband dataset
dataset_name = 'broadband'
df = read_dataset(dataset_name, DATA_PATHS)

ptype.set_data(_data_frame=df, _dataset_name=dataset_name)
ptype.run_all_columns()
ptype.show_results()

```

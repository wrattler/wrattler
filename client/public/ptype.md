# Inferring column types using ptype

ptype is a probabilistic type inference method that can robustly annotate
a column of data. It can be used to infer the data type (e.g. Boolean, integer, 
string, date, float, gender, email address, etc.) for each column in a table of 
data, as well as to detect missing data, and anomalies.

In this notebook, we run ptype on a sample dataset recording various information
about broadband quality in the UK. First, we read the sample dataset.

```python
from ptype import constants
from ptype.utils import read_dataset

DATA_PATHS = constants.DATA_PATHS
broadband = read_dataset("broadband", DATA_PATHS)
```

Now we can invoke ptype. To do this, we need to give it a list of (predefined)
types that ptype should consider and the input dataset. We can then print a report
about the data using `show_results`:

```python
from ptype.Ptype import Ptype

df = broadband
types = {1:'integer', 2:'string', 3:'float', 4:'boolean', 5:'gender', 
  6:'date-iso-8601', 7:'date-eu', 8:'date-non-std-subtype', 9:'date-non-std'}
ptype = Ptype(_types=types)
ptype.set_data(_data_frame=df, _dataset_name='broadband')
ptype.run_all_columns()
ptype.show_results()
```
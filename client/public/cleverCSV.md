# Better CSV parsing with CleverCSV

This notebook shows the use of the CleverCSV tool, which is a replacement for the standard
Python `csv` module. In this notebook, we look at one sample case where the sniffer from the
standard python csv module doesn't work well but CleverCSV can correclty infer the structure
of the CSV file.

First, we load a sample CSV file that uses semicolon as a deliminter:

```python
import requests

demo = requests.get("https://raw.githubusercontent.com/grezesf/" + 
  "Research/17b1e829d1d4b8954661270bd8b099e74bb45ce7/Reservoirs/" + 
  "Task0_Replication/code/preprocessing/factors.csv")

print(demo.content.decode("utf-8"))
```

Now, we try parsing the CSV file using the standard Python CSV parser from the `csv` module.
This fails with the `csv.Error` exception:

```python
import csv

content1 = demo.values[0][0]
dialect1 = ""

try:
  dialect1 = csv.Sniffer().sniff(content1)
  print("CSV sniffer detected: delimiter = %r, quotechar = %r" 
    % (dialect1.delimiter, dialect1.quotechar))
except csv.Error:
  print("No result from Python CSV sniffer")
```

Next, we try parsing the CSV file using the CleverCSV parser. Note that the code is exactly the
same - we just need to replace `csv` with `ccsv`!

```python
import ccsv

content2 = demo.values[0][0]
dialect2 = ""

try:
  dialect2 = ccsv.Sniffer().sniff(content2, verbose=True)
  print("CleverCSV detected: delimiter = %r, quotechar = %r" 
    % (dialect2.delimiter, dialect2.quotechar))
except ccsv.Error:
  print("No result from CleverCSV sniffer")
```
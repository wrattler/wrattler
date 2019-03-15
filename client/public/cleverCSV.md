# Welcome to the Wrattler CleverCSV demo
Demonstrating the use of the CleverCSV tool, in particular in cases where the sniffer from the
standard python csv module doesn't work well.


```python

import csv # standard python csv module
import ccsv # CleverCSV
import requests

## get a csv file that uses semicolon as a delimiter

r = requests.get("https://raw.githubusercontent.com/grezesf/Research/17b1e829d1d4b8954661270bd8b099e74bb45ce7/Reservoirs/Task0_Replication/code/preprocessing/factors.csv")
content = r.content.decode("utf-8")

## try the python sniffer
print("\n =============== \n Running Python CSV sniffer \n")
try:
    dialect = csv.Sniffer().sniff(content)
    print("CSV sniffer detected: delimiter = %r, quotechar = %r" % (dialect.delimiter,
    	       	       		 	     	 	            dialect.quotechar))
except csv.Error:
    print("No result from Python CSV sniffer")

## now try the CleverCSV sniffer
print("\n =============== \n Running CleverCSV sniffer \n")
try:
    dialect = ccsv.Sniffer().sniff(content, verbose=True)
    print("CleverCSV detected: delimiter = %r, quotechar = %r" % (dialect.delimiter,
    		                                                  dialect.quotechar))
except ccsv.Error:
    print("No result from CleverCSV sniffer")

```

#!/usr/bin/env python
import sys
import pandas as pd

sys.path.insert(0, '../src/')
from src.Ptype import Ptype

def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)
    sys.stderr.flush()

# Change to 'temp_file.csv' if running on console
OUTPUT_DATA_PATH = tempfile._get_default_tempdir() + "/temp_file.csv"

def main():

  ptype = Ptype()

  while True:
    inputs = sys.stdin.readline() # clean=/app/input.csv,messy=/app/input.csv
    cmd = sys.stdin.readline()    # completions | data
    query = sys.stdin.readline()  # e.g. geo=EU28

    # Load data
    x = inputs.strip().split(',')[0].split("=")[-1]
    out_data = pd.read_csv(x)
    header = out_data.columns.values

    # Get list of queries
    query_list = query.strip().split('/')

    ptype.run_inference(_data_frame=out_data)

    if cmd == "completions\n":
      for h in header:
          temp_column_name = str(h).replace(' ', '')
          print(h + " is " + ptype.predicted_types[temp_column_name] + "\n" + query.strip() + "/" + h + "=" + ptype.predicted_types[temp_column_name])
          # print(h + " is " + predicted_types[temp_column_name] + "\n" + query.strip() + "/" + h + "=" + predicted_types[temp_column_name])
      print("")
      sys.stdout.flush()
    else:

      # Rename header
      out_data.columns = out_data.columns.map(lambda x: x+ '(' + ptype.predicted_types[str(x).replace(' ', '')] + ')')

      out_data.to_csv(OUTPUT_DATA_PATH, index=False)
      print(OUTPUT_DATA_PATH)
      sys.stdout.flush()


if __name__ == "__main__":
    main()

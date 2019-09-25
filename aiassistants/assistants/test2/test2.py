#!/usr/bin/env python
import sys
import pandas as pd

while True:
  inputs = sys.stdin.readline() # clean=/app/input.csv,messy=/app/input.csv
  cmd = sys.stdin.readline()    # completions | data
  query = sys.stdin.readline()  # e.g. geo=EU28

  if cmd == "completions\n":
    print("first completion\npath1")
    print("second completion\npath2")
    print("third completion\npath3")
    print("unit is not NR\nunit=NR")
    print("")
    sys.stdout.flush()
  else:
      
    x = inputs.strip().split(',')[0].split("=")[-1]
#    print(x)
    out_data = pd.read_csv(x)
    
    #Rename header
    out_data.columns = out_data.columns.map(lambda x: x+"(yo)")
#    print(header)
#    out_data.rename()
    
    out_data.to_csv("temp_file.csv")
#    f = open("/app/test.csv","w+")
#    f.write("one,two\n")
#    f.write("1,2\n")
#    f.write("3,4")
#    f.close()
    print("temp_file.csv")
    sys.stdout.flush()
#!/usr/bin/env python
import sys

while True:
  inputs = sys.stdin.readline() # clean=/app/input.csv,messy=/app/input.csv
  cmd = sys.stdin.readline()    # completions | data
  query = sys.stdin.readline()  # geo=EU28

  if cmd == "completions\n":
    print("first completion\n" + query + "/geo=EU28")
    print("second completion\npath2")
    print("third completion\npath3")
    print("")
    sys.stdout.flush()
  else:
    f = open("/app/outputtempfile.csv","w+")
    f.write("one,two\n")
    f.write("1,2\n")
    f.write("3,4")
    f.close()
    print("/app/test.csv")
    sys.stdout.flush()
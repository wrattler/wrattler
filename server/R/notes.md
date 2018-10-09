
To parse R code, use the following:
```
ls("package:base")
```
get a list of symbols exported by all the loaded libraries - ignore these.

```
e <- quote({ n <- 1; m <- n + 1 })
```
Can get array-like access to elements of code fragment:
```
e[1]  e[1][1]
```

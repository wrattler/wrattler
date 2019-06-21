## Wrattler ChangeLog

To be updated every time code is pushed to ***master***.

### v0.3 (June 2019)

* Added jupyterlab support - jupyterlab runs in a docker container and has a wrattler extension enabling it to open files with a .wrattler extension using wrattler-app.js served by the client.
* Added support for python and R services to read files containing e.g. function definitions or import statements using the ```%local <filename>``` or ```%global <filename>``` statements.
* Logic for re-binding modified - will now re-bind when moving to a new cell.
* Added script ```build_release.sh``` to simplify building docker images and pushing to dockerhub.
* Removed F# code and Fable from the client docker image - now uses node base image rather than dotnet. 
* Added `docs` folder with `typedoc` generated Wrattler API documentation

### v0.2 (April 2019)

* Added Racket service.
* Datastore is now python Flask app with support for local storage or Azure blob storage.
* R and Python service can use Apache Arrow format for input and output dataframes.
* Various bugfixes and bits of tidying up.

### v0.1	(April 2019)

Initial working version, with Python, R, Javascript services.


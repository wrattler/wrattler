## Wrattler ChangeLog

To be updated every time code is pushed to ***master***.

### v0.10 (November 2019)
- CSS fixes for running in Jupyterlab
- Better handling of waiting for Wrattler to load
- Protection against NULL dataframes in R service
- Add new R packages to base docker image.


### v0.9(November 2019)
- Enable visualization of the dependency graph.
- Button for fullScreen view of cell outputs
- Fixes to R and python services for loading e.g. function definitions from files when running in Binder.


### v0.8 (November 2019)
- Changes and fixes to enable interactive maps in Wrattler.


### v0.7 (November 2019)
- Bugfixes in client related to adding cells of the same language.
- Enable D3 visualizations.
- Update to logic for getting URLs in Jupyterlab, in order to integrate with Binderhub.


### v0.6 (November 2019)
- Bugfixes for R service (avoid writing NULL dataframes to data store)
- Modifications to structure of python service and datastore (convert both into python packages) in preparation for Binderhub integration.


### v0.5 (September 2019)
- Change base docker image for client.
- Changes to facilitate html output from python and R services.
- Improvements to Jupyterlab experience, in terms of caching results, not forgetting cell outputs when page is reloaded.

### v0.4 (June 2019)
- Improve static source code analysis in Python to detect modified data frames
- Adding more documentation on writing your own plugins and API docs
- Mount `resources` when running Wrattler inside Docker
- Improvements in the Arrow data store handling
- Initial work on adding spinner when evaluating code
- Improve evaluation UI: Shift+Enter now evaluates
- Add caching of /eval requests, so we do not revaluate when hashes match

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

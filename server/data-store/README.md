## data-store for Wrattler

Data store for Wrattler, using ***Flask*** to handle http requests.

To run locally: ```python app.py```
By default it will be accessible at ```localhost:7102```.

The following endpoints are then exposed:

### PUT to /<cell_hash>/<frame_name> with payload being the data you want to store.

### GET to /<cell_hash>/<frame_name> will retrieve the data.

If the header ```Accept``` is set to ```application/json```, the datastore
will attempt to convert the data to JSON format before returning it.

If ```Accept``` is set to ```application/octet-stream```, the datastore will try to convert it to Apache Arrow format.

If it is unset, or set to anything else, the data will be returned as-is.
If the ```?nrow=<N>``` option is appended to the URL for a GET request, only the first *N* rows of data will be returned.

The supported data formats are currently JSON and Apache Arrow FileStreamBuffers.

## Storage backends.

The datastore can use temporary local storage (i.e. the ```/tmp/``` directory of the host it is run on, which is likely a Docker
container) or a cloud-based storage backend, depending on whether the environment variable ```WRATTLER_LOCAL_STORAGE``` is set or not.
(This can be commented or uncommented in ```Dockerfile``` as required.

For cloud-based storage, so far only Azure blob storage has been implemented.  The file ```config.py.template``` should be copied to
```config.py``` and the account name and access key for the storage account should be inserted in the appropriate lines.

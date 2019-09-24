"""
Concrete methods to read and write data from/to the chosen storage backend
"""

import os
import json
import pyarrow as pa

from azure.storage.blob import BlockBlobService

from .utils import filter_data, convert_to_json, convert_to_arrow
from .exceptions import DataStoreException
try:
    from .config import AzureConfig
except:
    print("File config.py not found.  Copy config.py.template and fill in your Azure storage account credentials in order to use Azure blob storage backend.")


class LocalStore(object):
    def __init__(self):
        if os.name == "posix":
            self.dirname = "/tmp/"
        else:
            self.dirname = "%temp%"


    def write(self, data, cell_hash, frame_name):
        """
        store data as a file on local disk
        """
        filename = os.path.join(self.dirname, cell_hash, frame_name)
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        if isinstance(data, pa.lib.Buffer) or isinstance(data, bytes):
            outfile = open(filename,"wb")
        elif isinstance(data, str):
            outfile = open(filename,"w")
        elif isinstance(data, list) or isinstance(data, dict):
            data = json.dumps(data)
            outfile = open(filename,"w")
        else:
            raise DataStoreException("Trying to write unknown data type")
        outfile.write(data)
        outfile.close()
        return True


    def read(self, cell_hash, frame_name):
        """
        retrieve data from local disk
        """
        filename = os.path.join(self.dirname, cell_hash, frame_name)
        if not os.path.exists(filename):
            raise DataStoreException("Trying to read non-existent file")
        try:
            f = open(filename)
            data = f.read()
            f.close()
        except(UnicodeDecodeError):
            f = open(filename,"rb")
            data = f.read()
            f.close()
        return data



class AzureStore(object):
    """
    Interface to Azure blob storage.
    Needs a file config.py containing credentials for Azure storage account.
    """
    def __init__(self):
        self.bbs = BlockBlobService(account_name = AzureConfig.account_name,
                                    account_key = AzureConfig.account_key)
        self.container_name = AzureConfig.container_name


    def write(self, data, cell_hash, frame_name):
        """
        Write a blob to <container_name>/<cell_hash>/<frame_name>
        """
        if isinstance(data, str):
            self.bbs.create_blob_from_text(self.container_name, "{}/{}".format(cell_hash, frame_name), data)
        elif isinstance(data, list) or isinstance(data, dict):  # JSON object - convert to a string
            data = json.dumps(data)
            self.bbs.create_blob_from_text(self.container_name, "{}/{}".format(cell_hash, frame_name), data)
        else:  # assume it's binary data
            self.bbs.create_blob_from_bytes(self.container_name, "{}/{}".format(cell_hash, frame_name), data)
        return True


    def read(self, cell_hash, frame_name):
        """
        Read a blob from blob storage <container_name>/<cell_hash>/<frame_name>
        We don't know if it is json string or binary arrow format, so try getting it as text, and if it doesn't work,
        assume bytes.
        """
        try:
            blob_data = self.bbs.get_blob_to_text(self.container_name,"{}/{}".format(cell_hash, frame_name))
        except(UnicodeDecodeError):
            blob_data = self.bbs.get_blob_to_bytes(self.container_name,"{}/{}".format(cell_hash, frame_name))
        return blob_data.content




class Store(object):
    """
    This is the class of which the app has an instance, and in turn this owns a concrete 'store' which is either
    a backend for local storage, or one for cloud storage.
    """

    def __init__(self, backend):
        if backend == "Local":
            self.store = LocalStore()
        elif backend == "Azure":
            self.store = AzureStore()
        else:
            raise DataStoreException("Missing or Unknown storage backend requested")


    def write(self, data, cell_hash, frame_name):
        """
        Tell the selected backend to write the provided data as-is, to <something>/cell_hash/frame_name
        """
        return self.store.write(data,cell_hash, frame_name)


    def read(self, cell_hash, frame_name, data_format=None, nrow=None):
        """
        Tell the selected backend to read the file, and filter if required.
        """
        data = self.store.read(cell_hash, frame_name)
        if data_format == "application/json":
            data = convert_to_json(data)
        elif data_format == "application/octet-stream":
            data = convert_to_arrow(data)
        if nrow:
            data = filter_data(data, nrow)
        return data

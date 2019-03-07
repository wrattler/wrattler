"""
Concrete methods to read and write data from/to the chosen storage backend
"""

import os
import tempdir
import pyarrow as pa

if "LOCAL_STORAGE" in os.environ.keys():
    BACKEND = "Local"
else:
    BACKEND = "Azure"
    from config import AzureConfig
    from azure.storage.blob import BlockBlobService, PublicAccess


class LocalStore(object):
    def __init__(self):
        if os.name == "posix":
            self.dirname = "/tmp/"
        else:
            self.dirname = "%temp%"


    def write(self, data, frame_hash, frame_name):
        """
        store data as a file on local disk
        """
        filename = os.path.join(self.dirname, frame_hash, frame_name)
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        if isinstance(data, pa.lib.Buffer):
            outfile = open(filename,"wb")
        elif isinstance(data, str):
            outfile = open(filename,"w")
        else:
            raise RuntimeError("Unknown data type")
        outfile.write(data)
        outfile.close()


    def read(self, frame_hash, frame_name, data_format=None):
        """
        retrieve data from local disk
        """
        filename = os.path.join(self.dirname, frame_hash, frame_name)
        if not os.path.exists(filename):
            raise RuntimeError("Non-existent file")
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
    def __init__(self):
        self.bbs = BlockBlobService(account_name = AzureConfig.account_name,
                                    account_key = AzureConfig.account_key)
        self.container_name = AzureConfig.container_name


    def write(self, data, frame_hash, frame_name):
        """
        Write a blob to <container_name>/<frame_hash>/<frame_name>
        """
        if isinstance(data, str):
            self.bbs.create_blob_from_text(self.container_name, "{}/{}".format(frame_hash, frame_name), data)
        else:  ## assume it's binary data
            self.bbs.create_blob_from_bytes(self.container_name, "{}/{}".format(frame_hash, frame_name), data)


    def read(self, frame_hash, frame_name, data_format):
        """
        Read a blob from blob storage
        """
        if data_format == "JSON":
            blob_data = self.bbs.get_blob_to_text(self.container_name,"{}/{}".format(frame_hash, frame_name))
        else:
            # assume bytes
            blob_data = self.bbs.get_blob_to_bytes(self.container_name,"{}/{}".format(frame_hash, frame_name))
        return blob_data.content




class Store(object):
    def __init__(self, backend=BACKEND):
        if backend == "Local":
            self.store = LocalStore()
        elif backend == "Azure":
            self.store = AzureStore()
        else:
            raise RuntimeError("Unknown storage backend requested")

    def write(self, data, frame_hash, frame_name):
        return self.store.write(data,frame_hash, frame_name)

    def read(self, frame_hash, frame_name, data_format=None, rows=None):
        data = self.store.read(frame_hash, frame_name, data_format)
        return data

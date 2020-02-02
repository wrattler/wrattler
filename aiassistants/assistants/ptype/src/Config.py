class Config:
    # helps to store settings for an experiment.
    def __init__(self, _experiments_folder_path='experiments', _dataset_name='dataset', _column_names='unknown',
                 _types={1:'integer', 2:'string', 3:'float', 4:'boolean', 5:'gender', 6:'unknown', 7:'date-iso-8601', 8:'date-eu', 9:'date-non-std-subtype', 10:'date-non-std',
                         11:'positive integer', 12:'positive float'}):

        self.main_experiments_folder = _experiments_folder_path
        self.dataset_name = _dataset_name
        self.column_names = _column_names
        self.types = _types
        self.types_as_list = list(_types.values())

        columns = ['missing', 'catch-all',]
        for key in _types:
            columns.append(_types[key])
        self.columns = columns
# Mainly text manipulation utils
from src.utils import create_folders

# Latex, and visualization utils
from src.utils import print_to_file, save_object

import csv
import numpy as np
import os

from src.Config import Config
from src.Model import PtypeModel
from src.PFSMRunner import PFSMRunner
from scipy.stats import norm

class Ptype:
    avg_racket_time = None

    def __init__(self, _exp_num=0, _types={1:'integer', 2:'string', 3:'float', 4:'boolean', 5:'gender', 6:'date-iso-8601', 7:'date-eu', 8:'date-non-std-subtype', 9:'date-non-std'}, _data_frames=None):
        self.exp_num = _exp_num
        self.types = _types
        self.PFSMRunner = PFSMRunner(list(_types.values()))
        self.model = None
        self.data_frames = _data_frames
        self.all_posteriors = {}
        if _data_frames is not None:
            self.set_data(_data_frame=_data_frames[0])

    def set_data(self, _data_frame, _dataset_name=None, _column_names=None):
        if _dataset_name is None:
            _dataset_name = 'demo'
        _data_frame = _data_frame.rename(columns=lambda n: str(n).replace(' ', ''))

        _data_frame = _data_frame.applymap(str)

        # to refresh the outputs
        self.all_posteriors[_dataset_name] = {}
        self.predicted_types = {}
        self.normal_types = {}
        self.missing_types = {}
        self.anomaly_types = {}
        self.p_z_columns = {}
        self.p_t_columns = {}

        # Check for dataframes without column names
        if _column_names is None:
            _column_names = _data_frame.columns

        # Creates a configuration object for the experiments
        if self.types is None:
            config = Config(_dataset_name=_dataset_name, _column_names=_column_names)
        else:
            config = Config(_dataset_name=_dataset_name, _column_names=_column_names, _types=self.types)

        # Ptype model for inference
        if self.model is None:
            self.model = PtypeModel(config, _data_frame=_data_frame)
        else:
            self.model.set_params(config, _data_frame=_data_frame)

        # Creates a df to report annotations for Wrattler
        self.missing_types = {}
        self.anomaly_types = {}
        self.p_z_columns = {}
        self.p_t_columns = {}
        self.print = False
        self.prediction_path = None
        self.predicted_types = {}

    ###################### MAIN METHODS #######################
    def run_inference_on_model(self, probs, counts):
        if self.print:
            print_to_file('\tinference is running...')
        self.model.run_inference(probs, counts)

    def run_inference(self, _data_frame, _print=False, _prediction_path=None, _save=False):
        """ Runs ptype for each column in a dataframe.
            The outputs are stored in dictionaries (see store_outputs).
            The column types are saved to a csv file.

        :param _data_frame:
        :param _print:
        :param _prediction_path:
        :param _save:

        """

        self.set_data(_data_frame=_data_frame)

        self.print = _print
        self.prediction_path = _prediction_path

        if self.print:
            print_to_file('processing ' + self.model.experiment_config.dataset_name)

        # Normalizing the parameters to make sure they're probabilities
        self.normalize_params()

        # Generates a binary mask matrix to check if a word is supported by a PFSM or not. (this is just to optimize the implementation.)
        self.PFSMRunner.update_values(np.unique(self.model.data.values))

        for i, column_name in enumerate(list(self.model.experiment_config.column_names)):
            # self.setup_a_column(i, column_name)

            # Calculates the probabilities
            probabilities, counts = self.generate_probs_a_column(column_name)

            # Runs inference for a column
            self.run_inference_on_model(probabilities, counts)

            # Stores types, both cols types and rows types
            self.store_outputs(column_name)

        # Export column types, and missing data
        if _save:
            self.write_type_predictions_2_csv(list(self.predicted_types.values()))

    def train_all_models_multiple_dfs(self, runner):
        if self.print:
            print_to_file('\ttraining is running...')
        return self.model.train_all_z_multiple_dfs_new(runner)

    def train_machines_multiple_dfs(self, _labels, _experiment_output_name='demo',_max_iter=20, _prediction_path=None, _print=False,  _test_data=None, _test_labels=None, _uniformly=False):
        """ Train the PFSMs given a set of dataframes and their labels

        :param _labels: column types labeled by hand, where _label[i][j] denotes the type of j^th column in i^th dataframe.
        :param _experiment_output_name:
        :param _max_iter: the maximum number of iterations the optimization algorithm runs as long as it's not converged.
        :param _prediction_path:
        :param _print:
        :param _test_data:
        :param _test_labels:
        :param _uniformly: a binary variable used to initialize the PFSMs - True allows initializing uniformly rather than using hand-crafted values.
        :return:
        """
        self.print = _print
        self.prediction_path = _prediction_path
        self.experiment_output_name = _experiment_output_name

        if _uniformly:
            self.initialize_params_uniformly()

        # Setup folders and probabilities for all columns
        self.normalize_params()

        # Changing column names
        self.data_frames = [data_frame.rename(columns=lambda n: str(n).replace(' ', '')) for data_frame in self.data_frames]
        self.model.data_frames = self.data_frames

        # find the unique values in all of the columns once
        for i, df in enumerate(self.model.data_frames):
            if i == 0:
                unique_vals = np.unique(df.values)
            else:
                unique_vals = np.concatenate((unique_vals, np.unique(df.values)))
        self.model.unique_vals = unique_vals

        self.PFSMRunner.set_unique_values(unique_vals)

        # Finding unique values and their counts
        self.model.dfs_unique_vals_counts = {}
        for i, df in enumerate(self.data_frames):
            df_unique_vals_counts = {}
            for column_name in list(df.columns):
                temp_x, counts = np.unique([str(int_element) for int_element in df[column_name].tolist()], return_counts=True)
                counts = {u_data: c for u_data, c in zip(temp_x, counts)}
                temp_counts = list(counts.values())
                counts_array = np.reshape(temp_counts, newshape=(len(temp_counts),))
                df_unique_vals_counts[column_name] = [temp_x, counts_array]
            self.model.dfs_unique_vals_counts[str(i)] = df_unique_vals_counts

        # Setting
        self.model.labels = _labels
        self.model.types = self.types
        self.model.J = len(self.PFSMRunner.machines)  # J: num of data types including missing and anomaly.
        self.model.K = self.model.J - 2  # K: num of possible column data types (excluding missing and anomaly)
        self.model.pi = [self.model.PI for j in range(self.model.K)]  # mixture weights of row types
        self.model.current_runner = self.PFSMRunner

        training_error = []
        training_error.append(self.calculate_error_df(self.data_frames, _labels))

        save_object(self.PFSMRunner, self.experiment_output_name + '_training_runner_initial.pkl')
        print(training_error)

        # Iterates over whole data points
        for it in range(_max_iter):
            print_to_file('iteration = ' + str(it), filename=self.experiment_output_name + '_output.txt')

            # Trains machines using all of the training data frames
            self.PFSMRunner = self.train_all_models_multiple_dfs(self.PFSMRunner)
            self.model.current_runner = self.PFSMRunner

            # Calculate training and validation error at each iteration
            training_error.append(self.calculate_error_df(self.data_frames, _labels))
            print(training_error)

            save_object(self.PFSMRunner, self.experiment_output_name + '_training_runner' + str(it) + '.pkl')
            if it > 0:
                if (training_error[-2] - training_error[-1] < 1e-4):
                    print_to_file('converged!', filename=self.experiment_output_name + '_output.txt')
                    break

        save_object(training_error, self.experiment_output_name + '_training_error.pkl')



    def train_machines_multiple_dfs_new(self, _labels, _experiment_output_name='demo',_max_iter=20, _prediction_path=None, _print=False,  _test_data=None, _test_labels=None, _uniformly=False):
        """ Train the PFSMs given a set of dataframes and their labels

        :param _labels: column types labeled by hand, where _label[i][j] denotes the type of j^th column in i^th dataframe.
        :param _experiment_output_name:
        :param _max_iter: the maximum number of iterations the optimization algorithm runs as long as it's not converged.
        :param _prediction_path:
        :param _print:
        :param _test_data:
        :param _test_labels:
        :param _uniformly: a binary variable used to initialize the PFSMs - True allows initializing uniformly rather than using hand-crafted values.
        :return:
        """
        self.print = _print
        self.prediction_path = _prediction_path
        self.experiment_output_name = _experiment_output_name

        if _uniformly:
            self.initialize_params_uniformly()

        # Setup folders and probabilities for all columns
        self.normalize_params()

        # Changing column names
        self.data_frames = [data_frame.rename(columns=lambda n: str(n).replace(' ', '')) for data_frame in self.data_frames]
        self.model.data_frames = self.data_frames

        # find the unique values in all of the columns once
        for i, df in enumerate(self.model.data_frames):
            if i == 0:
                unique_vals = np.unique(df.values)
            else:
                unique_vals = np.concatenate((unique_vals, np.unique(df.values)))
        self.model.unique_vals = unique_vals

        self.PFSMRunner.set_unique_values(unique_vals)

        # Finding unique values and their counts
        self.model.dfs_unique_vals_counts = {}
        for i, df in enumerate(self.data_frames):
            df_unique_vals_counts = {}
            for column_name in list(df.columns):
                temp_x, counts = np.unique([str(int_element) for int_element in df[column_name].tolist()], return_counts=True)
                counts = {u_data: c for u_data, c in zip(temp_x, counts)}
                temp_counts = list(counts.values())
                counts_array = np.reshape(temp_counts, newshape=(len(temp_counts),))
                df_unique_vals_counts[column_name] = [temp_x, counts_array]
            self.model.dfs_unique_vals_counts[str(i)] = df_unique_vals_counts

        # Setting
        self.model.labels = _labels
        self.model.types = self.types
        self.model.J = len(self.PFSMRunner.machines)  # J: num of data types including missing and anomaly.
        self.model.K = self.model.J - 2  # K: num of possible column data types (excluding missing and anomaly)
        self.model.pi = [self.model.PI for j in range(self.model.K)]  # mixture weights of row types
        self.model.current_runner = self.PFSMRunner

        training_error = []
        training_error.append(self.calculate_error_df(self.data_frames, _labels))

        save_object(self.PFSMRunner, self.experiment_output_name + '_training_runner_initial.pkl')
        print(training_error)

        # Iterates over whole data points
        for it in range(_max_iter):
            print_to_file('iteration = ' + str(it), filename=self.experiment_output_name + '_output.txt')

            # Trains machines using all of the training data frames
            self.PFSMRunner = self.train_all_models_multiple_dfs(self.PFSMRunner)
            self.model.current_runner = self.PFSMRunner

            # Calculate training and validation error at each iteration
            training_error.append(self.calculate_error_df(self.data_frames, _labels))
            print(training_error)

            if it > 0:
                if (training_error[-2] - training_error[-1] < 1e-2):
                    print_to_file('converged!', filename=self.experiment_output_name + '_output.txt')
                    save_object(self.PFSMRunner, self.experiment_output_name + '_training_runner' + str(it) + '.pkl')
                    break

            save_object(self.PFSMRunner, self.experiment_output_name + '_training_runner' + str(it) + '.pkl')
        save_object(training_error, self.experiment_output_name + '_training_error.pkl')


    ####################### OUTPUT METHODS #########################
    def show_results_df(self,):
        df_output = self.model.data.copy()
        df_output.columns = df_output.columns.map(lambda x: x + '(' + self.predicted_types[str(x).replace(' ', '')] + ')')
        return df_output

    def show_results(self, cols=None):
        if cols is None:
            cols = self.predicted_types

        for col in cols:
            print('col: ' + col)
            print('\tpredicted type: ' + self.predicted_types[col])
            print('\tposterior probs: ', self.all_posteriors[self.model.experiment_config.dataset_name][col])
            print('\ttypes: ', list(self.types.values()), '\n')

            unique_vals, unique_vals_counts = np.unique([str(int_element) for int_element in self.model.data[col].tolist()], return_counts=True)
            indices = self.normal_types[col]
            if len(indices) == 0:
                count_normal = 0
                pass
            else:
                some_normal_data_values = [unique_vals[ind] for ind in indices][:20]
                some_normal_data_values_counts = [unique_vals_counts[ind] for ind in indices][:20]
                count_normal = sum(unique_vals_counts[indices])

            if len(self.missing_types[col]) == 0:
                count_missing = 0
                pass
            else:
                indices = self.missing_types[col]
                missing_values = [unique_vals[ind] for ind in indices][:20]
                missing_values_counts = [unique_vals_counts[ind] for ind in indices][:20]
                count_missing = sum(unique_vals_counts[indices])

            if len(self.anomaly_types[col]) == 0:
                count_anomalies = 0
                pass
            else:
                indices = self.anomaly_types[col]
                anomalies = [unique_vals[ind] for ind in indices]
                anomalies_counts = [unique_vals_counts[ind] for ind in indices]
                count_anomalies = sum(unique_vals_counts[indices])

            if self.normal_types[col] != []:
                print('\tsome normal data values: ', some_normal_data_values)
                print('\ttheir counts: ', some_normal_data_values_counts)
                print('\tfraction of normal:', round(count_normal / (count_normal + count_missing + count_anomalies), 2),  '\n')

            if self.missing_types[col] != []:
                print('\tmissing values:', missing_values)
                print('\ttheir counts: ', missing_values_counts)
                print('\tfraction of missing:', round(count_missing / (count_normal + count_missing + count_anomalies), 2),  '\n')

            if self.anomaly_types[col] != []:
                print('\tanomalies:', anomalies)
                print('\ttheir counts:', anomalies_counts)
                print('\tfraction of anomalies:', round(count_anomalies / (count_normal + count_missing + count_anomalies), 2),  '\n')



    def detect_missing_anomalies(self, inferred_column_type):

        normals, missings, anomalies = [], [], []
        if inferred_column_type != 'all identical':
            row_posteriors = self.model.p_z[:, np.argmax(self.model.p_t), :]
            max_row_posterior_indices = np.argmax(row_posteriors, axis=1)

            normals = list(np.where(max_row_posterior_indices==self.model.TYPE_INDEX)[0])
            missings = list(np.where(max_row_posterior_indices==self.model.MISSING_INDEX)[0])
            anomalies = list(np.where(max_row_posterior_indices==self.model.ANOMALIES_INDEX)[0])

        return [normals, missings, anomalies]

    def store_outputs(self, column_name):
        """ First stores the posterior distribution of the column type, and the predicted column type.
            Secondly, it stores the indices of the rows categorized according to the row types.

        :param column_name:
        """

        self.all_posteriors[self.model.experiment_config.dataset_name][column_name] = self.model.p_t

        # In case of a posterior vector whose entries are equal
        if len(set([i for i in self.model.p_t])) == 1:
            inferred_column_type = 'all identical'
        else:
            inferred_column_type = self.model.experiment_config.types_as_list[np.argmax(self.model.p_t)]
        self.predicted_types[column_name] = inferred_column_type

        # Indices for the unique values
        [normals, missings, anomalies] = self.detect_missing_anomalies(inferred_column_type)
        self.normal_types[column_name] = normals
        self.missing_types[column_name] = missings
        self.anomaly_types[column_name] = anomalies
        self.p_z_columns[column_name] = self.model.p_z[:, np.argmax(self.model.p_t), :]
        self.p_t_columns[column_name] = self.model.p_t

    def save_posteriors(self, filename='all_posteriors.pkl'):
        save_object(self.all_posteriors, filename)

    def write_type_predictions_2_csv(self, column_type_predictions):
        # Creates a csv file to write the predictions if no filename is given
        if self.prediction_path is None:
            with open(self.model.experiment_config.main_experiments_folder + '/type_predictions/' + self.model.experiment_config.dataset_name + '/type_predictions.csv', 'w') as f:
                writer = csv.writer(f)
                writer.writerow(['Column', 'F#', 'messytables', 'ptype', 'readr', 'Trifacta', 'hypoparsr'])
                for column_name, column_type_prediction in zip(self.model.experiment_config.column_names, column_type_predictions):
                    writer.writerow([column_name, '', '', column_type_prediction, '', '', ''])
        else:
            # Updates the file if a file already exists
            temp_path = self.prediction_path + self.model.experiment_config.dataset_name + '.csv'
            if os.path.exists(temp_path):
                updated_predictions = []
                with open(temp_path, 'r') as f:
                    reader = csv.reader(f)
                    for i, row in enumerate(reader):
                        if i == 0:
                            updated_predictions.append(row)
                        else:
                            new_row = row
                            new_row[3] = column_type_predictions[i-1]
                            updated_predictions.append(new_row)
                with open(temp_path, 'w') as f:
                    writer = csv.writer(f)
                    for row in updated_predictions:
                        writer.writerow(row)
            else:
                # Creates a new file with the given path
                with open(temp_path, 'w') as f:
                    writer = csv.writer(f)
                    writer.writerow(['Column', 'F#', 'messytables', 'ptype', 'readr', 'Trifacta', 'hypoparsr'])
                    for column_name, column_type_prediction in zip(self.model.experiment_config.column_names,
                                                                   column_type_predictions):
                        writer.writerow([column_name, '', '', column_type_prediction, '', '', ''])

    ####################### HELPERS #########################
    def setup_a_column(self, i, column_name):
        if self.print:
            print_to_file('column # ' + str(i) + ' ' + column_name)

        # Sets parameters for folders of each column
        self.model.experiment_config.current_column = i
        self.model.experiment_config.current_column_name = column_name.replace(" ", "")
        self.model.experiment_config.current_experiment_folder = self.model.experiment_config.main_experiments_folder + '/' + self.model.experiment_config.dataset_name + '/' + self.model.experiment_config.current_column_name

        # Removes existing folders accordingly
        if i == 0:
            _start_over_report = True
        else:
            _start_over_report = False

        create_folders(self.model, _start_over_report)

    def initialize_params_uniformly(self):
        LOG_EPS = -1e150

        # make uniform
        machines = self.PFSMRunner.machines
        for i, machine in enumerate(machines):

            # discards missing and anomaly types
            if i >= 2:
                # make uniform
                machine.I = {a: np.log(.5) if machine.I[a] != LOG_EPS else LOG_EPS for a in machine.I}
                machine.I_z = {a: np.log(.5) if machine.I[a] != LOG_EPS else LOG_EPS for a in machine.I}

                for a in machine.T:
                    for b in machine.T[a]:
                        for c in machine.T[a][b]:
                            machine.T[a][b][c] = np.log(.5)
                            machine.T_z[a][b][c] = np.log(.5)

                machine.F = {a: np.log(.5) if machine.F[a] != LOG_EPS else LOG_EPS for a in machine.F}
                machine.F_z = {a: np.log(.5) if machine.F[a] != LOG_EPS else LOG_EPS for a in machine.F}

        self.PFSMRunner.machines = machines

    def initialize_params_randomly(self):
        LOG_EPS = -1e150

        # make uniform
        machines = self.PFSMRunner.machines
        for i, machine in enumerate(machines):

            # discards missing and anomaly types
            if i >= 2:
                # make uniform
                # machine.I = {a: np.log(np.random.uniform(0.,1.)) if machine.I[a] != LOG_EPS else LOG_EPS for a in machine.I}
                machine.I_z = {a: np.log(np.random.uniform(0., 1.)) if machine.I[a] != LOG_EPS else LOG_EPS for a in machine.I}

                for a in machine.T:
                    for b in machine.T[a]:
                        for c in machine.T[a][b]:
                            machine.T_z[a][b][c] = np.log(np.random.uniform(0.,1.))

                machine.F_z = {a: np.log(np.random.uniform(0.,1.)) if machine.F[a] != LOG_EPS else LOG_EPS for a in machine.F}

        self.PFSMRunner.machines = machines

    def generate_probs_a_column(self, column_name):
        """ Generates probabilities for the unique data values in a column.

        :param column_name: name of a column
        :return probabilities: a IxJ sized np array, where probabilities[i][j] denotes the probability generated for i^th unique value by the j^th PFSM.
                counts: a I sized np array, where counts[i] denotes the number of times i^th unique value is observed in a column.

        """
        unique_values_in_a_column, counts = np.unique([str(int_element) for int_element in self.model.data[column_name].tolist()], return_counts=True)
        probabilities_dict = self.PFSMRunner.generate_machine_probabilities(unique_values_in_a_column)
        probabilities = np.array([probabilities_dict[str(x_i)] for x_i in unique_values_in_a_column])

        return probabilities, counts

    def normalize_params(self):
        for i, machine in enumerate(self.PFSMRunner.machines):
            if i not in [0,1]:
                self.PFSMRunner.machines[i].I = self.model.normalize_initial(machine.I_z)
                self.PFSMRunner.machines[i].F, self.PFSMRunner.machines[i].T = self.model.normalize_final(machine.F_z, machine.T_z)


    def calculate_error_df(self, dfs, labelss):
        # find the unique values in all of the columns once
        for i, df in enumerate(dfs):
            if i == 0:
                unique_vals = np.unique(df.values)
            else:
                unique_vals = np.concatenate((unique_vals, np.unique(df.values)))
        self.model.all_probs = self.PFSMRunner.generate_machine_probabilities(unique_vals)

        error = 0.

        for j, (df, labels) in enumerate(zip(dfs, labelss)):
            for i, column_name in enumerate(list(df.columns)):
                temp = self.model.f_col(str(j), column_name, labels[i] - 1)
                error += temp

                print(j, column_name, temp)

        return error

    def get_categorical_signal_gaussian(self, x, _print=False, sigma=1, threshold=0.03):
        N = len(x)
        K = len(np.unique(x))

        if _print:
            print(N, K, np.log(N))

        return [norm(np.log(N), np.log(N) / 2 * sigma).pdf(K) > threshold, np.log(N), K]

    def remove_missing_and_anomalies(self, x, col_name):
        y = np.unique([str(int_element) for int_element in x.tolist()])
        entries_to_discard = self.missing_types[col_name] + self.anomaly_types[col_name]
        normal_entries = list(set(range(len(y)))-set(entries_to_discard))
        normal_data_values = y[normal_entries]

        return x.loc[x.isin(normal_data_values)]

    def get_unnormal_data_indices(self, x, y, col_name, mode=True):
        if mode:
            indices_in_unique = self.missing_types[col_name]
        else:
            indices_in_unique = self.anomaly_types[col_name]
        unnormal_data_values = [y[ind] for ind in indices_in_unique]

        return x.index[x.isin(unnormal_data_values)].tolist()

    def get_missing_data_predictions(self, cols=None):
        missing_data_predictions = {}
        if cols is None:
            cols = self.model.data.columns

        for col in cols:
            unique_vals = np.unique([str(int_element) for int_element in self.model.data[col].tolist()])

            if len(self.missing_types[col]) == 0:
                missing_data_predictions[col] = []
            else:
                indices = self.missing_types[col]
                missing_data_predictions[col] = [unique_vals[ind] for ind in indices]

        return missing_data_predictions

    def get_anomaly_predictions(self, cols=None):
        anomaly_predictions = {}
        if cols is None:
            cols = self.model.data.columns

        for col in cols:
            unique_vals = np.unique([str(int_element) for int_element in self.model.data[col].tolist()])

            if len(self.anomaly_types[col]) == 0:
                anomaly_predictions[col] = []
            else:
                indices = self.anomaly_types[col]
                anomaly_predictions[col] = [unique_vals[ind] for ind in indices]

        return anomaly_predictions

    def get_columns_with_type(self, _type):
        return [column_name for column_name in self.predicted_types.keys() if (self.predicted_types[column_name] == _type)]

    def get_columns_with_missing(self,):
        column_names = [column_name for column_name in self.predicted_types.keys() if (self.missing_types[column_name] != [])]
        print('# columns with missing data:', len(column_names), '\n')
        return column_names


    def get_columns_with_anomalies(self,):
        column_names = [column_name for column_name in self.predicted_types.keys() if (self.anomaly_types[column_name] != [])]
        print('# columns with anomalies:', len(column_names), '\n')
        return column_names

    def get_empty_columns(self,):
        column_names = [column_name for column_name in self.predicted_types.keys() if (self.normal_types[column_name] == [])]
        print('# empty columns:', len(column_names), '\n')
        return column_names

    def change_column_type_annotations(self, _column_names, _new_column_types):

        for column_name, new_column_type in zip(_column_names, _new_column_types):
            print('The column type of ' + column_name + ' is changed from ' + self.predicted_types[column_name] + ' to ' + new_column_type)
            self.predicted_types[column_name] = new_column_type

    def change_missing_data_annotations(self, _column_name, _missing_data):
        unique_vals = np.unique([str(int_element) for int_element in self.model.data[_column_name].tolist()])
        missing_indices = [np.where(unique_vals == missing_d)[0][0] for missing_d in _missing_data]

        # add those entries to normal_types
        self.normal_types[_column_name] = list(set(self.normal_types[_column_name]).union(set(missing_indices)))

        # remove those entries from missing_types
        self.missing_types[_column_name] = list(set(self.missing_types[_column_name]) - set(missing_indices))

    def change_anomaly_annotations(self, _column_name, anomalies):
        unique_vals = np.unique([str(int_element) for int_element in self.model.data[_column_name].tolist()])
        anomaly_indices = [np.where(unique_vals==anomaly)[0][0] for anomaly in anomalies]

        # add those entries to normal_types
        self.normal_types[_column_name] = list(set(self.normal_types[_column_name]).union(set(anomaly_indices)))

        # remove those entries from missing_types
        self.anomaly_types[_column_name] = list(set(self.anomaly_types[_column_name]) - set(anomaly_indices))

    def merge_missing_data(self, _column_name, _missing_data):
        unique_vals = np.unique([str(int_element) for int_element in self.model.data[_column_name].tolist()])
        missing_indices = self.missing_types[_column_name]

        for missing_index in missing_indices:
            self.model.data = self.model.data.replace({_column_name: unique_vals[missing_index]}, _missing_data)

        self.run_inference(_data_frame=self.model.data)


    def get_categorical_columns(self,):
        cats = {}
        for col_name in self.model.data.columns:
            x = self.model.data[col_name]

            x = self.remove_missing_and_anomalies(x, col_name)

            # just dropping certain values
            for encoding in ['NULL', 'null', 'Null', '#NA', '#N/A', 'NA', 'NA ', ' NA', 'N A', 'N/A', 'N/ A', 'N /A', 'N/A',
                             'na', ' na', 'na ', 'n a', 'n/a', 'N/O', 'NAN', 'NaN', 'nan', '-NaN', '-nan', '-', '!', '?', '*', '.']:
                x = x.apply(lambda y: str(y).replace(encoding, ''))

            x = x.replace('', np.nan)
            x = x.dropna()
            x = list(x.values)

            res = self.get_categorical_signal_gaussian(x)
            if res[0]:
                cats[col_name] = [res[1], res[2]]

        self.cats = cats
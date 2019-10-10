from src.utils import normalize_log_probs, log_weighted_sum_probs, log_weighted_sum_probs_check, print_to_file, log_weighted_sum_normalize_probs
from scipy import optimize
from src.Config import Config
import numpy as np
import time
import sys
from scipy.stats import norm

Inf = np.Inf

def vecnorm(x, ord=2):
    if ord == Inf:
        return np.amax(np.abs(x))
    elif ord == -Inf:
        return np.amin(np.abs(x))
    else:
        return np.sum(np.abs(x)**ord, axis=0)**(1.0 / ord)

LOG_EPS = -1e150

class PtypeModel:
    TYPE_INDEX = 0
    MISSING_INDEX = 1
    ANOMALIES_INDEX = 2
    LLHOOD_TYPE_START_INDEX = 2

    def __init__(self, _experiment_config, _data_frame=None, _PI=[0.98, 0.01, 0.01]):
        self.experiment_config = _experiment_config
        self.data = _data_frame
        self.PI = _PI  # weight of pi variable
        self.F_training = []
        self.F_validation = []
        self.data_frames = None
        self.labels = None
        self.types = None

    ###################### MAIN METHODS #######################
    def run_inference(self, logP, counts):
        sys.stdout.flush()
        # Constants
        I, J = logP.shape               # I: num of rows in a data column.
                                        # J: num of data types including missing and catch-all
        K = J - 2                       # K: num of possible column data types (excluding missing and catch-all)

        # Initializations
        pi = [self.PI for j in range(K)]          # mixture weights of row types

        # Inference
        p_t = []                        # p_t: posterior probability distribution of column types
        p_z = np.zeros((I,K,3))         # p_z: posterior probability distribution of row types


        counts_array = np.reshape(counts, newshape=(len(counts),))

        # Iterates for each possible column type
        for j in range(K):

            # Sum of weighted likelihoods (log-domain)
            p_t.append((counts_array * log_weighted_sum_probs(pi[j][0], logP[:,j+self.LLHOOD_TYPE_START_INDEX],
                                                              pi[j][1], logP[:,self.MISSING_INDEX-1],
                                                              pi[j][2], logP[:, self.ANOMALIES_INDEX - 1])).sum())

            # Calculates posterior cell probabilities

            # p_z[:, j, self.TYPE_INDEX] = np.log() +
            # p_z[:, j, self.MISSING_INDEX] = np.log(pi[j][1]) + logP[:,self.MISSING_INDEX-1]
            # p_z[:, j, self.ANOMALIES_INDEX] = np.log(pi[j][2]) + logP[:, self.ANOMALIES_INDEX - 1]

            # Normalizes
            x1, x2, x3, log_mx, sm = log_weighted_sum_normalize_probs(pi[j][0], logP[:,j+self.LLHOOD_TYPE_START_INDEX], pi[j][1], logP[:,self.MISSING_INDEX-1], pi[j][2], logP[:, self.ANOMALIES_INDEX - 1])

            p_z[:, j, 0] = np.exp(x1 - log_mx - np.log(sm))
            p_z[:, j, 1] = np.exp(x2 - log_mx - np.log(sm))
            p_z[:, j, 2] = np.exp(x3 - log_mx - np.log(sm))
            p_z[:,j,:] = p_z[:,j,:]/p_z[:,j,:].sum(axis=1)[:, np.newaxis]

        self.p_t = normalize_log_probs(np.reshape(p_t, newshape=(len(p_t),)))
        self.p_z = p_z

    def calculate_likelihoods(self, logP, counts):
        sys.stdout.flush()
        # Constants
        I, J = logP.shape               # I: num of rows in a data column.
                                        # J: num of data types including missing and catch-all
        K = J - 2                       # K: num of possible column data types (excluding missing and catch-all)

        # Initializations
        pi = [self.PI for j in range(K)]          # mixture weights of row types

        # Inference
        p_t = []                        # p_t: posterior probability distribution of column types
        p_z = np.zeros((I,K,3))         # p_z: posterior probability distribution of row types


        counts_array = np.reshape(counts, newshape=(len(counts),))

        # Iterates for each possible column type
        for j in range(K):

            # Sum of weighted likelihoods (log-domain)
            p_t.append((counts_array * log_weighted_sum_probs(pi[j][0], logP[:,j+self.LLHOOD_TYPE_START_INDEX],
                                                              pi[j][1], logP[:,self.MISSING_INDEX-1],
                                                              pi[j][2], logP[:, self.ANOMALIES_INDEX - 1])).sum())
        self.p_t = np.array(p_t)

    def train_all_z_multiple_dfs(self, runner):
        sys.stdout.flush()

        # Initializations
        self.J = len(runner.machines)                # J: num of data types including missing and anomaly.
        self.K = self.J - 2                          # K: num of possible column data types (excluding missing and anomaly)
        self.pi = [self.PI for j in range(self.K)]   # mixture weights of row types

        self.current_runner = runner

        w_j_z = self.get_all_parameters_z(runner)

        # Find new values using Conjugate Gradient method
        res = optimize.minimize(self.f_cols, w_j_z, jac=self.g_cols, method='CG', options={'disp':True, })
        if res.success:
            runner, temp = self.set_all_probabilities_z(runner, res.x, normalize=True)
        else:
            runner, temp = self.set_all_probabilities_z(runner, res.x, normalize=True)

        return runner


    def train_all_z_multiple_dfs_new(self, runner):
        sys.stdout.flush()

        # Initializations
        self.J = len(runner.machines)                # J: num of data types including missing and anomaly.
        self.K = self.J - 2                          # K: num of possible column data types (excluding missing and anomaly)
        self.pi = [self.PI for j in range(self.K)]   # mixture weights of row types

        self.current_runner = runner

        w_j_z = self.get_all_parameters_z(runner)

        # Find new values using Conjugate Gradient method
        w_j_z, j = self.conjugate_gradient(w_j_z)

        runner, temp = self.set_all_probabilities_z(runner, w_j_z, normalize=True)

        return runner

    def conjugate_gradient(self, w, J=10, gtol=1e-5):
        d, g = [], []

        gnorm = gtol + 1
        j = 0
        while (gnorm > gtol) and (j < J):
            if j == 0:
                g.append(self.g_cols(w))
                d.append(-g[j])

            res = optimize.line_search(self.f_cols, self.g_cols, w, d[j], g[j], self.f_cols(w))
            if res[0] is None:
                return w,j
            else:
                alpha = res[0]
                w = w + alpha * d[j]

                g.append(self.g_cols(w))
                gnorm = vecnorm(g[j + 1], ord=np.Inf)

                beta_j = max(0, np.dot(g[j + 1].T, g[j + 1] - g[j]) / np.dot(g[j], g[j]))  # eq. 7.74 Polak-Ribiere
                d.append(-g[j + 1] + beta_j * d[j])  # eq.7.67

                j += 1

        return w, j


    def f_col(self, i_, column_name, y_i,):
        [temp_x, counts_array] = self.dfs_unique_vals_counts[i_][column_name]
        logP = np.array([self.all_probs[str(x_i)] for x_i in temp_x])
        q = []
        for k in range(self.K):
            q.append((counts_array * log_weighted_sum_probs(self.pi[k][0], logP[:, k + self.LLHOOD_TYPE_START_INDEX],
                                                            self.pi[k][1], logP[:, self.MISSING_INDEX - 1],
                                                            self.pi[k][2], logP[:, self.ANOMALIES_INDEX - 1])).sum())
        temp = normalize_log_probs(q)[y_i]
        if temp == 0:
            error = +800./len(counts_array)
        else:
            error = - np.log(temp)/len(counts_array)

        # result_dict[process_id] = error
        return error

    def f_cols(self, w_j_z):
        # f: the objective function to minimize. (it is equal to - \sum_{all columns} log p(t=k|X) where k is the correct column type.)
        # print_to_file('f_cols is called')
        time_init = time.time()

        # Set params: init-transition-final
        runner, temp_w_j_z = self.set_all_probabilities_z(self.current_runner, w_j_z)

        # Generate probabilities
        self.all_probs = runner.generate_machine_probabilities(self.unique_vals)

        error = 0.
        for i, (data_frame, labels) in enumerate(zip(self.data_frames, self.labels)):
            for j, column_name in enumerate(list(data_frame.columns)):
                error += self.f_col(str(i), column_name, labels[j] - 1)
        # print_to_file(str(time.time() - time_init))
        # print(error)
        return error

    def dp_dz(self, zs):
        temp = np.exp(zs)
        return (temp * sum(temp) - temp * temp)/(sum(temp)**2)

    def g_col(self, runner, i_, column_name, y_i):
        [temp_x, counts_array] = self.dfs_unique_vals_counts[i_][column_name]
        logP = np.array([self.all_probs[str(x_i)] for x_i in temp_x])

        set_chars = np.unique(sum([list(str(x_i)) for x_i in temp_x], []))

        # calculates posterior values of types
        q = []
        for k in range(self.K):
            q.append((counts_array * log_weighted_sum_probs(self.pi[k][0], logP[:, k + self.LLHOOD_TYPE_START_INDEX],
                                                            self.pi[k][1], logP[:, self.MISSING_INDEX - 1],
                                                            self.pi[k][2], logP[:, self.ANOMALIES_INDEX - 1])).sum())

        # calculates the gradients for initial, transition, and final probabilities. (note that it is only for non-zero probabilities at the moment.)
        g_j = []
        for t in list(self.experiment_config.types.keys()):
            t -= 1
            x_i_indices = np.where(logP[:, t + 2] != LOG_EPS)[0]
            possible_states = [state for state in runner.machines[2 + t].states if runner.machines[2 + t].I[state] != LOG_EPS]
            A = log_weighted_sum_probs(self.pi[t][0], logP[:, t + self.LLHOOD_TYPE_START_INDEX],
                                       self.pi[t][1], logP[:, self.MISSING_INDEX - 1],
                                       self.pi[t][2], logP[:, self.ANOMALIES_INDEX - 1])
            temp_gra = np.exp(self.pi[t][0] + logP[:, t + 2] - A)

            temp_g_j = []
            for state in possible_states:
                temp_g_j.append(self.gradient_initial_optimized_new(runner, state, t, temp_x[x_i_indices], q, temp_gra[x_i_indices], counts_array[x_i_indices], y_i))
            g_j = g_j + temp_g_j

            for a in runner.machines[2 + t].T:
                temp_g_j = []
                for b in runner.machines[2 + t].T[a]:
                    if str(b) not in set_chars:
                        temp_g_j = temp_g_j + [0 for i in range(len(runner.machines[2 + t].T[a][b].keys()))]
                    else:
                        for c in runner.machines[2 + t].T[a][b]:
                            temp_g_j.append(self.gradient_transition_optimized_new(runner, a, b, c, t, q, temp_x[x_i_indices], y_i, temp_gra[x_i_indices], counts_array[x_i_indices]))
                        # cs_temp = [runner.machines[2 + t].calculate_gradient_abc_new_optimized(str(x_i), b) for x_i in temp_x]
                        # cs_temp = np.reshape(cs_temp, newshape=(len(cs_temp),))
                        # temp_mult = (temp_gra * cs_temp * counts_array).sum()
                        # for c in runner.machines[2 + t].T[a][b]:
                        #     temp_g_j.append(self.gradient_transition_optimized_new(runner, a, b, c, t, q, temp_mult, y_i))
                g_j = g_j + temp_g_j

            for state in runner.machines[2 + t].F:
                if runner.machines[2 + t].F[state] != LOG_EPS:

                    g_j.append(self.gradient_final_optimized_new(runner, state, t, temp_x[x_i_indices], q, temp_gra[x_i_indices], counts_array[x_i_indices], y_i))

        # result_dict[process_id] = -np.reshape(g_j, newshape=(len(g_j),))
        # print('g', -np.reshape(g_j, newshape=(len(g_j),))/counts_array.sum())
        return -np.reshape(g_j, newshape=(len(g_j),))/counts_array.sum()

    def g_col_marginals(self, runner, i_, column_name, y_i):
        [temp_x, counts_array] = self.dfs_unique_vals_counts[i_][column_name]
        logP = np.array([self.all_probs[str(x_i)] for x_i in temp_x])

        # set_chars = np.unique(sum([list(str(x_i)) for x_i in temp_x], []))

        # calculates posterior values of types
        r = []
        for k in range(self.K):
            r.append((counts_array * log_weighted_sum_probs(self.pi[k][0], logP[:, k + self.LLHOOD_TYPE_START_INDEX],
                                                            self.pi[k][1], logP[:, self.MISSING_INDEX - 1],
                                                            self.pi[k][2], logP[:, self.ANOMALIES_INDEX - 1])).sum())

        # calculates the gradients for initial, transition, and final probabilities. (note that it is only for non-zero probabilities at the moment.)
        g_j = []
        for t in list(self.experiment_config.types.keys()):
            t -= 1
            x_i_indices = np.where(logP[:, t + 2] != LOG_EPS)[0]
            # print('g_col_marginals', t, len(x_i_indices))

            possible_states = [state for state in runner.machines[2 + t].states if runner.machines[2 + t].I[state] != LOG_EPS]
            A = log_weighted_sum_probs(self.pi[t][0], logP[:, t + self.LLHOOD_TYPE_START_INDEX],
                                       self.pi[t][1], logP[:, self.MISSING_INDEX - 1],
                                       self.pi[t][2], logP[:, self.ANOMALIES_INDEX - 1])
            temp_gra = np.exp(self.pi[t][0] + logP[:, t + 2] - A)

            # gradient for initial state parameters
            temp_g_j = []
            for state in possible_states:
                temp_g_j.append(self.gradient_initial_optimized_new(runner, state, t, temp_x[x_i_indices], r, temp_gra[x_i_indices], counts_array[x_i_indices], y_i))
            g_j = g_j + temp_g_j

            # gradient for transition parameters
            # print('generating marginals')
            if t == 1:
                marginals = {str(x_i): np.ones((len(x_i),1,1)) if p_x_i[t + 2] != LOG_EPS else np.zeros((len(x_i),1,1)) for x_i, p_x_i in zip(temp_x, logP)}
            else:
                marginals = {str(x_i): runner.machines[2 + t].run_forward_backward(str(x_i)) if p_x_i[t+2] != LOG_EPS else np.zeros((len(x_i),len(x_i))) for x_i, p_x_i in zip(temp_x, logP)}
            # print('generated marginals')
            state_indices = {}
            counter = 0
            temp_g_j = []
            for a in runner.machines[2 + t].T:
                for b in runner.machines[2 + t].T[a]:
                    for c in runner.machines[2 + t].T[a][b]:
                        state_indices[str(a) + '*' + str(b) + '*' + str(c)] = counter
                        temp_g_j.append(0)
                        counter += 1
            # print('first done')
            for x_i_index, (x_i, temp_gra_i, counts_array_i) in enumerate(zip(temp_x[x_i_indices], temp_gra[x_i_indices], counts_array[x_i_indices])):
                if logP[x_i_index, t+2] != LOG_EPS:
                    if t == 1:
                        # for a in runner.machines[2 + t].T:
                        #     temp_g_j = []
                        #     for b in runner.machines[2 + t].T[a]:
                        #         if str(b) in set_chars:
                        #             for c in runner.machines[2 + t].T[a][b]:
                        #                 temp_g_j[state_indices[a + '*' + b + '*' + c]] += self.gradient_transition_optimized_new_marginals(runner, marginals, a, b, c, t, r, str(x_i), y_i, temp_gra_i, counts_array_i)
                        common_chars = list(set(list(str(x_i))) & set(runner.machines[t+2].alphabet))
                        for common_char in common_chars:
                            common_char_ls = np.where(list(str(x_i)) == common_char)[0]
                            for l in common_char_ls:
                                indices_nonzero = np.where(marginals[str(x_i)][l] != 0.)
                                if len(indices_nonzero[0]) != 0:
                                    q_s = indices_nonzero[0]
                                    q_primes = indices_nonzero[1]
                                    for q, q_prime in zip(q_s, q_primes):
                                        temp_g_j[state_indices[str(runner.machines[t + 2].states[q]) + '*' + str(common_char) + '*' + str(
                                            runner.machines[t + 2].states[q_prime])]] += self.gradient_transition_optimized_new_marginals(runner, marginals,
                                                                                                                                          runner.machines[t + 2].states[q], common_char,
                                                                                                                                          runner.machines[t + 2].states[q_prime], t, r,
                                                                                                                                          str(x_i), y_i, temp_gra_i, counts_array_i)

                    else:
                        for l, alpha in enumerate(str(x_i)):
                            if alpha in runner.machines[t+2].alphabet:
                                indices_nonzero = np.where(marginals[str(x_i)][l] != 0.)
                                if len(indices_nonzero[0]) != 0:
                                    q_s = indices_nonzero[0]
                                    q_primes = indices_nonzero[1]
                                    for q, q_prime in zip(q_s, q_primes):
                                        temp_g_j[state_indices[str(runner.machines[t + 2].states[q]) + '*' + str(alpha) + '*' + str(runner.machines[t + 2].states[q_prime])]] += self.gradient_transition_optimized_new_marginals(runner, marginals, runner.machines[t+2].states[q], alpha, runner.machines[t+2].states[q_prime], t, r, str(x_i), y_i, temp_gra_i, counts_array_i)
            # print('transition done')
            g_j = g_j + temp_g_j

            # gradient for final-state parameters
            for state in runner.machines[2 + t].F:
                if runner.machines[2 + t].F[state] != LOG_EPS:
                    g_j.append(self.gradient_final_optimized_new(runner, state, t, temp_x[x_i_indices], r, temp_gra[x_i_indices], counts_array[x_i_indices], y_i))
            # print('final done')

        # print('g', -np.reshape(g_j, newshape=(len(g_j),))/counts_array.sum())
        return -np.reshape(g_j, newshape=(len(g_j),))/counts_array.sum()

    def g_cols(self, w_j_z):
        print_to_file('g_cols is called')
        time_init = time.time()

        # calculates the gradient vector, i.e. df/dw (=df/dz * dz/dw) where f is the object function to minimize.
        # it returns -g_j because of minimizing instead of maximizing. see the objective function.
        runner = self.current_runner

        # updates the parameters
        runner, temp_w_j_z = self.set_all_probabilities_z(runner, w_j_z)

        # generates probabilities
        # time_init2 = time.time()
        self.all_probs = runner.generate_machine_probabilities(self.unique_vals)
        # print_to_file(str(time.time() - time_init2))

        q_total = None
        counter_ = 0

        for i, (data_frame, labels) in enumerate(zip(self.data_frames, self.labels)):
            # print(i)
            for j, column_name in enumerate(list(data_frame.columns)):
                time_temp1 = time.time()
                # print(column_name)
                if counter_ == 0:
                    q_total = self.g_col_marginals(runner, str(i), str(column_name), labels[j] - 1)
                    counter_ += 1
                else:
                    q_total += self.g_col_marginals(runner, str(i), str(column_name), labels[j] - 1)

        print_to_file(str(time.time() - time_init))
        # print_to_file('grad chek is called.')
        # q_approx = self.grad_chek(w_j_z)
        # print(q_total)
        # print_to_file(q_approx)
        # print(q_total-q_approx)
        # print_to_file('gradient norm ' + str(vecnorm(q_total, ord=np.Inf)))
        # print_to_file('gradient approx norm' + str(vecnorm(q_approx, ord=np.Inf)))
        # print_to_file('gradients diff norm' + str(vecnorm(q_total - q_approx)))

        return q_total

    ###################### GRADIENT HELPERS #######################
    def scale_wrt_type(self, gradient, q, t, y_i):
        temp = normalize_log_probs(q)[t]
        return gradient * (1 - temp) if t == y_i else -1 * gradient * temp

    def gradient_initial_optimized_new(self, runner, state, t, x, q, temp, counter, y_i):
        exp_param = 1 - np.exp(runner.machines[2 + t].I[state])

        cs_temp = [runner.machines[2 + t].calculate_gradient_initial_state_optimized(str(x_i), state) for x_i in x]
        cs = np.reshape(cs_temp, newshape=(len(cs_temp),))

        gradient = (temp * counter * cs * exp_param).sum()
        return (self.scale_wrt_type(gradient, q, t, y_i))

    def gradient_transition_optimized_new(self, runner, a, b, c, t, q, x, y_i, temp_gra, counts_array):

        cs_temp = [runner.machines[2 + t].calculate_gradient_abc_new_optimized(str(x_i), a, b, c) for x_i in x]
        cs_temp = np.reshape(cs_temp, newshape=(len(cs_temp),))
        temp_mult = (temp_gra * cs_temp * counts_array).sum()

        exp_param = 1 - np.exp(runner.machines[2 + t].T[a][b][c])
        gradient = exp_param * temp_mult

        return self.scale_wrt_type(gradient, q, t, y_i)

    def gradient_transition_optimized_new_marginals(self, runner, marginals, a, b, c, t, q, x, y_i, temp_gra, counts_array):

        temp_mult = temp_gra * runner.machines[2 + t].calculate_gradient_abc_new_optimized_marginals(marginals[str(x)], str(x), a, b, c) * counts_array
        exp_param = 1 - np.exp(runner.machines[2 + t].T[a][b][c])
        gradient = exp_param * temp_mult

        return self.scale_wrt_type(gradient, q, t, y_i)

    def gradient_final_optimized_new(self, runner, final_state, t, x, q, temp, counter, y_i):
        exp_param = 1 - np.exp(runner.machines[2 + t].F[final_state])

        cs_temp = [runner.machines[2 + t].calculate_gradient_final_state_optimized(str(x_i), final_state) for x_i in x]
        cs = np.reshape(cs_temp, newshape=(len(cs_temp),))
        gradient = sum(temp * counter * cs * exp_param)

        return self.scale_wrt_type(gradient, q, t, y_i)

    ###################### HELPERS #######################
    def grad_chek(self, w_j_z):
        EPS = 1e-8

        runner = self.current_runner
        grad_approx = []

        for k in range(len(w_j_z)):
            # updates the parameters
            w_j_z[k] = w_j_z[k] + EPS
            runner, temp_w_j_z = self.set_all_probabilities_z(runner, w_j_z)
            f_fwd = self.f_cols(w_j_z)

            # updates the parameters
            w_j_z[k] = w_j_z[k] - 2 * EPS
            runner, temp_w_j_z_ignored = self.set_all_probabilities_z(runner, w_j_z)
            f_bwd = self.f_cols(w_j_z)

            grad_approx.append((f_fwd - f_bwd) / (2 * EPS))

            w_j_z = temp_w_j_z

        return np.array(grad_approx)

    ### GETTERS - SETTERS ###
    def set_data(self, data):
        self.data = data

    def set_data_multiple_dfs(self, _data_frame, _dataset_name=None, _column_names=None):
        if _dataset_name is None:
            _dataset_name = 'demo'
        _data_frame = _data_frame.rename(columns=lambda n: str(n).replace(' ', ''))

        # Check for dataframes without column names
        if _column_names is None:
            _column_names = _data_frame.columns

        # Creates a configuration object for the experiments
        config = Config(_dataset_name=_dataset_name, _column_names=_column_names, _types=self.types)

        # Ptype model for inference
        self.set_params(config, _data_frame=_data_frame)

    def set_params(self, _experiment_config, _data_frame):
        self.experiment_config = _experiment_config
        self.data = _data_frame

    def set_likelihoods(self, likelihoods):
        self.likelihoods = likelihoods

    def get_all_parameters_z(self, runner):
        w_j = []
        for t in list(self.experiment_config.types.keys()):
            t -= 1

            # normalize just to make sure it is normalized
            runner.machines[2 + t].I_z = self.normalize_initial_z(runner.machines[2 + t].I_z)

            for state in runner.machines[2 + t].I:
                if runner.machines[2 + t].I[state] != LOG_EPS:
                    w_j.append(runner.machines[2 + t].I_z[state])

            for a in runner.machines[2 + t].T_z:
                # normalize just to make sure it is normalized
                runner.machines[2 + t].F_z, runner.machines[2 + t].T_z = self.normalize_a_state_new(runner.machines[2 + t].F_z, runner.machines[2 + t].T_z, a)

                for b in runner.machines[2 + t].T[a]:
                    for c in runner.machines[2 + t].T[a][b]:
                        w_j.append(runner.machines[2 + t].T_z[a][b][c])

            for state in runner.machines[2 + t].F:
                if runner.machines[2 + t].F[state] != LOG_EPS:
                    w_j.append(runner.machines[2 + t].F_z[state])

        return w_j

    def set_all_probabilities_z(self, runner, w_j_z, normalize=False):
        counter = 0
        temp = []
        for t in list(self.experiment_config.types.keys()):
            t -= 1
            for state in runner.machines[2 + t].I:
                if runner.machines[2 + t].I[state] != LOG_EPS:
                    temp.append(runner.machines[2 + t].I_z[state])
                    runner.machines[2 + t].I_z[state] = w_j_z[counter]
                    counter += 1

            for a in runner.machines[2 + t].T:
                for b in runner.machines[2 + t].T[a]:
                    for c in runner.machines[2 + t].T[a][b]:
                        temp.append(runner.machines[2 + t].T_z[a][b][c])
                        runner.machines[2 + t].T_z[a][b][c] = w_j_z[counter]
                        counter += 1

            for state in runner.machines[2 + t].F:
                if runner.machines[2 + t].F[state] != LOG_EPS:
                    temp.append(runner.machines[2 + t].F_z[state])
                    runner.machines[2 + t].F_z[state] = w_j_z[counter]
                    counter += 1

            if normalize:
                runner.machines[2 + t].F_z, runner.machines[2 + t].T_z = self.normalize_a_state_new(runner.machines[2 + t].F_z, runner.machines[2 + t].T_z, state)
                runner.machines[2 + t].F, runner.machines[2 + t].T = runner.machines[2 + t].F_z, runner.machines[2 + t].T_z

                runner.machines[2 + t].I_z = self.normalize_initial(runner.machines[2 + t].I_z)
                runner.machines[2 + t].I = runner.machines[2 + t].I_z

        return runner, temp

    ### NORMALIZATION METHODS ###
    def normalize_a_state(self, F, T, a):
        # find maximum log probability
        log_mx = LOG_EPS
        for b in T[a]:
            for c in T[a][b]:
                if T[a][b][c] > log_mx:
                    log_mx = T[a][b][c]
        # sum
        sm = 0
        for b in T[a]:
            for c in T[a][b]:
                sm += np.exp(T[a][b][c] - log_mx)

        if F[a] != LOG_EPS:
            if log_mx == LOG_EPS:
                sm += 1.
            else:
                sm += np.exp(F[a] - log_mx)

        # normalize
        for b in T[a]:
            for c in T[a][b]:
                T[a][b][c] = np.log(np.exp(T[a][b][c] - log_mx)/sm)
        if F[a] != LOG_EPS:
            if log_mx == LOG_EPS:
                F[a] = 0.
            else:
                F[a] = np.log(np.exp(F[a] - log_mx)/sm)

        return F, T

    def normalize_a_state_new(self, F, T, a):
        # find maximum log probability
        params = []
        for b in T[a]:
            for c in T[a][b]:
                params.append(T[a][b][c])

        if F[a] != LOG_EPS:
            params.append(F[a])

        log_mx = max(params)
        sm = sum([np.exp(param - log_mx) for param in params])

        # normalize
        for b in T[a]:
            for c in T[a][b]:
                T[a][b][c] = np.log(np.exp(T[a][b][c] - log_mx)/sm)
        if F[a] != LOG_EPS:
            if log_mx == LOG_EPS:
                F[a] = 0.
            else:
                F[a] = np.log(np.exp(F[a] - log_mx)/sm)

        return F, T

    def normalize_initial(self, I):
        # find maximum log probability
        log_mx = LOG_EPS
        for a in I:
            if I[a] != LOG_EPS and I[a]>log_mx:
                log_mx = I[a]
        # sum
        sm = 0
        for a in I:
            if I[a] != LOG_EPS:
                sm += np.exp(I[a] - log_mx)

        # normalize
        for a in I:
            if I[a] != LOG_EPS:
                I[a] = I[a] - log_mx - np.log(sm)

        return I

    def normalize_initial_z(self, I_z):
        # I = deepcopy(I)
        # find maximum log probability
        log_mx = LOG_EPS
        for a in I_z:
            if I_z[a] != LOG_EPS and I_z[a]>log_mx:
                log_mx = I_z[a]
        # sum
        sm = 0
        for a in I_z:
            if I_z[a] != LOG_EPS:
                sm += np.exp(I_z[a] - log_mx)

        # normalize
        for a in I_z:
            if I_z[a] != LOG_EPS:
                I_z[a] = I_z[a] - log_mx - np.log(sm)

        return I_z

    def normalize_final(self, F, T):
        for state in F:
            F, T = self.normalize_a_state_new(F, T, state)

        return F, T

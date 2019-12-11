import sys
sys.path.insert(0,'src/')

from src.PFSM_DiscriminativeLearning import IntegersNewAuto, StringsNewAuto, AnomalyNew, FloatsNewAuto, MissingsNew, BooleansNew, Genders, \
    ISO_8601NewAuto, Date_EUNewAuto, Nonstd_DateNewAuto, SubTypeNonstdDateNewAuto, IPAddress, EmailAddress

from src.utils import contains_all
MACHINES = {'integer':IntegersNewAuto(), 'string':StringsNewAuto(), 'float':FloatsNewAuto(), 'boolean':BooleansNew(),
            'gender':Genders(), 'date-iso-8601':ISO_8601NewAuto(), 'date-eu':Date_EUNewAuto(),
            'date-non-std-subtype':SubTypeNonstdDateNewAuto(), 'date-non-std': Nonstd_DateNewAuto(), 
            'IPAddress':IPAddress(), 'EmailAddress':EmailAddress()}

class PFSMRunner:
    def __init__(self, types):
        self.machines = [MissingsNew(), AnomalyNew()] + [MACHINES[t] for t in types]

    def generate_machine_probabilities(self, data):
        """ generates automata probabilities for a given column of data

        :param data:
        :return params:
        """
        probs = {}
        for input_string in data:
            probs[str(input_string)] = [self.machines[j].calculate_probability(str(input_string)) for j in range(len(self.machines))]

        return probs

    def set_unique_values(self, unique_values):
        for i, machine in enumerate(self.machines):

            machine.supported_words = {}

            for unique_value in unique_values:
                if contains_all(unique_value, machine.alphabet):
                    machine.supported_words[unique_value] = 1
                else:
                    machine.supported_words[unique_value] = 0

            self.machines[i].supported_words = machine.supported_words

    def remove_unique_values(self,):
        for i, machine in enumerate(self.machines):
            self.machines[i].supported_words = {}

    def update_values(self, unique_values):
        self.remove_unique_values()
        self.set_unique_values(unique_values)













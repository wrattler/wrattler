FROM ubuntu:16.04

### get pip git etc

RUN apt-get update; apt-get install -y python3
RUN apt-get update; apt-get install -y python3-pip
RUN apt-get update; apt-get install -y locales
RUN apt-get update; apt-get install -y libcairo2-dev

# Set the locale
RUN sed -i -e 's/# en_GB.UTF-8 UTF-8/en_GB.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen
ENV LANG en_GB.UTF-8
ENV LANGUAGE en_GB:en
ENV LC_ALL en_GB.UTF-8


RUN pip3 install  flask
RUN pip3 install flask_restful
RUN pip3 install  flask_cors
RUN pip3 install requests
RUN pip3 install pandas
RUN pip3 install pytest
RUN pip3 install scikit-learn
RUN pip3 install matplotlib
RUN pip3 install pycairo
RUN pip3 install sklearn
RUN pip3 install pandas
RUN pip3 install numpy
RUN pip3 install seaborn



ADD . /app
WORKDIR /app

ENV FLASK_APP app.py
EXPOSE 7101
CMD ["python3","app.py"]
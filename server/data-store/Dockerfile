FROM ubuntu:16.04

### get pip git etc

RUN apt-get update; apt-get install -y python3
RUN apt-get update; apt-get install -y python3-pip
RUN apt-get update; apt-get install -y locales
RUN apt-get update; apt-get install -y openssl
RUN apt-get update; apt-get install -y libssl-dev

# Set the locale
RUN sed -i -e 's/# en_GB.UTF-8 UTF-8/en_GB.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen
ENV LANG en_GB.UTF-8
ENV LANGUAGE en_GB:en
ENV LC_ALL en_GB.UTF-8

RUN pip3 install --upgrade pip
RUN pip3 install flask
RUN pip3 install flask_restful
RUN pip3 install flask_cors
RUN pip3 install pyarrow
RUN pip3 install azure
RUN pip3 install tempdir
RUN pip3 install pandas
RUN pip3 install pytest

RUN mkdir /app
ADD . /app
WORKDIR /app
EXPOSE 7102

#ENV WRATTLER_LOCAL_DATASTORE True

CMD ["python3","app.py"]

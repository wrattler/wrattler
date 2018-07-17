FROM ubuntu:16.04

### get pip git etc

RUN apt-get update; apt-get install -y python3
RUN apt-get update; apt-get install -y python3-pip

RUN pip3 install  flask
RUN pip3 install  flask_cors
RUN pip3 install requests
RUN pip3 install pandas

ADD . /app
WORKDIR /app

ENV FLASK_APP app.py
EXPOSE 7101
CMD ["python3","app.py"]
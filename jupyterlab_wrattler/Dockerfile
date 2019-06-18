FROM node:10.16-jessie
MAINTAINER na@gmail.com

RUN apt-get update; apt-get -y install nano
RUN apt-get update; apt-get -y install yarn

RUN apt-get update; apt-get install -y python3
RUN apt-get update; apt-get install -y python3-pip

RUN pip3 install jupyterlab

RUN mkdir app
ADD . /app

WORKDIR /app

RUN yarn add typescript
RUN yarn install; jupyter labextension link . ;  jlpm run build

EXPOSE 8889

WORKDIR /public

CMD ["jupyter","lab","--ip","0.0.0.0","--port","8889","--allow-root"]

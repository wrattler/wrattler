FROM node:12.4.0-slim
MAINTAINER na@gmail.com

RUN apt-get update; apt-get -y install nano

RUN curl -sS http://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb http://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get update; apt-get -y remove cmdtest

RUN apt-get update; apt-get -y install yarn
#RUN curl -sL http://deb.nodesource.com/setup_8.x | bash -
#RUN apt-get update; apt-get -y install nodejs

RUN apt-get update; apt-get install -y python3
RUN apt-get update; apt-get install -y python3-pip

RUN pip3 install jupyterlab

RUN mkdir app
ADD . /app

WORKDIR /app

RUN yarn add typescript
RUN yarn install; 
RUN jupyter labextension link . ;  
RUN jlpm run build

EXPOSE 8889

WORKDIR /public

CMD ["jupyter","lab","--ip","0.0.0.0","--port","8889","--allow-root"]

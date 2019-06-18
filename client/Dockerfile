FROM node:10.16-jessie
MAINTAINER na@gmail.com

RUN apt-get update; apt-get -y install nano

RUN curl -sS http://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb http://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get update; apt-get -y remove cmdtest

RUN apt-get update; apt-get -y install yarn
RUN curl -sL http://deb.nodesource.com/setup_8.x | bash -
RUN apt-get update; apt-get -y install nodejs

RUN mkdir app
ADD . /app
RUN cd /app; yarn;
WORKDIR /app
# increase memory limit for node - avoid running out in travis
ENV NODE_OPTIONS=--max_old_space_size=2048

RUN yarn; yarn build;
## copy the built javascript to public/ so it can be served to jupyterlab
RUN cp build/wrattler-app.js public/
RUN npm install http-server -g

CMD ["http-server","public","-c-1"]

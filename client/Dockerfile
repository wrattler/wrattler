FROM node:10.16-jessie
MAINTAINER na@gmail.com

RUN apt-get update; apt-get -y install nano
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | gpg --import
RUN curl -o- -L https://yarnpkg.com/install.sh | bash

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

CMD ["http-server","public","-c-1","--cors=http://localhost:8889"]
# CMD ["./entrypoint.sh"]

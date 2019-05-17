FROM codedevote/dotnet-mono
MAINTAINER codedevote@gmail.com

RUN apt-get -y install nano

RUN curl -sS http://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb http://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get update; apt-get -y remove cmdtest

RUN apt-get update; apt-get -y install yarn
RUN curl -sL http://deb.nodesource.com/setup_8.x | bash -
RUN apt-get update; apt-get -y install nodejs

EXPOSE 8080


RUN mkdir app
ADD . /app

WORKDIR /app
ENV NODE_OPTIONS=--max_old_space_size=4096
RUN yarn; yarn build;
RUN npm install http-server -g

CMD ["http-server","build","-c-1"]

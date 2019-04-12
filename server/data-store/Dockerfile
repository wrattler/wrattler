FROM codedevote/dotnet-mono
MAINTAINER codedevote@gmail.com

RUN apt-get -y install nano

RUN curl -sS http://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb http://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get update; apt-get -y remove cmdtest

RUN apt-get update; apt-get -y install yarn
RUN curl -sL http://deb.nodesource.com/setup_8.x | bash -
RUN apt-get update; apt-get -y install nodejs

RUN mkdir /app
ADD . /app
#RUN cd /app; yarn;
WORKDIR /app
EXPOSE 7102
RUN chmod u+x build.sh
CMD ["./build.sh", "sleep"]
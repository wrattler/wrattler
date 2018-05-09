FROM codedevote/dotnet-mono
MAINTAINER codedevote@gmail.com

#ADD . /app
RUN mkdir /app
WORKDIR /app

#COPY package*.json ./
#COPY . .
# another comment

RUN apt install nano
EXPOSE 8080

FROM codedevote/dotnet-mono
MAINTAINER codedevote@gmail.com

RUN apt-get -y install nano

RUN curl -sS http://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb http://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get update; apt-get -y remove cmdtest

RUN apt-get update; apt-get -y install yarn
RUN curl -sL http://deb.nodesource.com/setup_8.x | bash -
RUN apt-get update; apt-get -y install nodejs

# RUN mkdir app
# ADD . /app
# RUN cd /app; yarn;
#WORKDIR /app

EXPOSE 8080
# RUN ["chmod", "+x", "/app/entrypoint.sh"]
# RUN ["/usr/bin/yarn"]
# RUN ["/usr/bin/yarn","start"]
# CMD [ "npm", "start" ]



RUN apt-get update; apt-get install -y python3
RUN apt-get update; apt-get install -y python3-pip

RUN pip3 install jupyterlab


RUN mkdir app
ADD . /app

WORKDIR /app

RUN yarn add typescript
#WORKDIR /app/jupyterlab_wrattler
RUN cd /app/jupyterlab_wrattler; yarn install; jupyter labextension link . ;  jlpm run build

RUN yarn; yarn build;
RUN npm install http-server -g

EXPOSE 8889

CMD ["jupyter","lab","--ip","0.0.0.0","--port","8889","--allow-root"]

#CMD ["/bin/bash"]
##CMD ["http-server","build","-c-1"]

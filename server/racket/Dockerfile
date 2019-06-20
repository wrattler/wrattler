FROM ubuntu:16.04
RUN apt-get update && apt-get install -y wget
RUN wget https://mirror.racket-lang.org/installers/7.2/racket-7.2-x86_64-linux.sh
RUN bash racket-7.2-x86_64-linux.sh --unix-style --dest /usr
RUN apt-get update; apt-get install -y sqlite3 libsqlite3-dev
RUN apt-get update; apt-get install -y libfontconfig1
RUN apt-get update; apt-get install -y libcairo2-dev
RUN apt-get update; apt-get install -y libjpeg-dev
RUN apt-get update; apt-get install -y libpango-1.0.0
RUN apt-get update; apt-get install -y libpangocairo-1.0.0
ADD . /wrattler-racket-service
WORKDIR /wrattler-racket-service
RUN raco pkg install --auto

EXPOSE 7104
CMD ["./start-racket-service"]

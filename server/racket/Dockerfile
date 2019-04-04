FROM ubuntu:16.04
RUN apt-get update && apt-get install -y software-properties-common
RUN add-apt-repository ppa:plt/racket && apt-get update && apt-get install -y racket
ADD . /wrattler-racket-service
WORKDIR /wrattler-racket-service
RUN raco pkg install --auto

EXPOSE 7104
CMD ["./start-racket-service"]

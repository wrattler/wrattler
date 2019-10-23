FROM wrattler/wrattler_r_service_base:latest


## install the datadiff package
RUN git clone https://github.com/alan-turing-institute/datadiff
RUN Rscript -e "devtools::install_local('datadiff')"

# copy current working directory
ADD . /app
WORKDIR /app

# expose the port and start running the Jug http server.
EXPOSE 7103
CMD ["Rscript", "app.R"]

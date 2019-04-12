FROM ubuntu:16.04

RUN apt-get update; apt-get install -y libssl-dev
# install R, and setup CRAN mirror
RUN apt-get update; apt-get install -y software-properties-common
RUN apt-get update; apt-get install -y libcurl4-openssl-dev
RUN apt-get update; apt-get install -y libxml2-dev
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys E298A3A825C0D65DFD57CBB651716619E084DAB9

RUN add-apt-repository -y "ppa:marutter/rrutter3.5"
RUN add-apt-repository -y "ppa:marutter/c2d4u"
#RUN apt-get update && apt-get -y install r-cran-rstan
RUN echo "r <- getOption('repos'); r['CRAN'] <- 'http://cran.us.r-project.org'; options(repos='http://cran.rstudio.com/');" > ~/.Rprofile

RUN add-apt-repository 'deb https://cloud.r-project.org/bin/linux/ubuntu xenial-cran35/'; apt-get update; apt-get -y install r-base; apt-get -y install r-base-dev

# install needed R packages

RUN Rscript -e "install.packages('ggplot2')"
RUN Rscript -e "install.packages('jug')"
RUN Rscript -e "install.packages('xml2')"
RUN Rscript -e "install.packages('httr')"
RUN Rscript -e "install.packages('purrr')"
RUN Rscript -e "install.packages('testthat')"
RUN Rscript -e "install.packages('httptest')"

RUN Rscript -e "install.packages('cleanEHR')"
RUN Rscript -e "install.packages('reshape2')"
RUN Rscript -e "install.packages('plyr')"
RUN Rscript -e "install.packages('tidyverse')"
RUN Rscript -e "install.packages('lattice')"
RUN Rscript -e "install.packages('gridExtra')"
RUN Rscript -e "install.packages('dplyr')"
RUN Rscript -e "install.packages('readr')"
RUN Rscript -e "install.packages('rlang')"

# install apache arrow
RUN apt-get install -y wget
RUN apt-get install -y autoconf autogen
RUN wget https://cmake.org/files/v3.12/cmake-3.12.0-Linux-x86_64.sh
RUN chmod +x cmake-3.12.0-Linux-x86_64.sh
RUN ./cmake-3.12.0-Linux-x86_64.sh --skip-license
RUN ln -s cmake-3.12.0-Linux-x86_64/bin/* /usr/bin
RUN apt-get update; apt-get install -y git

RUN apt-get update; apt-get install -y flex bison
RUN apt-get install -y libboost-all-dev
RUN git clone --branch apache-arrow-0.13.0 https://github.com/apache/arrow.git
RUN cd arrow/cpp && mkdir release && cd release && cmake .. cmake .. -DARROW_PARQUET=ON -DCMAKE_BUILD_TYPE=Release -DARROW_BOOST_USE_SHARED:BOOL=On && make install
RUN Rscript -e "install.packages('devtools')"
RUN echo $GITHUB_PAT > ~/.Renviron

RUN Rscript -e "devtools::install_local('arrow/r')"

## install the datadiff package
RUN git clone https://github.com/alan-turing-institute/datadiff
RUN Rscript -e "devtools::install_local('datadiff')"
##RUN Rscript -e "devtools::install_github('alan-turing-institute/datadiff')"

# copy current working directory
ADD . R_service
WORKDIR R_service

# expose the port and start running the Jug http server.
EXPOSE 7103
CMD ["Rscript", "app.R"]

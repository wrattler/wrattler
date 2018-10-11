FROM ubuntu:16.04

RUN apt-get update; apt-get install -y libssl-dev
# install R, and setup CRAN mirror
RUN apt-get update; apt-get install -y software-properties-common
RUN apt-get update; apt-get install -y libcurl4-openssl-dev
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys E298A3A825C0D65DFD57CBB651716619E084DAB9
RUN echo "r <- getOption('repos'); r['CRAN'] <- 'http://cran.us.r-project.org'; options(repos = r);" > ~/.Rprofile
RUN add-apt-repository 'deb [arch=amd64,i386] https://cran.rstudio.com/bin/linux/ubuntu xenial/'; apt-get update; apt-get -y install r-base


# install needed R packages

RUN Rscript -e "install.packages('ggplot2')"
RUN Rscript -e "install.packages('jug')"
RUN Rscript -e "install.packages('xml2')"
RUN Rscript -e "install.packages('httr')"


# copy current working directory
# copy this package into the image and create directories for input and output
ADD . R_service
WORKDIR R_service


EXPOSE 7103

CMD ["Rscript", "app.R"]
#CMD ["bash"]
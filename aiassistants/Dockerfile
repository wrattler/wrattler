FROM ubuntu:16.04



RUN apt-get update; apt-get install -y libssl-dev

# install R, and setup CRAN mirror
RUN apt-get update; apt-get install -y software-properties-common
RUN apt-get update; apt-get install -y libcurl4-openssl-dev
RUN apt-get update; apt-get install -y libxml2-dev
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys E298A3A825C0D65DFD57CBB651716619E084DAB9
RUN add-apt-repository -y "ppa:marutter/rrutter3.5"
RUN add-apt-repository -y "ppa:marutter/c2d4u"
RUN echo "r <- getOption('repos'); r['CRAN'] <- 'http://cran.us.r-project.org'; options(repos='http://cran.rstudio.com/');" > ~/.Rprofile
RUN add-apt-repository 'deb https://cloud.r-project.org/bin/linux/ubuntu xenial-cran35/'; apt-get update; apt-get -y install r-base
#; apt-get -y install r-base-dev

# install R packages, starting with devtools.
RUN Rscript -e "install.packages(\"devtools\",repos=\"http://cran.us.r-project.org\")"
RUN Rscript -e "install.packages(\"dplyr\",repos=\"http://cran.us.r-project.org\")"
RUN Rscript -e "install.packages(\"lpSolve\",repos=\"http://cran.us.r-project.org\")"
RUN Rscript -e "devtools::install_github(\"tpetricek/datadiff\") "

# Python, and python packages

RUN apt-get update; apt-get install -y python3
RUN apt-get update; apt-get install -y python3-pip
RUN pip3 install --upgrade pip
RUN pip3 install pandas sklearn matplotlib mpltools greenery requests clevercsv==0.4.3
RUN pip3 install pandas
RUN pip3 install sklearn
RUN pip3 install matplotlib
RUN pip3 install greenery

# dotnet
RUN apt-get -y install wget
RUN wget -q https://packages.microsoft.com/config/ubuntu/16.04/packages-microsoft-prod.deb
RUN dpkg -i packages-microsoft-prod.deb
RUN apt-get update; apt-get install -y apt-transport-https; apt-get update; apt-get install -y dotnet-hosting-2.0.6
RUN apt-get install -y dotnet-sdk-2.1

ADD . /app
RUN dotnet restore /app/server/
RUN dotnet build /app/server/
#
EXPOSE 5050
WORKDIR "app/server"
CMD ["dotnet","bin/Debug/netcoreapp2.1/aiassistants.dll"]

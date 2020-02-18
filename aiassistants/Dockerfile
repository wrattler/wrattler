FROM mcr.microsoft.com/dotnet/core/sdk:2.2

RUN apt-get update; apt-get install -y python3
RUN apt-get update; apt-get install -y python3-pip

RUN apt-get update; apt-get install -y r-base
RUN apt-get update; apt-get install -y libcurl4-openssl-dev
RUN apt-get update; apt-get install -y libssl-dev
RUN apt-get update; apt-get install -y libxml2-dev

RUN pip3 install pandas sklearn matplotlib mpltools greenery requests clevercsv==0.4.3

RUN Rscript -e "install.packages(\"devtools\",repos=\"http://cran.us.r-project.org\")"
RUN Rscript -e "install.packages(\"dplyr\",repos=\"http://cran.us.r-project.org\")"
RUN Rscript -e "install.packages(\"lpSolve\",repos=\"http://cran.us.r-project.org\")"

RUN Rscript -e "devtools::install_github(\"tpetricek/datadiff\") "

RUN pip3 install pandas
RUN pip3 install sklearn
RUN pip3 install matplotlib
RUN pip3 install greenery

RUN mkdir /app

ADD server /app/server
RUN dotnet restore /app/server/
RUN dotnet build /app/server/

ADD assistants/config.json /app/assistants/config.json
ADD assistants/outlier /app/assistants/outlier
ADD assistants/ccsv /app/assistants/ccsv
ADD assistants/datadiff /app/assistants/datadiff
ADD assistants/test /app/assistants/test

EXPOSE 5050
WORKDIR "app/server"
CMD ["dotnet","bin/Debug/netcoreapp2.1/aiassistants.dll"]

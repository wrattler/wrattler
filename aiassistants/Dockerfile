FROM mcr.microsoft.com/dotnet/core/sdk:2.2

RUN apt-get update; apt-get install -y python3
RUN apt-get update; apt-get install -y python3-pip

RUN mkdir /app

ADD config.json /app

ADD server /app/server
ADD outlier /app/outlier

RUN dotnet restore /app/server/
RUN dotnet restore /app/outlier/

RUN dotnet build /app/server/
RUN dotnet build /app/outlier/

ADD datadiff /app/datadiff
ADD test /app/test

RUN pip3 install clevercsv requests
ADD ccsv /app/ccsv

EXPOSE 5050
WORKDIR "app/server"
CMD ["dotnet","bin/Debug/netcoreapp2.1/aiassistants.dll"]

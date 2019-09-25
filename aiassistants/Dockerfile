FROM mcr.microsoft.com/dotnet/core/sdk:2.2

RUN apt-get update; apt-get install -y python3
RUN apt-get update; apt-get install -y python3-pip
RUN pip3 install pandas

RUN mkdir /app

ADD server /app/server
RUN dotnet restore /app/server/
RUN dotnet build /app/server/

ADD assistants/config.json /app
ADD assistants/outlier /app/assistants/outlier
ADD assistants/datadiff /app/assistants/datadiff
ADD assistants/test /app/assistants/test

EXPOSE 5050
WORKDIR "app/server"
CMD ["dotnet","bin/Debug/netcoreapp2.1/aiassistants.dll"]

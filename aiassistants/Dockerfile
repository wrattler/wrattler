FROM mcr.microsoft.com/dotnet/core/sdk:2.2

ADD . /app
RUN dotnet restore app/server/
RUN dotnet restore app/outlier/
RUN dotnet build app/server/
RUN dotnet build app/outlier/

RUN apt-get update; apt-get install -y python3
RUN apt-get update; apt-get install -y python3-pip

EXPOSE 5050
WORKDIR "app/server"
CMD ["dotnet","bin/Debug/netcoreapp2.1/aiassistants.dll"]

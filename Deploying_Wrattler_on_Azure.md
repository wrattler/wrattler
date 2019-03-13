## Introduction

The instructions here are for deploying the four components of Wrattler
(client, data-store, and the R and Python services) on four different Azure VMs.
(Although it would seem to have been simpler to use docker-compose to run them
all as separate containers on the same VM, we ran into trouble with this (didn't
seem to be able to expose non-standard ports to the internet)).

## Clone the repo and switch to demo branch
```
git clone https://github.com/wrattler/wrattler.git
cd wrattler
git checkout demo-mar-2019
```

## Create and start the VMs

```
cd deploy
chmod u+x deploy.sh
./deploy.sh
```

It will take some time to provision the VMs, and then for the custom commands to setup and run the docker containers to execute.
After some minutes, the client should be available via your browser at
```http://wrattlerclient.westeurope.cloudapp.azure.com:8080```

## Stop the VMs

From the ```wrattler/deploy/``` directory, do:
```
chmod u+x stop.sh
./stop.sh
```

## Restart the VMs

From the ```wrattler/deploy/``` directory, do:
```
chmod u+x stop.sh
./start.sh
```
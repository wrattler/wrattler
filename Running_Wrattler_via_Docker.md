# How to run Wrattler via Docker(-compose)

The easiest way to run Wrattler is using `docker-compose` on your local machine.


## Install docker and docker-compose

### Windows

Download the Docker installer from [here](https://hub.docker.com/editions/community/docker-ce-desktop-windows) and run.

Check it is working correctly by running ```docker run hello-world``` in a terminal.

### Ubuntu

```
sudo apt install docker.io
sudo apt install docker-compose
```

### OSX

You can either download the .dmg from [here](https://hub.docker.com/editions/community/docker-ce-desktop-mac) and install from there, or you can use ***homebrew***:
```
brew install docker docker-compose
```

## Clone the wrattler repo

If you haven't already cloned the wrattler github repository, do
```
git clone https://github.com/wrattler/wrattler.git
cd wrattler
git checkout demo-mar-2019
```

## Build and run the containers

From this base `wrattler` directory, run the commands:
```
docker-compose build
docker-compose up
```

The client should be visible in your browser by typing ```localhost:8080``` in the address bar.

## Stop the containers

When you want to shut Wrattler down, run (again from the `wrattler/` directory)  the command
```docker-compose down```

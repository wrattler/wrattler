#!/bin/bash

## shell script to build docker images and push to dockerhub,
## and update ChangeLog
## usage:  ./build_release.sh <version>
## where <version> is in the format vX.Y with integer X and Y.

VERSION=$1

echo VERSION is $VERSION

if [[ ! $VERSION =~ ^v[0-9]+.[0-9]+(.[0-9]+)?$ ]];
then echo "Usage is 'build_release.sh <version>'  with version format vX.Y";
     exit;
fi;

IMAGES=()


## change to client dir and build docker image
echo "Building docker image: wrattler/wrattler_client:$VERSION"
cd client; docker build -t wrattler/wrattler_client:$VERSION -f Dockerfile .;
if [ ! $? -eq 0 ];
then echo "Problem building client docker image";
   exit;
fi;
cd -
IMAGES=("${IMAGES[@]}" "wrattler/wrattler_client:${VERSION}")

## do the same for the jupyterlab image
echo "Building docker image: wrattler/wrattler_jupyterlab:$VERSION"
cd jupyterlab_wrattler; docker build -t wrattler/wrattler_jupyterlab:$VERSION -f Dockerfile .;
if [ ! $? -eq 0 ];
then echo "Problem building jupyterlab docker image";
   exit;
fi;
cd -
IMAGES=("${IMAGES[@]}" "wrattler/wrattler_jupyterlab:${VERSION}")

## now do the same for all the services

for service in "python" "R" "racket";
do cd server/$service;
   service=`echo $service | tr '[:upper:]' '[:lower:]'`
   echo "Building docker image: wrattler/wrattler_${service}_service:$VERSION"
   docker build -t wrattler/wrattler_${service}_service:$VERSION -f Dockerfile .;
    if [ ! $? -eq 0 ];
    then echo "Problem building $service docker image";
	 exit;
    fi;
    cd -
    IMAGES=("${IMAGES[@]}" "wrattler/wrattler_${service}_service:${VERSION}")
done;

## and the datastore
cd server/data-store; docker build -t wrattler/wrattler_data_store:$VERSION -f Dockerfile .;
if [ ! $? -eq 0 ];
then echo "Problem building data-store docker image";
   exit;
fi;
cd -
IMAGES=("${IMAGES[@]}" "wrattler/wrattler_data_store:${VERSION}")

## now try to push the images to dockerhub - this will only work
## if the user has done 'docker login' and has permissions for the wrattler
## repository on dockerhub.

for img in "${IMAGES[@]}";
do  echo pushing $img;
    docker push $img;
    if [ ! $? -eq 0 ];
    then echo "Problem pushing docker image $img - have you done docker login, and are you sure you have rights to the wrattler organization on dockerhub?";
	 exit;
    fi;

done;

echo "Please edit ChangeLog.md adding details of new features for this release."

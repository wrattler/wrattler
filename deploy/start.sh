#!/bin/bash

declare resourceGroupName="wrattlerDemoTest"


for service in "client" "datastore" "r" "python";
  do az vm start --resource-group ${resourceGroupName} --name wrattler${service}
done;

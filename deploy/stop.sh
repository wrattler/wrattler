#!/bin/bash

declare resourceGroupName="wrattlerDemoTest"

for service in "client" "datastore" "r" "python";
  do az vm deallocate --resource-group ${resourceGroupName} --name wrattler${service}
done;

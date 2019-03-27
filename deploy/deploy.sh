#!/bin/bash

declare resourceGroupName="wrattlerDemoTest"
declare templatePath="./template.json"

for service in "client" "datastore" "r" "python";
  do declare deploymentName="wrattler${service}";
     declare parameterPath="./wrattler${service}/parameters.json";
     declare customCmdJson="./wrattler${service}/script-config.json";
     az group deployment create --name "${deploymentName}" \
	--resource-group "${resourceGroupName}" \
	--template-file "${templatePath}" \
	--parameters "${parameterPath}";
     az vm extension set \
        --resource-group "${resourceGroupName}" \
        --vm-name  "${deploymentName}"  --name customScript \
        --publisher Microsoft.Azure.Extensions \
        --settings "${customCmdJson}";
done;

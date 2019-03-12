


declare pythonDeploymentName="wrattlerpython"
declare rDeploymentName="wrattlerr"
declare datastoreDeploymentName="wrattlerdatastore"
declare clientDeploymentName="wrattlerclient"

declare resourceGroupName="wrattlerDemoTest"

declare templatePath="./wrattlerpython/template.json"

declare pythonParameterPath="./wrattlerpython/parameters.json"
declare rParameterPath="./wrattlerr/parameters.json"
declare datastoreParameterPath="./wrattlerdatastore/parameters.json"
declare clientParameterPath="./wrattlerclient/parameters.json"

az group deployment create --name "${pythonDeploymentName}" --resource-group "${resourceGroupName}" --template-file "${templatePath}" --parameters "${pythonParameterPath}"
az group deployment create --name "${rDeploymentName}" --resource-group "${resourceGroupName}" --template-file "${templatePath}" --parameters "${rParameterPath}"
az group deployment create --name "${datastoreDeploymentName}" --resource-group "${resourceGroupName}" --template-file "${templatePath}" --parameters "${datastoreParameterPath}"
az group deployment create --name "${clientDeploymentName}" --resource-group "${resourceGroupName}" --template-file "${templatePath}" --parameters "${clientParameterPath}"

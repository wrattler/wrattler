# Running use cases on Wrattler

The use cases should be ran via docker (see Running_Wrattler_via_Docker.md for instructions about 
setting up docker for Wrattler).


## Run HES challenge on Wrattler

The HES challenge uses the python service. All input datasets used in this challenge should be copied to: `server/python`:
    
       * "csv/small/appliance_type_codes.csv"
       * "csv/small/appliance_types.csv"
       * "csv/small/appliance_codes.csv"
       * "csv/agd-1a/appliance_group_data-1a_0.01.csv"
       * "csv/anonhes/ipsos-anonymised-corrected_310713.csv"

The files copied  should conserve the same directory structure as the one shown in `HES_challenge.md` code 
(e.g. `"csv/small/appliance_type_codes.csv"`)

After copying all files in the server directory, just run and build the containers with
```
docker-compose build
docker-compose up
``` 

The client should be visible in your browser by typing ```http://0.0.0.0:8080/?use-cases/HES_challenge``` 
in the address bar.

## Run Tundra challenge on Wrattler

The Tundra challenge uses the R service. All input datasets used in this challenge should be copied to: `server/R`:
    
       * teamtraits_AllTraits_AllObs_WideFormat.RData
       
The challenge has a data integration step that combines the temperature
datasets from the [Climatic Research Unit](http://www.cru.uea.ac.uk/) [CRU]. For this, it is necessary to copy
the directory '401_TMP_monthly_1950_2015' (and all samples inside) in `server/R`.

After copying the files in the server directory, just run and build the containers with
```
docker-compose build
docker-compose up
``` 

The client should be visible in your browser by typing ```http://0.0.0.0:8080/?use-cases/Tundra_challenge``` 
in the address bar.

## Run Clean EHR challenge on Wrattler

The Clean EHR challenge uses both  R and python services. All input datasets used in this challenge should be copied to 
service where they are going to be read from.
 
tn this case the data file is read from in the R code and should be copied to `server/R`:
 
    *  "anon_public_d.RData"
  
After copying the files in the server, just run and build the containers with
```
docker-compose build
docker-compose up
``` 

The client should be visible in your browser by typing ```http://0.0.0.0:8080/?use-cases/CleanEHR_challenge``` 
in the address bar.
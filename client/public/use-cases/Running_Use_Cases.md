# Running use cases on Wrattler

The use cases should be ran via docker (see Running_Wrattler_via_Docker.md for instructions about setting up docker for Wrattler).


  ## Run HES challenge on Wrattler

The HES challenge uses the python service. All input datasets used in this challenge should be copied to: `server/python/`:
    
       * "csv/small/appliance_type_codes.csv"
       * "csv/small/appliance_types.csv"
       * "csv/small/appliance_codes.csv"

The files copied  should conserve the same directory structure as the one called in `Hes_challenge.md` code (e.g. `"csv/small/appliance_type_codes.csv"`)

After copying all files in the server directory, just run and build the containers with
```
docker-compose build
docker-compose up
``` 

The client should be visible in your browser by typing ```http://0.0.0.0:8080/?use-cases/Hes_challenge``` in the address bar.

## Run Tundra challenge on Wrattler

The Tundra challenge uses the R service. All input datasets used in this challenge should be copied to: `server/R`:
    
       * teamtraits_AllTraits_AllObs_WideFormat.RData
       

After copying the files in the server directory, just run and build the containers with
```
docker-compose build
docker-compose up
``` 

The client should be visible in your browser by typing ```http://0.0.0.0:8080/?use-cases/Tundra_challenge``` in the address bar.

## Run Clean EHR challenge on Wrattler

The Tundra challenge uses both the R and python services. All input datasets used in this challenge should be copied to corresponding service they
will be read from, in this case the data file is only read from in the R code:
 
 
 
 1. `server/R`:
    *  "anon_public_d.RData"
  
 
After copying the filese in the server, just run and build the containers with
```
docker-compose build
docker-compose up
``` 

The client should be visible in your browser by typing ```http://0.0.0.0:8080/?use-cases/Tundra_challenge``` in the address bar.
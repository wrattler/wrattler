```markdown
# Welcome to Wrattler: Tundra traits analysis

This repo contains a particular analysis of the "Tudra Traits" dataset, one of the AIDA project's "data wrangling challenges".
The challenge is to infer from this data the extent to which climate affects shrub growth.
Along the way, the Tundra dataset requires cleaning, filtering, and normalizing operations.
It also needs to be joined with the temperature/precipitation datasets from the Climatic Research Unit [CRU].

## Data wrangling 
This is the original Tundra Team cleaning script, slightly modified to work in our framework.

Start with the data cleaning steps (removing data from abnormal sources, renaming variables, removing un-unerstood variabes):

```


```r
library(reshape2)
library(plyr)
library(dplyr)
library(ggplot2)

# Load data ----
load("teamtraits_AllTraits_AllObs_WideFormat.RData")

nteamtraits <- seq(1:nrow(teamtraits))

teamtraits$IndividualID <- nteamtraits
colnames(teamtraits)[which(colnames(teamtraits)=="SpeciesName")] <- "OriginalName"

sub_teamtraits <- subset(teamtraits,select = c("IndividualID","AccSpeciesName","OriginalName","SLA","PlantHeight_Veg","PlantHeight_Reproductive","SeedMass_dry","LeafN","LDMC","StemSpecificDensity","LeafP","LeafArea","LeafFreshMass","LeafDryMass","StemDiameter","Leaf.d15N","Leaf.d13c","LeafC","LCID","C.N.ratio","RSratio","RootingDepth","Lat","Lon","Altitude","SiteName","SubsiteName","Treatment","DOY_measured","Year_measured","DataContributor","Data_coPIs","File.name","Comments","ValueKindName","DataEnterer"))

teamtraits.long<-melt(sub_teamtraits,id=c("IndividualID","AccSpeciesName","OriginalName","Lat","Lon","Altitude","SiteName","SubsiteName","Treatment","DOY_measured","Year_measured","DataContributor","Data_coPIs","File.name","Comments","ValueKindName","DataEnterer"),na.rm = TRUE)
colnames(teamtraits.long)[which(colnames(teamtraits.long) %in% c("variable","value"))]<-c("Trait","Value")

teamtraits.long<-within(teamtraits.long,teamtraits.long$Trait<-as.character(Trait))

# Remove seed mass data from Salix arctica Rebecca Klady because units uncertain and Papaver from me because values seem off (units problem?)
teamtraits.long <- subset(teamtraits.long,(teamtraits.long$DataContributor=="Anne Bjorkman" & teamtraits.long$AccSpeciesName=="Papaver radicatum" & teamtraits.long$Trait=="SeedMass")==F)
teamtraits.long <- subset(teamtraits.long,(teamtraits.long$DataContributor=="Rebecca Klady" & teamtraits.long$AccSpeciesName=="Salix arctica" & teamtraits.long$Trait=="SeedMass")==F)
                                       
# Remove SLA data from Marko's Niwot database
teamtraits.long <- subset(teamtraits.long,(teamtraits.long$DataContributor=="Marko_Spasojevic" & teamtraits.long$Trait == "SLA")==F)

# Remove LCID because no one knows what it is
teamtraits.long <- subset(teamtraits.long,teamtraits.long$Trait != "LCID")

# Remove all treatment data
select <-(teamtraits.long$Treatment %in% c("none","control","None","Control","Warming over time","Meadow_ field","Vikhireva-Vasilkova et al._ 1964","Pond_ field","Ridge_ field","Basin_ field","Trough_ field") | is.na(teamtraits.long$Treatment))
teamtraits.long <- subset(teamtraits.long,select)

# Make pretty names ----
teamtraits.long$TraitPretty[teamtraits.long$Trait=="RootingDepth"] <- "Rooting depth"
teamtraits.long$TraitPretty[teamtraits.long$Trait=="RSratio"] <- "Root:shoot ratio"
teamtraits.long$TraitPretty[teamtraits.long$Trait=="StemSpecificDensity"] <- "Stem density (SSD)"
teamtraits.long$TraitPretty[teamtraits.long$Trait=="C.N.ratio"] <- "Leaf C:N ratio"
teamtraits.long$TraitPretty[teamtraits.long$Trait=="Leaf.d13c"] <- "Leaf d13C"
teamtraits.long$TraitPretty[teamtraits.long$Trait=="StemDiameter"] <- "Stem diameter"
teamtraits.long$TraitPretty[teamtraits.long$Trait=="Leaf.d15N"] <- "Leaf d15N"
teamtraits.long$TraitPretty[teamtraits.long$Trait=="SeedMass_dry"] <- "Seed mass"
teamtraits.long$TraitPretty[teamtraits.long$Trait=="LeafArea"] <- "Leaf area"
teamtraits.long$TraitPretty[teamtraits.long$Trait=="LeafC"] <- "Leaf C"
teamtraits.long$TraitPretty[teamtraits.long$Trait=="LeafDryMass"] <- "Leaf dry mass"
teamtraits.long$TraitPretty[teamtraits.long$Trait=="LeafFreshMass"] <- "Leaf fresh mass"
teamtraits.long$TraitPretty[teamtraits.long$Trait=="LeafN"] <- "Leaf N"
teamtraits.long$TraitPretty[teamtraits.long$Trait=="LeafP"] <- "Leaf P"
teamtraits.long$TraitPretty[teamtraits.long$Trait=="PlantHeight_Reproductive"] <- "Height, repro."
teamtraits.long$TraitPretty[teamtraits.long$Trait=="PlantHeight_Veg"] <- "Height, veg."
teamtraits.long$TraitPretty[teamtraits.long$Trait=="SLA"] <- "Specific leaf area (SLA)"
teamtraits.long$TraitPretty[teamtraits.long$Trait=="LDMC"] <- "LDMC"

# Make names that match with TRY
teamtraits.long$TraitTRY[teamtraits.long$Trait=="RootingDepth"] <- "Rooting depth"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="RSratio"] <- "Root/shoot ratio"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="StemSpecificDensity"] <- "Stem dry mass per stem fresh volume (stem specific density, SSD)"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="C.N.ratio"] <- "Leaf carbon/nitrogen (C/N) ratio"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="Leaf.d13c"] <- "Leaf carbon (C) isotope discrimination (delta 13C)"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="StemDiameter"] <- "Stem diameter"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="Leaf.d15N"] <- "Leaf nitrogen (N) isotope signature (delta 15N)"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="SeedMass_dry"] <- "Seed dry mass"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="LeafArea"] <- "Leaf area"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="LeafC"] <- "Leaf carbon (C) content per leaf dry mass"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="LeafDryMass"] <- "Leaf dry mass"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="LeafFreshMass"] <- "Leaf fresh mass"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="LeafN"] <- "Leaf nitrogen (N) content per leaf dry mass"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="LeafP"] <- "Leaf phosphorus (P) content per leaf dry mass"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="PlantHeight_Reproductive"] <- "Plant height, reproductive"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="PlantHeight_Veg"] <- "Plant height, vegetative"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="SLA"] <- "Leaf area per leaf dry mass (specific leaf area, SLA)"
teamtraits.long$TraitTRY[teamtraits.long$Trait=="LDMC"] <- "Leaf dry mass per leaf fresh mass (Leaf dry matter content, LDMC)"

# Add units
teamtraits.long$Units[teamtraits.long$Trait=="RootingDepth"] <- "cm"
teamtraits.long$Units[teamtraits.long$Trait=="RSratio"] <- "ratio"
teamtraits.long$Units[teamtraits.long$Trait=="StemSpecificDensity"] <- "mg/mm3"
teamtraits.long$Units[teamtraits.long$Trait=="C.N.ratio"] <- "ratio"
teamtraits.long$Units[teamtraits.long$Trait=="Leaf.d13c"] <- "parts per thousand"
teamtraits.long$Units[teamtraits.long$Trait=="StemDiameter"] <- "m"
teamtraits.long$Units[teamtraits.long$Trait=="Leaf.d15N"] <- "parts per thousand"
teamtraits.long$Units[teamtraits.long$Trait=="SeedMass_dry"] <- "mg"
teamtraits.long$Units[teamtraits.long$Trait=="LeafArea"] <- "mm2"
teamtraits.long$Units[teamtraits.long$Trait=="LeafC"] <- "mg/g"
teamtraits.long$Units[teamtraits.long$Trait=="LeafDryMass"] <- "mg"
teamtraits.long$Units[teamtraits.long$Trait=="LeafFreshMass"] <- "g"
teamtraits.long$Units[teamtraits.long$Trait=="LeafN"] <- "mg/g"
teamtraits.long$Units[teamtraits.long$Trait=="LeafP"] <- "mg/g"
teamtraits.long$Units[teamtraits.long$Trait=="PlantHeight_Reproductive"] <- "m"
teamtraits.long$Units[teamtraits.long$Trait=="PlantHeight_Veg"] <- "m"
teamtraits.long$Units[teamtraits.long$Trait=="SLA"] <- "mm2/mg"
teamtraits.long$Units[teamtraits.long$Trait=="LDMC"] <- "ratio"

# CLEAN DATASET ----

# Add genus name
teamtraits.long$Genus<-as.vector(sapply(strsplit(teamtraits.long$AccSpeciesName," ",fixed=FALSE), "[", 1))

drops <- c("teamtraits.long")
teamtraits.clean <- teamtraits.long %>% select(-one_of(drops))

```
Grouping by traits (plant height and leaf area), summarise the other variables.


```r
## Step 1: individual records against the entire distribution (except plant height and leaf area)
teamtraits.clean2 <- teamtraits.clean %>% dplyr::mutate(nrow=row_number()) %>% group_by(Trait) %>% dplyr::mutate(mean_all = round(((sum(Value) - Value)/(n()-1)),5), n_all = n(), median_all = median(Value),sd_all = sd(Value), ErrorRisk_all = round((abs(Value-mean_all)/sd_all),4),ErrorRiskMedian_all = round((abs(Value-median_all)/sd_all),4))

teamtraits.clean3 <- subset(teamtraits.clean2,(is.finite(teamtraits.clean2$ErrorRisk_all) & teamtraits.clean2$ErrorRisk_all > 8 & teamtraits.clean2$Trait %in% c("PlantHeight","LeafArea") == F) == FALSE)
```

```r
## Step 2: datasets-by-species against species distribution
teamtraits.clean4 <- teamtraits.clean3 %>% group_by(Trait, AccSpeciesName) %>% dplyr::mutate(
  ndataset = length(unique(SiteName)), 
  mean_species = round(((sum(Value) - Value)/(n()-1)),5), 
  median_species = median(Value),
  sd_species = sd(Value), 
  n_species = n(), 
  ErrorRisk_species = round((abs(Value-mean_species)/sd_species),4),
  ErrorRiskMedian_species = round((abs(Value-median_species)/sd_species),4)) %>% 
  
  group_by(Trait, Genus) %>% dplyr::mutate(
    mean_genus = round(((sum(Value) - Value)/(n()-1)),5),
    median_genus = median(Value),
    sd_genus = sd(Value), 
    n_genus = n(), 
    ErrorRisk_genus = round((abs(Value-mean_genus)/sd_genus),4),
    ErrorRiskMedian_genus = round((abs(Value-median_genus)/sd_genus),4)) %>% 
  
  group_by(Trait, AccSpeciesName, SiteName) %>% dplyr::mutate(
    mean_spdataset = round(((sum(mean_species) - mean_species)/(n()-1)),5), 
    median_spdataset = median(Value),
    sd_spdataset = sd(Value), 
    n_spdataset = n(), 
    ErrorRisk_spdataset = round((abs(mean_spdataset-mean_species)/sd_species),4),
    ErrorRiskMedian_spdataset = round((abs(median_spdataset-median_species)/sd_species),4)) %>% 
  
  group_by(Trait, Genus, SiteName) %>% dplyr::mutate(
    mean_gspdataset = round(((sum(mean_genus) - mean_genus)/(n()-1)),5), 
    median_gspdataset = median(Value),
    sd_gspdataset = sd(Value), 
    n_gdataset = n(), 
    ErrorRisk_gspdataset = round((abs(mean_spdataset-mean_genus)/sd_genus),4),
    ErrorRiskMedian_gspdataset = round((abs(median_spdataset-median_genus)/sd_genus),4))
   
```

```r
# > 4 datasets per species
teamtraits.clean5 <- subset(teamtraits.clean4,(teamtraits.clean4$ndataset >= 4 & 
    is.finite(teamtraits.clean4$ErrorRisk_spdataset) & teamtraits.clean4$ErrorRisk_spdataset > 3) == FALSE) 
    
teamtraits.clean6 <- subset(teamtraits.clean5,(teamtraits.clean5$ndataset >= 1& teamtraits.clean5$ndataset < 4  
    & is.finite(teamtraits.clean5$ErrorRisk_gspdataset) & teamtraits.clean5$ErrorRisk_gspdataset > 3.5)==FALSE)
```

```r
## Step 4: individual records against the species distribution
teamtraits.clean7 <- teamtraits.clean6 %>% group_by(Trait, AccSpeciesName) %>% dplyr::mutate(
  ndataset = length(unique(SiteName)), 
  mean_species = round(((sum(Value) - Value)/(n()-1)),5), 
  mad_species = mad(Value, constant=1), 
  sd_species = sd(Value), n_species = n(), 
  ErrorRisk_species = round((abs(Value-mean_species)/sd_species),4))
```
```r
# 4 - 9 records
teamtraits.clean8 <- subset(teamtraits.clean7,(teamtraits.clean7$n_species >= 4 & teamtraits.clean7$n_species < 10 & is.finite(teamtraits.clean7$ErrorRisk_species) & teamtraits.clean7$ErrorRisk_species > 2.25) == FALSE)

# 10 - 19 records
teamtraits.clean9 <- subset(teamtraits.clean8,(teamtraits.clean8$n_species >= 10 & teamtraits.clean8$n_species < 20 & is.finite(teamtraits.clean8$ErrorRisk_species) & teamtraits.clean8$ErrorRisk_species > 2.75) == FALSE)

# 20 - 29 records
teamtraits.clean10 <- subset(teamtraits.clean9,(teamtraits.clean9$n_species >= 20 & teamtraits.clean9$n_species < 30 & is.finite(teamtraits.clean9$ErrorRisk_species) & teamtraits.clean9$ErrorRisk_species > 3.25) == FALSE)

# >30 records
teamtraits.clean.final <- subset(teamtraits.clean10,(teamtraits.clean10$n_species >= 30 & is.finite(teamtraits.clean10$ErrorRisk_species) & teamtraits.clean10$ErrorRisk_species > 4) == FALSE)

teamtraits.clean <- as.data.frame(teamtraits.clean.final)

#66308
teamtraits.clean_rows <- nrow(teamtraits.clean)
 #66752
teamtraits.clean_long_rows <- nrow(teamtraits.long)
```

```r
ttt.clean <- subset(teamtraits.clean,select = c("IndividualID","AccSpeciesName","OriginalName","Lat","Lon","Altitude","SiteName","SubsiteName","DOY_measured","Year_measured","DataContributor","File.name","Comments","ValueKindName","Trait","TraitPretty","TraitTRY","Value","Units","ErrorRisk_species"))

ttt.clean <- plyr::ddply(ttt.clean, .(Trait, AccSpeciesName), transform, nObsSpp = length(Value[!is.na(Value)]))                                       
```
```r
ttt.clean$ErrorRisk_species[ttt.clean$nObsSpp < 10] <- NA
ttt.save <- subset(ttt.clean,select = c("IndividualID","AccSpeciesName","OriginalName","Lat","Lon","Altitude","SiteName","SubsiteName","DOY_measured","Year_measured","DataContributor","Comments","ValueKindName","TraitTRY","Value","Units","ErrorRisk_species"))
colnames(ttt.save)[which(colnames(ttt.save)=="TraitTRY")] <- "Trait"
colnames(ttt.save)[which(colnames(ttt.save)=="ErrorRisk_species")] <- "ErrorRisk"
colnames(ttt.save)[which(colnames(ttt.save)=="DOY_measured")] <- "DayOfYear"
colnames(ttt.save)[which(colnames(ttt.save)=="Year_measured")] <- "Year"
colnames(ttt.save)[which(colnames(ttt.save)=="Lat")] <- "Latitude"
colnames(ttt.save)[which(colnames(ttt.save)=="Lon")] <- "Longitude"
colnames(ttt.save)[which(colnames(ttt.save)=="Altitude")] <- "Elevation"

ttt.save <- subset(ttt.save,select=c("AccSpeciesName","OriginalName","IndividualID","Latitude","Longitude","Elevation","SiteName","SubsiteName","DayOfYear","Year","DataContributor","ValueKindName","Trait","Value","Units","ErrorRisk","Comments"))
```
cross-checking results against expected values from the original script. 

```r
# 66308 observations
observations <- nrow(ttt.clean) 
# 18 traits
n_traits <- length(unique(ttt.clean$Trait))
# 538 species minus 10 "sp" equals 528 species
n_species <-length(unique(ttt.clean$AccSpeciesName))

# percent of observations with lat/lon info # 0.27 % don't have lat/long
missing_lat_long<- nrow(subset(ttt.clean, is.na(ttt.clean$Lat) | is.na(ttt.clean$Lon)))/nrow(ttt.clean) 
```

```r
# count of unique sites
unique_sites <- length(unique(paste(round(ttt.clean$Lat,1),round(ttt.clean$Lon,1), sep="_"))) # 191
# 198
unique_sites_names <- length(unique(ttt.clean$SiteName))
```

```r
ttt.clean$SiteCode <- paste("Site",round(ttt.clean$Lat,1),round(ttt.clean$Lon,1), sep="_")
# average number of observations per site
obs.per.site <- ddply(ttt.clean, c("SiteCode","Trait"), summarise,count = length(Value[!is.na(Value)]))
```

```r
avg_obs_per_trait_site <- mean(obs.per.site$count) # 141.7 observations per trait per site
med_obs_per_trait_site <- median(obs.per.site$count) # 36.5 median
# 2555 max (plant height at Barrow)
max_obs_per_trait_site <- max(obs.per.site$count) 
# percent of observations on individual
observations_individual <- unique(ttt.clean$ValueKindName)
# 4.7%
percentage_observations_individual_ <- nrow(subset(ttt.clean,ttt.clean$ValueKindName %in% c("Site specific mean","Plot mean","Maximum in plot")))/nrow(ttt.clean) 

ttt.save_nrow <- c(nrow(ttt.save),1)
ttt.save_ncol <- c(ncol(ttt.save) ,1)

```

creating a final dataset with species that have a valid latitude, longitude, year of measurement and that are represented in more than 4 sites. 

```r



filtered_dataset <- subset(ttt.save,(!is.na(ttt.save$Latitude)) & (!is.na(ttt.save$Longitude)) & (!is.na(ttt.save$Year))) # keep only existing Lat and Long with a year

filtered_dataset_nrow <- c(nrow(filtered_dataset),1)
filtered_dataset_ncol <- c(ncol(filtered_dataset) ,1)


# Keep only species represented in more than 4 sites
filtered_dataset <- filtered_dataset %>% group_by(AccSpeciesName) %>% mutate(unique_sites = n_distinct(SiteName))

filtered_dataset_nrow1 <- c(nrow(filtered_dataset),1)
filtered_dataset_ncol1 <- c(ncol(filtered_dataset) ,1)

filtered_dataset <- subset(filtered_dataset,filtered_dataset$unique_sites > 3) # only species present in 4 or more distinct sites

filtered_dataset_nrow2 <- c(nrow(filtered_dataset),1)
filtered_dataset_ncol2 <- c(ncol(filtered_dataset) ,1)

# Get site information, trim by number of observations (> 10)
filtered_dataset$lat_trimmed = round(filtered_dataset$Latitude,digits=2)
filtered_dataset$log_trimmed = round(filtered_dataset$Longitude,digits=2)
```


turn latitude and longitude to indexes.
```r


sites <- select(filtered_dataset, lat_trimmed,log_trimmed,SiteName)

sites_nrow <- c(nrow(sites),1)
sites_ncol <- c(ncol(sites) ,1)

sites <- sites %>% group_by(SiteName,lat_trimmed,log_trimmed) %>% filter(n()>10) 

sites_nrow1 <- c(nrow(sites),1)
sites_ncol1 <- c(ncol(sites) ,1)

rounding <- function(a) round(a,digits = 2)
sites <- na.omit(unique(cbind(sites[3], lapply(sites[1:2], rounding))))

sites_nrow2 <- c(nrow(sites),1)
sites_ncol2 <- c(ncol(sites) ,1)

sites <- arrange(sites,SiteName) 

# Create grid with site indexes
index_pos <- function(n,cnt=90){ # 90 for latitude, 180 for longitude
  dec_part = n%%1
  int_part = floor(n)
  incr = 1
  if (dec_part >= 0.5) {incr = 2}
  return((int_part+cnt)*2+incr)
}
sites$lat_index = index_pos(sites$lat_trimmed)-1
sites$log_index = index_pos(sites$log_trimmed,180)+1

sites_nrow3 <- c(nrow(sites),1)
sites_ncol3 <- c(ncol(sites) ,1)

```

Add latitude and longitude index to the final cleaned dataset. Use these indexes to link the measurements from the monthly temperature data.
A final dataset is created containing all the needed variables for modeling: all tundra traits and the monthly temperature data in the summer (July)
for the locations of each plant.

```r
filtered_dataset_sites <- merge(filtered_dataset, sites, by=c("SiteName","lat_trimmed","log_trimmed"))

filtered_dataset_sites_nrow <- c(nrow(filtered_dataset_sites),1) # Note this final dataset is slightly more aggressivley trimmed than in the paper!
filtered_dataset_sites_ncol <- c(ncol(filtered_dataset_sites) ,1)

sites_ <- select(sites, SiteName,lat_index,log_index)

sites_ <- unique(sites_)
rownames(sites_) <- NULL
sites_["index"] <- c(1:nrow(sites_))

s_nrow4 <- c(nrow(sites_),1)
sites_ncol4 <- c(ncol(sites_) ,1)

filtered_dataset_sites <- merge(filtered_dataset_sites, sites_, by=c("SiteName","lat_index","log_index"))

filtered_dataset_sites_nrow1 <- c(nrow(filtered_dataset_sites),1) # Note this final dataset is slightly more aggressivley trimmed than in the paper!
filtered_dataset_sites_ncol1 <- c(ncol(filtered_dataset_sites) ,1)


## Change commented line to use precipitation rather than temperature data
data_folder <- "401_TMP_monthly_1950_2015" # temperature data
myFiles <- list.files(data_folder, pattern = "*.csv") #all files starting with Climate_
myFiles <- sort(myFiles)

# load time series for mean temperatures (1950-2015)
l <- 2017-1950

ref_month = 7 # July, or 1 for January, etc.

ts <- rep(NA,nrow(sites_)*l)
dim(ts) <- c(nrow(sites_),l)
ts <- data.frame(ts)

# then read them in, for instance through
for (filename in myFiles) {
  year <- as.numeric(substring(filename,nchar(filename)-11,nchar(filename)-8))
  month <- as.numeric(substring(filename,nchar(filename)-7,nchar(filename)-6))
  if (month == ref_month){
    data = read.csv(paste(data_folder, filename, sep = "/"), header = FALSE, skip=45)
    for (row in 1:nrow(sites_)) {
      long_i <- sites_[row,"log_index"]
      lat_i <- sites_[row,"lat_index"]
      data_value <- data[[long_i+1]][[lat_i]]

       if (data_value > -1000){ # note that -10000 is the not observed value for this dataset...
        row_index <- row
        column_index <- year-1949
        ts[row_index,column_index] <- data_value}
    }
  }
}


filtered_dataset.tmp <- NA
# add information to the data frame
for (row in 1:nrow(filtered_dataset_sites)) {
  year_index <- filtered_dataset_sites[row,"Year"]-1949
  if (year_index >= 0 && year_index <= ncol(ts)){
    filtered_dataset_sites[row,"tmp"] <- ts[filtered_dataset_sites[row,"index"],year_index]
  }
}
filtered_dataset_sites_nrow2 <- c(nrow(filtered_dataset_sites),1) # Note this final dataset is slightly more aggressivley trimmed than in the paper!
filtered_dataset_sites_ncol2 <- c(ncol(filtered_dataset_sites) ,1)


filtered_dataset_sites <- subset(filtered_dataset_sites,(!is.na(filtered_dataset_sites$tmp)))

final_filtered_nrow <- c(nrow(filtered_dataset_sites),1) # Note this final dataset is slightly more aggressivley trimmed than in the paper!
final_filtered_ncol <- c(ncol(filtered_dataset_sites) ,1)

# mean-center by species
filtered_dataset_final <- ddply(filtered_dataset_sites, c("AccSpeciesName"), transform, tmp.centered = scale(tmp, center = TRUE, scale = FALSE))
# drop species without sufficient temperature span (irrelevant if before or after centering!)
max_tmp = max(ts, na.rm = TRUE)
min_tmp = min(ts, na.rm = TRUE)
tmp_range_values = (max_tmp - min_tmp)/10

filtered_dataset_final <- filtered_dataset_final %>% group_by(AccSpeciesName) %>% mutate(tmp_range = max(tmp, na.rm = TRUE)-min(tmp, na.rm = TRUE))
filtered_dataset_final <- subset(filtered_dataset_final,filtered_dataset_final$tmp_range>=tmp_range_values)
n_rows_final <- nrow(filtered_dataset_final)
n_rows_cols <- ncol(filtered_dataset_final)


```
# Modelling 

Once the data has been cleaned and aggregated a Bayesian model is fitted using Stan.  
Many different models were tested, but for this notebook we used the pre-determined one found to have the best performance (stan_m3.stan).

Results are visualised to the "Leaf nitrogen (N) content per leaf dry mass" trait.
```r
library(rstan)
library(loo)
library(tidyverse)


rstan_options(auto_write = TRUE)
options(mc.cores = parallel::detectCores())

# choosing a specific Trait
df <- subset(filtered_dataset_final,filtered_dataset_final$Trait == "Leaf nitrogen (N) content per leaf dry mass")

species <- data.frame(unique(df$AccSpeciesName))

colnames(species) <- c("AccSpeciesName")
rownames(species) <- NULL
species["species_index"] <- c(1:nrow(species))

df <- merge(df, species, by = c("AccSpeciesName"))

# Train/Test split
smp_siz = floor(0.80*nrow(df))
set.seed(42)
train_ind = sample(seq_len(nrow(df)), size = smp_siz)
train = df %>% slice(1:train_ind)
test = df %>% slice(train_ind:nrow(df))

# model
model_data <- list(n = nrow(train),s = nrow(species),y = train$Value,tmp = train$tmp.centered,species = train$species_index)

# model 3 removes the normal distribution generating alpha_sd parameters, best model according to diagnostics
fit_3 <- stan(file = 'stan_m3.stan', data = model_data, iter = 1000, chains = 4)
```
After running the fit, predict values on the test set and visualise results.
```r
# parameter values from fit
exp_model <- function(t) {
  return(exp(3.06 + 0.04 * t))
}
# predict from test set
test_line <- lapply(test$tmp.centered, exp_model)
tmp <- test$tmp
Value <-test_line

predicted_df <- data.frame(col1=tmp, col2=as.numeric((unlist(test_line))))
colnames(predicted_df) <- c("tmp","Value")

# visualize fit for  Leaf nitrogen (N) content per leaf dry mass trait
figure3 <- ggplot(df, aes(x = tmp, y = Value)) +
  geom_point() +
  geom_smooth(data = train, method = lm, aes(color = "green")) + geom_smooth(data = test, method = lm, aes(color = "blue")) + geom_smooth(data = predicted_df, method = lm, aes(color = "red")) +
  labs(x = "Temperature", y = "Trait value") + ggtitle("Trait example: Leaf nitrogen (N) content per leaf dry mass (mg/g)") +
  theme(axis.text=element_text(size=18), axis.title=element_text(size=21), plot.title = element_text(size=15, hjust = 0.5)) +
  scale_colour_manual(name="Legend", values=c("green", "blue", "red"), labels = c("Train", "Test", "Predicted from Test")) + guides(fill=TRUE)
```

Visualise results for all different traits.
```r
# visualize all fits
figure2 <- ggplot(df) +
    geom_point(aes(tmp, Value), size = 0.2, shape = 1, alpha = 0.7) +
    geom_smooth(aes(tmp, Value), method = lm, se = FALSE) +
    facet_wrap(~AccSpeciesName, scales = "free_y") +
    labs(x = "Temperature (ºC)", y = "Trait")
```
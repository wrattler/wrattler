# Welcome to Wrattler
```markdown
Tundra analysis
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
teamtraits.clean <- teamtraits.long
```
```r
## Step 1: individual records against the entire distribution (except plant height and leaf area)
teamtraits.clean2 <- teamtraits.clean %>% dplyr::mutate_each(nrow=row_number()) %>% group_by(Trait) %>% dplyr::mutate_each(mean_all = round(((sum(Value) - Value)/(n()-1)),5), n_all = n(), median_all = median(Value),sd_all = sd(Value), ErrorRisk_all = round((abs(Value-mean_all)/sd_all),4),ErrorRiskMedian_all = round((abs(Value-median_all)/sd_all),4))
```


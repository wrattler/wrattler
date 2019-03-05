```r
# tidy data analysis 
library(plyr)
library(dplyr)
# read tidy data
library(readr)
# data visualization
library(ggplot2)

# cleaned dataset from preprocessing
load("TTT_cleaned_dataset.RData")

ttt.save<-ttt.save

table1 <- ddply(ttt.save,~Trait,summarise,
      freq=sum(!is.na(Value)),
      mean=mean(Value, na.rm=TRUE),
      sd=sd(Value, na.rm=TRUE),
      q2.5=quantile(Value, 0.025, na.rm=TRUE),
      median=quantile(Value, 0.5, na.rm=TRUE),
      q97.5=quantile(Value, 0.975, na.rm=TRUE))
```      

Group by site
```r
grouped_ttt <- ttt.save %>%
  group_by(SiteName, Latitude, Longitude) %>%
  summarize(freq = n(), log_freq = log(n())) %>%
  na.omit() %>%
  filter(freq > 10)
```

Figure 1 of the data paper (well, sort of)
```r
library(rworldmap)

newmap <- getMap(resolution = "low")
plot_newmap <-plot(newmap, xlim = c(-40, 40), ylim = c(-20, 90), asp = 1)


plot_points <- points(grouped_ttt$Longitude, grouped_ttt$Latitude, col = "red", cex = (1/3*grouped_ttt$log_freq))


```

```r
library('lattice')
#density_plot<-densityplot(~ Value | Trait, data = ttt.save %>% group_by(Trait) %>% filter(n()>5000), scales=list(x=list(relation="free")), breaks=NULL)
p8 <- ggplot(ttt.by.trait, aes(x = Value)) +
        geom_density(fill = fill, colour = line,
                     alpha = 0.6) +
        scale_x_continuous(name = "Mean ozone in\nparts per billion",
                           breaks = seq(0, 200, 50),
                           limits=c(0, 200)) +
        scale_y_continuous(name = "Density") +
        ggtitle("Density plot of mean ozone") +
        theme_bw() +
        theme(plot.title = element_text(size = 14, family = "Tahoma", face = "bold"),
              text = element_text(size = 12, family = "Tahoma")) +
        facet_grid(. ~ Trait)

```

Figure 3 of the data paper, nicer
```r
require(gridExtra) # also loads grid
grouped_ttt_bytrait <- ttt.save %>% group_by(Trait)

p1 <- densityplot(~ log10(Value), groups = Trait, plot.points = FALSE, auto.key=TRUE, data = grouped_ttt_bytrait[grouped_ttt_bytrait$Trait == "Plant height, vegetative" | grouped_ttt_bytrait$Trait == "Plant height, reproductive",], xlab ="Plant height (log10)")
p2 <- densityplot(~ Value, plot.points = FALSE, data = grouped_ttt_bytrait[grouped_ttt_bytrait$Trait == "Leaf dry mass per leaf fresh mass (Leaf dry matter content, LDMC)",], xlab ="Leaf dry matter content", ylab = "")
p3 <- densityplot(~ log10(Value), plot.points = FALSE, data = grouped_ttt_bytrait[grouped_ttt_bytrait$Trait == "Leaf area",], xlab ="Leaf area (log10)", ylab = "")
p4 <- densityplot(~ Value, plot.points = FALSE, data = grouped_ttt_bytrait[grouped_ttt_bytrait$Trait == "Leaf nitrogen (N) content per leaf dry mass",], xlab ="Leaf nitrogen (N)")
p5 <- densityplot(~ log10(Value), plot.points = FALSE, data = grouped_ttt_bytrait[grouped_ttt_bytrait$Trait == "Seed dry mass",], xlab ="Seed dry mass (log10)", ylab = "")
p6 <- densityplot(~ Value, plot.points = FALSE, data = grouped_ttt_bytrait[grouped_ttt_bytrait$Trait == "Leaf area per leaf dry mass (specific leaf area, SLA)",], xlab ="Specific leaf area", ylab = "")

grid.arrange(p1,p2,p3,p4,p5,p6,ncol=3,nrow=2)
```

Create a site table and geo location index, plus trim poorly represented sites
```r
# get site information, trim by number of observations (> 100)
ttt.save$lat_trimmed = round(ttt.save$Latitude,digits=2)
ttt.save$log_trimmed = round(ttt.save$Longitude,digits=2)
sites <- ttt.save[,c("lat_trimmed","log_trimmed","SiteName")]
#sites <- ddply(sites,~SiteName,summarise,
#      freq=sum(!is.na(SiteName)))
sites <- sites %>% group_by(SiteName,lat_trimmed,log_trimmed) %>% filter(n()>100) #summarise(freq=sum(!is.na(SiteName)))
rounding <- function(a) round(a,digits = 2)
sites <- na.omit(unique(cbind(sites[3], lapply(sites[1:2], rounding))[,1:3]))
sites <- sites[order(sites$SiteName),]

index_pos <- function(n,cnt=90){ # 90 for latitude, 180 for longitude
  dec_part = n%%1
  int_part = floor(n)
  incr = 1
  if (dec_part >= 0.5) {incr = 2}
  return((int_part+cnt)*2+incr)
}
sites$lat_index = index_pos(sites$lat_trimmed)
sites$log_index = index_pos(sites$log_trimmed,180)
```

Load and explore precipitation data
```r
site <- 1 # by position in sites
data_folder <- "datasets/401_PRE_monthly_1950_2015"

lat_i = sites[[4]][site]
long_i = sites[[5]][site]

# load time series for mean temperatures (1950-2015)
l <- 2016-1950
jan_ts_local <- vector(length = l)
apr_ts_local <- vector(length = l)
jun_ts_local <- vector(length = l)
jul_ts_local <- vector(length = l)
spt_ts_local <- vector(length = l)

myFiles <- list.files(data_folder, pattern = "*.csv") #all files starting with Climate_
myFiles <- sort(myFiles)
# then read them in, for instance through
for (filename in myFiles) {
  year <- as.numeric(substring(filename,nchar(filename)-11,nchar(filename)-8))
  month <- as.numeric(substring(filename,nchar(filename)-7,nchar(filename)-6))
  if (month %in% c(1,4,6,7,9)){
    data = read.csv(paste(data_folder, filename, sep = "/"), header = FALSE, skip=45)
    if (month == 1){
      jan_ts_local[year-1950+1] <- data[[long_i+1]][[lat_i]]
    }
    else if (month == 4) {
      apr_ts_local[year-1950+1] <- data[[long_i+1]][[lat_i]]
    }
    else if (month == 6) {
      jun_ts_local[year-1950+1] <- data[[long_i+1]][[lat_i]]
    }
    else if (month == 7) {
      jul_ts_local[year-1950+1] <- data[[long_i+1]][[lat_i]]
    }
    else if (month == 9) {
      spt_ts_local[year-1950+1] <- data[[long_i+1]][[lat_i]]
    }
  }
}
```

Figure S4 from Mayers-Smith et al. 2015
```r
# build data frame
df_ts_local_pre <- data.frame(year=c(1950:2015),january=jan_ts_local,april=apr_ts_local,june=jun_ts_local,july=jul_ts_local,september=spt_ts_local)

# plot time series
require(ggplot2)
require(reshape2)
df <- melt(df_ts_local_pre,  id.vars = 'year', variable.name = 'series')

# plot on same grid, each series colored differently -- 
# good if the series have same scale
ggplot(df, aes(year,value)) + geom_line(aes(colour = series)) + ggtitle("Example of precipitation time series") +
  theme(plot.title = element_text(hjust = 0.5)) + ylab("mm")

```

Load and explore temperature data
```r
site <- 1 # by position in sites
data_folder <- "datasets/401_TMP_monthly_1950_2015"

lat_i = sites[[4]][site]
long_i = sites[[5]][site]

# load time series for mean temperatures (1950-2015)
l <- 2016-1950
jan_ts_local <- vector(length = l)
apr_ts_local <- vector(length = l)
jun_ts_local <- vector(length = l)
jul_ts_local <- vector(length = l)
spt_ts_local <- vector(length = l)

myFiles <- list.files(data_folder, pattern = "*.csv") #all files starting with Climate_
myFiles <- sort(myFiles)
# then read them in, for instance through
for (filename in myFiles) {
  year <- as.numeric(substring(filename,nchar(filename)-11,nchar(filename)-8))
  month <- as.numeric(substring(filename,nchar(filename)-7,nchar(filename)-6))
  if (month %in% c(1,4,6,7,9)){
    data = read.csv(paste(data_folder, filename, sep = "/"), header = FALSE, skip=45)
    if (month == 1){
      jan_ts_local[year-1950+1] <- data[[long_i+1]][[lat_i]]
    }
    else if (month == 4) {
      apr_ts_local[year-1950+1] <- data[[long_i+1]][[lat_i]]
    }
    else if (month == 6) {
      jun_ts_local[year-1950+1] <- data[[long_i+1]][[lat_i]]
    }
    else if (month == 7) {
      jul_ts_local[year-1950+1] <- data[[long_i+1]][[lat_i]]
    }
    else if (month == 9) {
      spt_ts_local[year-1950+1] <- data[[long_i+1]][[lat_i]]
    }
  }
}
```

Figure S1 from Mayers-Smith et al. 2015
```r
# build data frame
df_ts_local_tmp <- data.frame(year=c(1950:2015),january=jan_ts_local,april=apr_ts_local,june=jun_ts_local,july=jul_ts_local,september=spt_ts_local)

# plot time series
require(ggplot2)
require(reshape2)
df <- melt(df_ts_local_tmp,  id.vars = 'year', variable.name = 'series')

# plot on same grid, each series colored differently -- 
# good if the series have same scale
plot_time_series <- ggplot(df, aes(year,value)) + geom_line(aes(colour = series)) + ggtitle("Example of temperature time series") +
  theme(plot.title = element_text(hjust = 0.5)) + ylab("C")

```

Distribution of observation years
```r

hist_year <- qplot(subset(ttt.save,ttt.save$Year>1950)$Year)
```

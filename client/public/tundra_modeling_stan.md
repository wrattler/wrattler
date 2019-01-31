# Welcome to Wrattler
```markdown
Tundra analysis
```

```r
library(rstan)
library(loo)
library(tidyverse)


rstan_options(auto_write = TRUE)
options(mc.cores = parallel::detectCores())

load("filtered_dataset.RData")


df <- subset(filtered_dataset,filtered_dataset$Trait == "Leaf nitrogen (N) content per leaf dry mass")

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

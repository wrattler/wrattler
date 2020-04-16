# Linked data visualizations

```fluid
let year1 = head data;
let energyTypes = map fst (snd (head (snd year1)));
// List (EnergyType, Output) → List(EnergyType', Output)
let addTotal = fun kvs →
   [("Total", sum (map snd kvs)), ...kvs];
// Country → List (Year, List (EnergyType, Output))
let countryData = fun country →
   map (second (compose addTotal (lookup country))) data;
// List Country
let countries = map fst (snd year1) in
   (fun country →
      caption country
         (lineChart True ["black", ...colours1] (fst year1)
            (countryData country)))
   "China"
```


```fluid
let year = 2015;
// List (Country, List (EnergyType, Output)) → List (Country, List (EnergyType, Output))
let exclude = fun countries yearData →
   flip map yearData (second (filter (fun (country, countryData) → not (elem country countries))))
in caption ("Renewables (GW) by country and energy type, " ++ numToStr year)
   (groupedBarChart True colours1 0.2
      (exclude
         [] // ["Geothermal", "Ocean", "CSP"]
         (lookup year data)))
```

```fluid
let year = 2015 in
caption ("Total renewables (GW) by country, " ++ numToStr year)
   (stackedBarChart True colours1 0.2 (lookup year data))
```

# Maps

```javascript
//global loader.js
loadStyle("https://unpkg.com/leaflet@1.6.0/dist/leaflet.css")
loadScript("https://unpkg.com/leaflet@1.6.0/dist/leaflet.js")
loadScript("http://d3js.org/d3.v3.min.js")
loadScript("https://code.jquery.com/jquery-3.4.1.min.js")
```

```javascript
loadInlineStyle(`
.info {
    padding: 6px 8px;
    font-size: 20px;
    font-family: 'Lora', serif;
    background: rgba(255,255,255,0.6);
    box-shadow: 0 0 15px rgba(0,0,0,0.2);
    border-radius: 5px;
    width:200px;
}
.info h4 {
    margin: 0 0 5px;
    color: #777;
    font-family: 'Lora', serif;
    font-style:  italic;
    font-weight: 700;
}
.legend {
    text-align: center;
    line-height: 32px;
    color: #777;
    height: 102px;
}
.legend i {
    width: 18px;
    height: 18px;
    float: left;
    margin-right: 8px;
    opacity: 0.7;
}
.band {
    float: left;
    height: 5px;
    background-color: #c9c9c9;
}
body {
    font-size: 16px;
    font-family: 'Lora', serif;
}
b {
    font-family: 'Lora' !important;
    font-style:  italic;
    font-weight: 700;
}
h1 {
    margin: 0 0 5px;
    color: #000000;
    font-family: 'Lora', serif;
    font-style:  italic;
    font-weight: 700;
    font-size: 20px;
}	
h3 {
    font-family: 'Lora' !important;
    font-style:  italic;
    font-weight: 700;
    color: #3a5a7d;
    text-decoration: underline; 
    font-size: 16px;
}
a:link {
    color: #3a5a7d;
    font-style:  italic;
}
a:visited {
    color: #3a5a7d;
}
a:hover {
    color: #3a5a7d;
    background-color: #d7d7d7;
}
a:active {
    color: #3a5a7d;
    background-color: #d7d7d7;
}
svg {
    position: relative;
}
html, body, #wrapper, #map {
    height: 100%;
}
#wrapper {
    margin-left: 260px;
}
#map {
    float: left;
    width: 100%;
}
#sidebar {
    float: left;
    width: 260px;
    margin-left: -260px;
}
`)
```

okay

```javascript
//local map-helpers.js
addOutput(function (id) {
  if (document.getElementById(id).innerHTML.length > 0) return;
  document.getElementById(id).innerHTML = "<div style='height:500px' id='" + id + "-map'></div>";

  /**
   * Load the csv data containing scenic ratings for particular points across london. 
   * These values are the average rating of ~four viewpoints across 360 degrees per point. 
   * The data is converted to geojson so we can easily extract the coordinates of points, 
   * and the library d3 is used to help display the (~130000) points
   */
  var now_showing=0;
  d3.csv('https://wrattlerdemo.blob.core.windows.net/data/mean_scenic_rating_per_locid_30_10_19.csv', function (error, scenic) {
    var geoData = {type: "FeatureCollection", features: reformat(scenic)};

    var leafletMap = L.map(id + "-map").setView([51.505, -.09], 13);
    var base = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
      });
    leafletMap.addLayer(base);

// svg appends a d3 layer for rendering svg to the leaflet map
    var svg = d3.select(leafletMap.getPanes().overlayPane).append("svg");
    var g = svg.append("g").attr("class", "leaflet-zoom-hide"); // g keeps SVGs grouped together

    function projectPoint(x, y) {
      var point = leafletMap.latLngToLayerPoint(new L.LatLng(y, x));
      this.stream.point(point.x, point.y);
    }

    // Path and transform take regular coords and turn them into svg coords, and
    // those coords are applied back to the leaflet map layer using the current stream (above)
    
    var transform = d3.geo.transform({
      point: projectPoint
    });
    var path = d3.geo.path().projection(transform);

    function redrawSubset(subset) {
      path.pointRadius(2);

      var bounds = path.bounds({
        type: "FeatureCollection",
        features: subset
      });
      var topLeft = bounds[0];
      var bottomRight = bounds[1];

      svg.attr("width", bottomRight[0] - topLeft[0])
        .attr("height", bottomRight[1] - topLeft[1])
        .style("left", topLeft[0] + "px")
        .style("top", topLeft[1] + "px");
      
      g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

      var points = g.selectAll("path")
          .data(subset, function(d) {
            return d.geometry.coordinates;
          })
          .enter()
          .append("path")
          .attr("d", path).attr("class", "point")
          .style("fill", function(d) {return percToColour(d.properties.scenic_rating, 1.5, 6.3)})
          .style("fillOpacity", .8);
    }
    
    function mapmove(e) {
      d3.selectAll(".point").remove();
      redrawSubset(geoData.features);
    }

    /**
     * Next load data containing values for multiple variables per LSOA, so this info can be
     * displayed as we rollover and click on an LSOA. These layers have far fewer points 
     * (1 per LSOA), and so are implemented purely in leaflet
     */

    function highlightFeature(e) {
      var layer = e.target;
      layer.setStyle({
        weight: 1,
        opacity: 1,
        color: '#acadc1',
        dashArray: '',
        fillOpacity: .2
      });
      if (!L.Browser.ie && !L.Browser.opera) {
        layer.bringToFront();
      }
      info.update(layer.feature.properties);
    }

    var lsoaBoundaries;
    function resetHighlight(e) {
      lsoaBoundaries.resetStyle(e.target);
      info.update();
    }

    function displayInfo(e) {
      var layer = e.target;
      now_showing=layer.feature.properties;
      info.update(layer.feature.properties);
    }
    
    function onEachFeature(feature, layer) {
      layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: displayInfo
      });
    }

    $.getJSON("https://wrattlerdemo.blob.core.windows.net/data/lsoa_boundary_and_crime_data_11_11_19.geojson", function(json) {
      lsoaBoundaries = L.geoJson(json, { // boundary data as well as income, health data etc. info to display
        style: function (feature) {
          return {
            fillColor: '#acadc1',
            weight: 1,
            opacity: 0,
            color: 'white',
            fillOpacity: 0
          };
        },
        onEachFeature: onEachFeature
      }).addTo(leafletMap);

      var sceneryLayer = L.geoJson(json, { // scenery layer displaying mean scenic ratings per LSOA
        style: function (feature) {
          return {
            fillColor: percToColour(feature.properties.scenic_rating, 2.16, 4.84),
            weight: 1,
            opacity: 0,
            color: 'white',
            dashArray: '1',
            fillOpacity: .6
          }; 
        }
      });

      var crimeLayer = L.geoJson(json, { // crime layer displaying mean monthly crime counts per LSOA
        style: function (feature) {
          return {
            fillColor: getCrimeColour(feature.properties.mean_monthly_crime_count),
            weight: 1,
            opacity: 0,
            color: 'white',
            dashArray: '1',
            fillOpacity: .4
          }; 
        }
      });

      var d3Layer = L.Class.extend({ // extend leaflet class to toggle on/off d3 layer w/ other leaflet layers
        initialize: function() {
          return;
        },
        onAdd: function() {
          leafletMap.on('viewreset', mapmove); // remove points and redraw relevant subset as we move around map
          redrawSubset(geoData.features); // draw initial susbet in starting position
          scenicPointsLegend.addTo(leafletMap);              
        },
        onRemove: function() {
          leafletMap.off('viewreset', mapmove);
          d3.selectAll(".point").remove();
          leafletMap.removeControl(scenicPointsLegend);
        },
      });
      
      // switch between scenic rating per points vs mean per LSOA vs crime counts
      var baseMaps = {
        "Average Scenic Ratings per LSOA": sceneryLayer,
        "Average Crime Count per Month": crimeLayer,
        "Scenic Points": new d3Layer()
      };
      L.control.layers(baseMaps, null, {position: 'bottomleft', collapsed: false}).addTo(leafletMap);
      leafletMap.attributionControl.addAttribution('Scenic Data &copy; <a href="http://scenicornot.datasciencelab.co.uk/">Scenic-Or-Not</a>');
    });

    /**
     * Then, add and scale info bars (scenic rating and indices of health, income and employment deprivation) 
     * to show when particular LSOA is clicked on. Each variable has been scaled between 1 and 10.
     */
    
    // custom info control
    var info = L.control();
    info.onAdd = function (map) {
      this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
      this.update();
      return this._div;
    };

    // method to update the control based on feature properties passed
    info.update = function (props) {
      var rollover_html=``;
      if ((!props)&&(!now_showing)) {
        rollover_html=`<h4>Click on any LSOA <br />to see region data</h4>`;
      } else if ((props)&&(!now_showing)) {
        rollover_html+=`<h4>Show data for `+props.lsoa11cd+` (`+props.lsoa11nm+`)</h4>`;	
      } else {
        var showingCode = now_showing.lsoa11cd;
        var showingName = now_showing.lsoa11nm;
        var scenicness = getScenicBar(now_showing.scenic_rating);
        var health = getHealthBar(now_showing.deprivation_health_deprivation_and_disability_score);
        var income = getIncomeBar(now_showing.deprivation_income_score_rate);
        var employ = getEmploymentBar(now_showing.deprivation_employment_score_rate);
        var education = getEducationBar(now_showing.deprivation_education_skills_and_training_score);
        var livingEnv = getLivingEnvBar(now_showing.deprivation_living_environment_score);
        var crime = getCrimeColour(now_showing.mean_monthly_crime_count, true);
        rollover_html+=`<b>LSOA: ${showingCode} (${showingName})</b>
                        <br/>Scenicness<br/><div class="band" style="width:${160-scenicness*10*1.6}px; border-left:${scenicness*10*1.6}px solid #a42e3d">&nbsp;</div>
                        Health<br/><div class="band" style="width:${160-health*10*1.6}px; border-left:${health*10*1.6}px solid #a42e3d">&nbsp;</div>
                        Income<br/><div class="band" style="width:${160-income*10*1.6}px; border-left:${income*10*1.6}px solid #a42e3d">&nbsp;</div>
                        Employment<br/><div class="band" style="width:${160-employ*10*1.6}px; border-left:${employ*10*1.6}px solid #a42e3d">&nbsp;</div>
                        Education<br/><div class="band" style="width:${160-education*10*1.6}px; border-left:${education*10*1.6}px solid #a42e3d">&nbsp;</div>
                        Living Environ.<br/><div class="band" style="width:${160-livingEnv*10*1.6}px; border-left:${livingEnv*10*1.6}px solid #a42e3d">&nbsp;</div>
                        Crime<br/><div class="band" style="width:${160-crime*10*1.6}px; border-left:${crime*10*1.6}px solid #a42e3d">&nbsp;</div>`;
        if (props) { // currently hovering over
          rollover_html+=`<br/><h4>Show data for `+props.lsoa11cd+` (`+props.lsoa11nm+`) next?</h4>`;
        }
      }
      this._div.innerHTML =  rollover_html;
    };
    info.addTo(leafletMap);

    var continuousScaleLegend = L.Control.extend({
      initialize: function(min, max) {
        /**
        * @param {Number} min Min value in data (low end of colour scale)
        * @param {Number} max Max value in data (high end of colour scale)
        */
        this._min = min;
        this._max = max;
        return;
      },
      options: {position: 'bottomright'},
      onAdd: function(map) {
        var div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = `Scenicness Rating<br>Min (${this._min}) &emsp;&nbsp; Max (${this._max})`;
        var legend_svg = d3.select(div).append("svg");
        var defs = legend_svg.append("defs");
        var linearGradient = defs.append("linearGradient")
            .attr("id", "linear-gradient");
        linearGradient.append("stop")
          .attr("offset", "0%")
          .attr("stop-color", percToColour(this._min, this._min, this._max));
        linearGradient.append("stop")
          .attr("offset", "100%")
          .attr("stop-color", percToColour(this._max, this._min, this._max));
        legend_svg.append("rect")
          .attr("width", 200)
          .attr("height", 35)
          .style("fill", "url(#linear-gradient)")
          .style("opacity", 0.8);
        return div;
      },
    });
    var scenicPointsLegend = new continuousScaleLegend(1.5, 6.3);
    var scenicLsoaLegend = new continuousScaleLegend(2.1, 4.8);
    
    var crimeLegend = L.control({position: 'bottomright'});
  crimeLegend.onAdd = function (map) {
      var div = L.DomUtil.create('div', 'info legend')
      grades = [55,25,15,7,2]
  label_text = ["> 50","20 - 50","10 - 20","5 - 10","< 5"]
  labels = ['Av. Monthly Crimes'];
  for (var i=0; i<grades.length; i++) {
  labels.push(
    '<i style="background:' + getCrimeColour(grades[i]) + '"></i> ' + label_text[i]);
  }
  div.innerHTML = labels.join('<br>');
      div.style = "height: 200px; width: 135px; line-height: 29px;";
      return div;
  };

    // display appropriate legend as baselayer changes
    leafletMap.on("baselayerchange", function (event) {
      lsoaBoundaries.bringToFront(); // keep lsoa boundary info (health, income scores etc.) at the front
      if (event.name === "Average Crime Count per Month") {
        if (scenicLsoaLegend._map) {
          leafletMap.removeControl(scenicLsoaLegend);
        }
        crimeLegend.addTo(leafletMap);
      } else {
        if (crimeLegend._map) {
          leafletMap.removeControl(crimeLegend);
        }
        if (event.name === "Average Scenic Ratings per LSOA") {
          scenicLsoaLegend.addTo(leafletMap);
        }
        else { // layer change to scenic points
          if (scenicLsoaLegend._map) {
            leafletMap.removeControl(scenicLsoaLegend);
          }
        }
      }
    });

  });
});
```

x
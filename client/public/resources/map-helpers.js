/**
 * Min-max feature scaling: scale a percentage to be between 0-100
 * and return according hex colour, rendering from red to yellow to green. 
 *
 * @param  {Number} perc Percentage to scale
 * @param  {Number} min  Minimum perc value
 * @param  {Number} max  Maximum perc value
 * @return {String}      Scaled hex colour
 */
function percToColour(perc, min, max) {
	if(arguments.length < 3)
	  throw "Insufficient number of parameters passed.";
	
	var a = 0, b = 100;
	perc = a + (perc - min)*(b-a)/(max - min);
	
	var r, g, b = 0;
	if(perc < 50) {
	  r = 255;
	  g = Math.round(5.1 * perc);
	} else {
	  g = 255;
      r = Math.round(510 - 5.10 * perc);
        }
        var h = r * 0x10000 + g * 0x100 + b * 0x1;
	return '#' + ('000000' + h.toString(16)).slice(-6);
}

function reformat(array) {
  var data = [];
  array.map(function (d, i) {
    data.push({
      id: i,
      type: "Feature",
      properties: {
  scenic_rating: d.mean_rating_per_locid,
      },
      geometry: {
  coordinates: [+d.lon, +d.lat],
  type: "Point"
      }
    });
  });
  return data;
}

/**
 * Scale a given mean scenic rating (for an LSOA) to be between 0 and 10, 
 * according to the max and min in the dataset (2.16 and 4.84, respectively).
 *
 * @param  {Number} s_rate Scenic rating to scale
 * @return {Number}        Scaled scenic rating 
 */
function getScenicBar(s_rate) {
  var a = 0, b = 10;
  return a + (s_rate - 2.16)*(b-a)/(4.84 - 2.16);
}

/**
 * Scale a given income rate to be between 0, and 10, according
 * to the max and min in the dataset (.5 and 0, respectively).
 *
 * @param  {Number} inc_rate Income rate to scale
 * @return {Number}          Scaled income rate 
 */
function getIncomeBar(inc_rate) {
  var a = 0, b = 10;
  return b - (a + (inc_rate - 0)*(b-a)/(.5 - 0));
}

/**
 * Scale a given health score to be between 0, and 10, according
 * to the max and min in the dataset (1.8 and -3.2, respectively).
 *
 * @param  {Number} h_score Health to scale
 * @return {Number}         Scaled health score
 */
function getHealthBar(h_score) {
  var a = 0, b = 10;
  return b - (a + ((h_score + 3.2) - 0)*(b-a)/((1.8+3.2) - 0));
}

/**
 * Scale a given employment score to be between 0, and 10, according
 * to the max and min in the dataset (.4 and 0, respectively).
 *
 * @param  {Number} e_score Employment score to scale
 * @return {Number}         Scaled employment score
 */          
function getEmploymentBar(e_score) {
  var a = 0, b = 10;
  return b - (a + (e_score - 0)*(b-a)/(.4 - 0));
}

/**
 * Scale a given education score to be between 0, and 10, according
 * to the max and min in the dataset (64 and 0, respectively).
 *
 * @param  {Number} e_score Education score to scale
 * @return {Number}         Scaled education score
 */          
function getEducationBar(e_score) {
  var a = 0, b = 10;
  return b - (a + (e_score - 0)*(b-a)/(64 - 0));
}

/**
 * Scale a given education score to be between 0, and 10, according
 * to the max and min in the dataset (93.4 and 4, respectively).
 *
 * @param  {Number} e_score Living environment score to scale
 * @return {Number}         Scaled living environment score
 */          
function getLivingEnvBar(e_score) {
  var a = 0, b = 10;
  return b - (a + (e_score - 4)*(b-a)/(93.4 - 4));
}

/**
 * Get the appropariate colour of given number of crimes according
 * to prespecified bins (red- high counts, blue - low counts).
 *
 * @param  {Number} crime_count              Mean num of monthly crime counts
 * @param  {Bool}   [return_integer = false] Optional param to return integer category for crime count 
 * @return {String}                          Hex colour for category of counts
 */
function getCrimeColour(crime_count, return_integer) {
  if (return_integer) {
    return crime_count >= 50 ? 10 :
      crime_count >= 20  ? 7.5 :
      crime_count >= 10  ? 5 :
      crime_count >= 5   ? 2.5 :
      0;
  }
  return crime_count >= 50 ? '#a42e3d' :
    crime_count >= 20  ? '#cb7572' :
    crime_count >= 10  ? '#7fa4b4' :
    crime_count >= 5   ? '#0e4b8d' :
    '#012043';
}

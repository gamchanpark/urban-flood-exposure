
/**
 * 01_flood_exposure.js
 * Cross-city urban flood exposure from open satellite and terrain data.
 *
 * Run in the Google Earth Engine Code Editor: https://code.earthengine.google.com
 * Paste this whole file, edit the CITIES block, press Run, then open the Tasks
 * tab and click RUN on the export task.
 *
 * Output: a CSV in your Google Drive folder `gee_exports`.
 *
 * Method summary
 *   flood-prone  = (height above local minimum < HALM_MAX)
 *                  AND (slope < SLOPE_MAX)
 *                  AND (not permanent surface water)
 *   exposure     = population living inside the flood-prone mask
 *
 * "Height above local minimum" (HALM) is a deliberately simple proxy for HAND
 * (Height Above Nearest Drainage). It needs no flow routing, which makes it
 * reproducible anywhere on Earth with one DEM and one focal operation. Its
 * limitations are stated in docs/METHODS.md.
 *
 * REVISION HISTORY
 *   v1.0  first public version.
 *   v1.1  two corrections after the first live run returned a negative
 *         population total. Both are marked CORRECTION 1 and CORRECTION 2 in
 *         the code below, with the reason kept in place rather than removed.
 *         Every number in the report was produced with v1.1.
 */

// ---------------------------------------------------------------- PARAMETERS
var CITIES = [
  // Dakar, Senegal — Atlantic peninsula; recurrent wet-season flooding in the
  //   low-lying eastern suburbs built on former wetlands. Warm season Sep-Nov.
  {name: 'DAKAR',   lon: -17.4300, lat: 14.7300, radius_km: 20, warm: [9, 10, 11]},
  // Managua, Nicaragua — steep volcanic slopes draining into a lakeside basin;
  //   streets act as channels during the May-Oct rains. Warm season Mar-May
  //   (dry, hot, and far less cloud for Landsat).
  {name: 'MANAGUA', lon: -86.2514, lat: 12.1364, radius_km: 20, warm: [3, 4, 5]},
  // Ulsan, Republic of Korea — reference city. Warm season Jun-Aug.
  {name: 'ULSAN',   lon: 129.3114, lat: 35.5384, radius_km: 20, warm: [6, 7, 8]}
];

var HALM_RADIUS_M = 1000;   // neighbourhood radius for the local minimum
var HALM_MAX      = 5;      // metres above local minimum to call "low-lying"
var SLOPE_MAX     = 5;      // degrees
var POP_YEAR      = 2020;
var SCALE         = 30;     // metres; matches Copernicus DEM
var POP_SCALE     = 100;    // metres; GHS-POP native grid. See CORRECTION 2 below.

// ---------------------------------------------------------------- DATA
var dem = ee.ImageCollection('COPERNICUS/DEM/GLO30').select('DEM').mosaic()
            .setDefaultProjection('EPSG:4326', null, SCALE);

var gsw = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence').unmask(0);

var popRaw = ee.ImageCollection('JRC/GHSL/P2023A/GHS_POP')
               .filterDate(POP_YEAR + '-01-01', (POP_YEAR + 1) + '-01-01')
               .first();

// CORRECTION 1 (2026-07) -- GHS-POP stores no-data over open water as a large
// NEGATIVE value. The first version of this script summed those cells as if they
// were people, which made the population total for Ulsan come out as -17,217,104.
// The error is largest in coastal cities, i.e. exactly the cities this study
// compares. Masking negatives is therefore not cosmetic; without it the
// cross-city comparison is meaningless. The land mask is applied further below,
// once `landMask` is defined.
var pop = popRaw.updateMask(popRaw.gte(0));

var worldcover = ee.ImageCollection('ESA/WorldCover/v200').first().select('Map');

var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
               .filterDate('1991-01-01', '2021-01-01');

// ---------------------------------------------------------------- TERRAIN
var slope = ee.Terrain.slope(dem);

// Height above the lowest point within HALM_RADIUS_M.
var localMin = dem.reduceNeighborhood({
  reducer: ee.Reducer.min(),
  kernel: ee.Kernel.circle(HALM_RADIUS_M, 'meters')
});
var halm = dem.subtract(localMin).rename('halm');

var permanentWater = gsw.gt(50);

var floodProne = halm.lt(HALM_MAX)
                     .and(slope.lt(SLOPE_MAX))
                     .and(permanentWater.not())
                     .rename('flood_prone');

var builtUp = worldcover.eq(50).rename('built_up');

// Land mask. Two of the three cities are coastal, so a circular AOI would
// otherwise put open ocean into the denominator of every area fraction and make
// the coastal city look artificially less flood-prone. All area and population
// statistics below are therefore computed over land only.
var landMask = worldcover.neq(80).and(permanentWater.not()).rename('land');

// Population is counted over land only, for the same reason as above.
pop = pop.updateMask(landMask);

// ---------------------------------------------------------------- RAINFALL
// Rx1day  : mean annual maximum 1-day rainfall, 1991-2020
// R20mm   : mean annual count of days with >= 20 mm
var years = ee.List.sequence(1991, 2020);

var rx1day = ee.ImageCollection(years.map(function (y) {
  return chirps.filter(ee.Filter.calendarRange(y, y, 'year')).max()
               .set('year', y);
})).mean().rename('rx1day_mm');

var r20mm = ee.ImageCollection(years.map(function (y) {
  return chirps.filter(ee.Filter.calendarRange(y, y, 'year'))
               .map(function (img) { return img.gte(20); })
               .sum().set('year', y);
})).mean().rename('r20mm_days');

// ---------------------------------------------------------------- PER CITY
function analyse(city) {
  var aoi = ee.Geometry.Point([city.lon, city.lat]).buffer(city.radius_km * 1000);

  var areaImg      = ee.Image.pixelArea().updateMask(landMask);
  var popExposed   = pop.multiply(floodProne);
  var floodArea    = areaImg.multiply(floodProne);
  var builtArea    = areaImg.multiply(builtUp);

  // Terrain and area statistics are summed at the DEM resolution.
  var sums = areaImg.rename('area_m2')
    .addBands(floodArea.rename('flood_area_m2'))
    .addBands(builtArea.rename('built_area_m2'))
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: SCALE,
      maxPixels: 1e13,
      bestEffort: true
    });

  // CORRECTION 2 (2026-07) -- population MUST be summed at its own native
  // resolution. GHS-POP is a 100 m grid holding a per-cell head count, not a
  // density. Summing it at SCALE = 30 m assigns each cell's full count to every
  // 30 m sub-pixel it contains, i.e. about (100/30)^2 ~ 11 times too many people.
  // The first version of this script did exactly that. After this fix the city
  // totals agree with published populations to within a few per cent, which is
  // the check used to accept the correction.
  var popSums = pop.rename('pop_total')
    .addBands(popExposed.rename('pop_exposed'))
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: POP_SCALE,
      maxPixels: 1e12,
      bestEffort: true
    });

  var means = rx1day.addBands(r20mm).addBands(halm).reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: 1000,
    maxPixels: 1e13,
    bestEffort: true
  });

  var areaM2   = ee.Number(sums.get('area_m2'));
  var floodM2  = ee.Number(sums.get('flood_area_m2'));
  var builtM2  = ee.Number(sums.get('built_area_m2'));
  var popTot   = ee.Number(popSums.get('pop_total'));
  var popExp   = ee.Number(popSums.get('pop_exposed'));

  return ee.Feature(null, {
    city:                 city.name,
    lon:                  city.lon,
    lat:                  city.lat,
    radius_km:            city.radius_km,
    area_km2:             areaM2.divide(1e6),
    floodprone_area_frac: floodM2.divide(areaM2),
    builtup_area_frac:    builtM2.divide(areaM2),
    pop_total:            popTot,
    pop_exposed:          popExp,
    pop_exposed_frac:     popExp.divide(popTot),
    pop_density_km2:      popTot.divide(areaM2.divide(1e6)),
    rx1day_mm:            means.get('rx1day_mm'),
    r20mm_days:           means.get('r20mm_days'),
    halm_mean_m:          means.get('halm'),
    halm_max_threshold:   HALM_MAX,
    slope_max_threshold:  SLOPE_MAX,
    pop_year:             POP_YEAR,
    pop_scale_m:          POP_SCALE,
    terrain_scale_m:      SCALE
  });
}

var results = ee.FeatureCollection(CITIES.map(analyse));
print('Flood exposure results', results);

// ---------------------------------------------------------------- MAP CHECK
// Always look at the mask before trusting the numbers.
var first = CITIES[0];
var aoi0 = ee.Geometry.Point([first.lon, first.lat]).buffer(first.radius_km * 1000);
Map.centerObject(aoi0, 11);
Map.addLayer(dem.clip(aoi0), {min: 0, max: 300, palette: ['#f7f4ea', '#b8a97e', '#6b5b3e']}, 'Elevation');
Map.addLayer(floodProne.selfMask().clip(aoi0), {palette: ['#3B6FB6']}, 'Flood-prone');
Map.addLayer(pop.multiply(floodProne).selfMask().clip(aoi0),
             {min: 0, max: 200, palette: ['#ffe8b3', '#e0a458', '#c1503e']}, 'Exposed population');
Map.addLayer(aoi0, {color: '1F2933'}, 'AOI', false);

// ---------------------------------------------------------------- EXPORT
Export.table.toDrive({
  collection: results,
  description: 'flood_exposure',
  folder: 'gee_exports',
  fileNamePrefix: 'flood_exposure',
  fileFormat: 'CSV'
});

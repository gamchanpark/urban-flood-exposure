/**
 * 03_falsification.js
 * A pre-registered test of whether this method is structurally blind to
 * conveyance-driven flooding.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * In the three-city run, Managua returned a flood-exposed population fraction of
 * about 0.6 %, against 25.9 % for Dakar. Managua floods every wet season. The
 * explanation offered in the report is that Managua drains steep volcanic slopes
 * into a lakeside basin, so its flooding is driven by conveyance -- water moving
 * fast through streets and channels -- while this method only recognises land
 * that is LOW and FLAT. If that explanation is right, the near-zero result is a
 * structural property of the method, not a mistake and not bad luck.
 *
 * But an explanation invented after seeing a number is worth very little. So the
 * prediction is written down here, before the run, and the test is designed so
 * that it can fail.
 *
 * PRE-REGISTERED PREDICTION (recorded 2026-07-31, before execution)
 * -----------------------------------------------------------------
 * P1. Every STEEP city in the list below -- all of them documented as flooding
 *     recurrently -- returns pop_exposed_frac < 5 %.
 * P2. Every FLAT city in the list below returns pop_exposed_frac > 15 %.
 * P3. Across all cities, the Spearman rank correlation between terrain
 *     steepness (steep_area_frac) and pop_exposed_frac is negative and
 *     stronger than -0.7.
 *
 * WHAT WOULD FALSIFY IT
 * ---------------------
 * F1. Any STEEP city returning pop_exposed_frac > 15 %. Then steepness alone
 *     does not suppress the metric, and the Managua result needs another
 *     explanation -- most likely something specific to Managua that I got wrong.
 * F2. Any FLAT city returning < 5 %. Then the metric is not tracking low flat
 *     land at all and the whole comparison is unsafe.
 * F3. A rank correlation weaker than -0.7, or positive. Then the proposed
 *     mechanism does not organise the results and should be withdrawn.
 *
 * If the prediction survives, the honest conclusion is still narrow: the method
 * systematically under-reports flood exposure in steep cities, so its outputs
 * must never be read as a ranking of flood RISK -- only of exposure to the one
 * specific mechanism it can see. If the prediction fails, the Managua paragraph
 * in the report is wrong and must be rewritten.
 *
 * HOW TO RUN
 * ----------
 * Paste into https://code.earthengine.google.com and press Run. If the run times
 * out, set BATCH to 1, run and export, then set BATCH to 2 and run again.
 * Output: CSV in Google Drive folder `gee_exports`.
 *
 * Everything below the CITIES block is copied unchanged from 01_flood_exposure.js
 * (v1.1, including both corrections). That is deliberate: the test is only
 * meaningful if the procedure is identical.
 */

// ---------------------------------------------------------------- PARAMETERS
// group: 'steep' = documented recurrent flooding on high-relief terrain
//        'flat'  = documented recurrent flooding on low-relief terrain
//        'ref'   = reference city, carried over from the main run
var ALL_CITIES = [
  // --- steep, flood-prone -------------------------------------------------
  {name: 'MANAGUA',     lon: -86.2514, lat:  12.1364, group: 'steep', batch: 1},
  {name: 'TEGUCIGALPA', lon: -87.1921, lat:  14.0723, group: 'steep', batch: 1},
  {name: 'MEDELLIN',    lon: -75.5812, lat:   6.2442, group: 'steep', batch: 1},
  {name: 'FREETOWN',    lon: -13.2317, lat:   8.4657, group: 'steep', batch: 1},
  // --- flat, flood-prone --------------------------------------------------
  {name: 'DAKAR',       lon: -17.4300, lat:  14.7300, group: 'flat',  batch: 2},
  {name: 'DHAKA',       lon:  90.4125, lat:  23.8103, group: 'flat',  batch: 2},
  {name: 'JAKARTA',     lon: 106.8456, lat:  -6.2088, group: 'flat',  batch: 2},
  // --- reference ----------------------------------------------------------
  {name: 'ULSAN',       lon: 129.3114, lat:  35.5384, group: 'ref',   batch: 2}
];

var BATCH     = 0;    // 0 = all cities at once; 1 or 2 = run that batch only
var RADIUS_KM = 20;   // identical to the main run

var HALM_RADIUS_M = 1000;
var HALM_MAX      = 5;
var SLOPE_MAX     = 5;
var STEEP_SLOPE   = 10;   // degrees; used only to DESCRIBE terrain, never to classify
var POP_YEAR      = 2020;
var SCALE         = 30;
var POP_SCALE     = 100;

var CITIES = ALL_CITIES.filter(function (c) {
  return BATCH === 0 || c.batch === BATCH;
});

// ---------------------------------------------------------------- DATA
var dem = ee.ImageCollection('COPERNICUS/DEM/GLO30').select('DEM').mosaic()
            .setDefaultProjection('EPSG:4326', null, SCALE);

var gsw = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence').unmask(0);

var popRaw = ee.ImageCollection('JRC/GHSL/P2023A/GHS_POP')
               .filterDate(POP_YEAR + '-01-01', (POP_YEAR + 1) + '-01-01')
               .first();
var pop = popRaw.updateMask(popRaw.gte(0));          // CORRECTION 1

var worldcover = ee.ImageCollection('ESA/WorldCover/v200').first().select('Map');

// ---------------------------------------------------------------- TERRAIN
var slope = ee.Terrain.slope(dem);

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

var builtUp   = worldcover.eq(50).rename('built_up');
var landMask  = worldcover.neq(80).and(permanentWater.not()).rename('land');
pop = pop.updateMask(landMask);

// Terrain descriptors. These are the INDEPENDENT variable of the test. They are
// computed from the DEM alone and never enter the flood-prone classification,
// so the correlation in P3 is not circular.
var steepArea = ee.Image.pixelArea().updateMask(landMask)
                  .multiply(slope.gt(STEEP_SLOPE));

// ---------------------------------------------------------------- PER CITY
function analyse(city) {
  var aoi = ee.Geometry.Point([city.lon, city.lat]).buffer(RADIUS_KM * 1000);

  var areaImg    = ee.Image.pixelArea().updateMask(landMask);
  var popExposed = pop.multiply(floodProne);

  var sums = areaImg.rename('area_m2')
    .addBands(areaImg.multiply(floodProne).rename('flood_area_m2'))
    .addBands(areaImg.multiply(builtUp).rename('built_area_m2'))
    .addBands(steepArea.rename('steep_area_m2'))
    .reduceRegion({
      reducer: ee.Reducer.sum(), geometry: aoi,
      scale: SCALE, maxPixels: 1e13, bestEffort: true
    });

  var popSums = pop.rename('pop_total')
    .addBands(popExposed.rename('pop_exposed'))
    .reduceRegion({
      reducer: ee.Reducer.sum(), geometry: aoi,
      scale: POP_SCALE, maxPixels: 1e12, bestEffort: true   // CORRECTION 2
    });

  var terrain = slope.rename('slope_deg').addBands(halm).reduceRegion({
    reducer: ee.Reducer.mean(), geometry: aoi,
    scale: SCALE, maxPixels: 1e13, bestEffort: true
  });

  // Relief: the 5th-to-95th percentile elevation spread inside the AOI.
  var pct = dem.rename('elev').updateMask(landMask).reduceRegion({
    reducer: ee.Reducer.percentile([5, 50, 95]), geometry: aoi,
    scale: 100, maxPixels: 1e12, bestEffort: true
  });

  var areaM2  = ee.Number(sums.get('area_m2'));
  var floodM2 = ee.Number(sums.get('flood_area_m2'));
  var steepM2 = ee.Number(sums.get('steep_area_m2'));
  var popTot  = ee.Number(popSums.get('pop_total'));
  var popExp  = ee.Number(popSums.get('pop_exposed'));

  return ee.Feature(null, {
    city:                 city.name,
    group:                city.group,
    lon:                  city.lon,
    lat:                  city.lat,
    radius_km:            RADIUS_KM,
    area_km2:             areaM2.divide(1e6),
    // --- the thing being predicted ---
    pop_total:            popTot,
    pop_exposed:          popExp,
    pop_exposed_frac:     popExp.divide(popTot),
    floodprone_area_frac: floodM2.divide(areaM2),
    // --- the terrain descriptors used to predict it ---
    steep_area_frac:      steepM2.divide(areaM2),
    slope_mean_deg:       terrain.get('slope_deg'),
    halm_mean_m:          terrain.get('halm'),
    relief_p95_p05_m:     ee.Number(pct.get('elev_p95')).subtract(pct.get('elev_p5')),
    elev_median_m:        pct.get('elev_p50'),
    // --- provenance ---
    steep_slope_deg:      STEEP_SLOPE,
    halm_max_threshold:   HALM_MAX,
    slope_max_threshold:  SLOPE_MAX,
    pop_scale_m:          POP_SCALE,
    terrain_scale_m:      SCALE,
    pop_year:             POP_YEAR
  });
}

var results = ee.FeatureCollection(CITIES.map(analyse));
print('Falsification test results', results);

// Quick on-screen read of the prediction. Read the printed table as well --
// these two lines are a convenience, not the record.
print('P1/P2 check: pop_exposed_frac by group',
      results.select(['city', 'group', 'pop_exposed_frac', 'steep_area_frac'], null, false));

// ---------------------------------------------------------------- MAP CHECK
// Always look at the mask before trusting a number. On a steep city you should
// see the flood-prone mask collapse into thin ribbons along the valley floors.
var first = CITIES[0];
var aoi0 = ee.Geometry.Point([first.lon, first.lat]).buffer(RADIUS_KM * 1000);
Map.centerObject(aoi0, 11);
Map.addLayer(dem.clip(aoi0), {min: 0, max: 800, palette: ['#f7f4ea', '#b8a97e', '#6b5b3e']}, 'Elevation');
Map.addLayer(slope.clip(aoi0), {min: 0, max: 30, palette: ['#ffffff', '#C1503E']}, 'Slope', false);
Map.addLayer(floodProne.selfMask().clip(aoi0), {palette: ['#3B6FB6']}, 'Flood-prone');
Map.addLayer(pop.multiply(floodProne).selfMask().clip(aoi0),
             {min: 0, max: 200, palette: ['#ffe8b3', '#e0a458', '#c1503e']}, 'Exposed population');

// ---------------------------------------------------------------- EXPORT
Export.table.toDrive({
  collection: results,
  description: 'falsification_test',
  folder: 'gee_exports',
  fileNamePrefix: 'falsification_test' + (BATCH ? '_batch' + BATCH : ''),
  fileFormat: 'CSV'
});

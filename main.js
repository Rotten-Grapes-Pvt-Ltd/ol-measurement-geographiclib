// Changes made to the original code to calculate geodesic distances
// Original code can be found here: https://openlayers.org/en/latest/examples/measure.html
// Reach out at krishna@rottengrapes.tech if you have any questions

import Draw from 'ol/interaction/Draw.js';
import Map from 'ol/Map.js';
import Overlay from 'ol/Overlay.js';
import View from 'ol/View.js';
import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style.js';
import {LineString, Polygon} from 'ol/geom.js';
import {OSM, Vector as VectorSource} from 'ol/source.js';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer.js';
import {getArea, getLength} from 'ol/sphere.js';
import {unByKey} from 'ol/Observable.js';
import { Geodesic } from 'geographiclib-geodesic';;
const geod = Geodesic.WGS84;
const raster = new TileLayer({
  source: new OSM(),
});

const source = new VectorSource();

const vector = new VectorLayer({
  source: source,
  style: {
    'fill-color': 'rgba(255, 255, 255, 0.2)',
    'stroke-color': '#ffcc33',
    'stroke-width': 2,
    'circle-radius': 7,
    'circle-fill-color': '#ffcc33',
  },
});

/**
 * Currently drawn feature.
 * @type {import("../src/ol/Feature.js").default}
 */
let sketch;

/**
 * The help tooltip element.
 * @type {HTMLElement}
 */
let helpTooltipElement;

/**
 * Overlay to show the help messages.
 * @type {Overlay}
 */
let helpTooltip;

/**
 * The measure tooltip element.
 * @type {HTMLElement}
 */
let measureTooltipElement;

/**
 * Overlay to show the measurement.
 * @type {Overlay}
 */
let measureTooltip;

/**
 * Message to show when the user is drawing a polygon.
 * @type {string}
 */
const continuePolygonMsg = 'Click to continue drawing the polygon';

/**
 * Message to show when the user is drawing a line.
 * @type {string}
 */
const continueLineMsg = 'Click to continue drawing the line';

/**
 * Handle pointer move.
 * @param {import("../src/ol/MapBrowserEvent").default} evt The event.
 */
const pointerMoveHandler = function (evt) {
  if (evt.dragging) {
    return;
  }
  /** @type {string} */
  let helpMsg = 'Click to start drawing';

  if (sketch) {
    const geom = sketch.getGeometry();
    if (geom instanceof Polygon) {
      helpMsg = continuePolygonMsg;
    } else if (geom instanceof LineString) {
      helpMsg = continueLineMsg;
    }
  }

  helpTooltipElement.innerHTML = helpMsg;
  helpTooltip.setPosition(evt.coordinate);

  helpTooltipElement.classList.remove('hidden');
};

const map = new Map({
  layers: [raster, vector],
  target: 'map',
  view: new View({
    center: [-115.36519166399995,
      51.09125115300003],//transform([174.7762, -41.2865], 'EPSG:4326', projection),
    zoom: 15,
    projection: "EPSG:4326",
  }),
});

map.on('pointermove', pointerMoveHandler);

map.getViewport().addEventListener('mouseout', function () {
  helpTooltipElement.classList.add('hidden');
});

const typeSelect = document.getElementById('type');

let draw; // global so we can remove it later

// Geodesic calucation for polygon
function getPolygonDetails(geom) {
  var p = geod.Polygon(false),i
  for (i = 0; i < geom.getCoordinates()[0].length; ++i){
    p.AddPoint(geom.getCoordinates()[0][i][1], geom.getCoordinates()[0][i][0]);
  }
  p = p.Compute(false, true);
  return `perimeter = ${p.perimeter} m | area =  ${p.area} m^2.`;
          
  
}


// Geodesic calucation for line
function getLineDetails(geom) {
  const coords = geom.getCoordinates()          
  let length = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        const [lon1, lat1] =coords[i]
        const [lon2, lat2] =coords[i + 1]

        const result = geod.Inverse(lat1, lon1, lat2, lon2);
        length += result.s12; // Distance in meters
    }

    return (`Total length: ${length.toFixed(2)} meters`);
  
}
/**
 * Format length output.
 * @param {LineString} line The line.
 * @return {string} The formatted length.
 */
const formatLength = function (line) {
  const length = getLength(line,{"projection": map.getView().getProjection(), "type": 'geodesic'});
  const geodesic_length = getLineDetails(line);
  return `normal length - ${length} m | Geodesic - ${geodesic_length}`;
};

/**
 * Format area output.
 * @param {Polygon} polygon The polygon.
 * @return {string} Formatted area.
 */
const formatArea = function (polygon) {
  const area = getArea(polygon,{"projection": map.getView().getProjection(), "type": 'geodesic'});
  const area_geos = getPolygonDetails(polygon);
  return `normal area - ${area} m^2. | Geodesic - ${area_geos}`;
};

const style = new Style({
  fill: new Fill({
    color: 'rgba(255, 255, 255, 0.2)',
  }),
  stroke: new Stroke({
    color: 'rgba(0, 0, 0, 0.5)',
    lineDash: [10, 10],
    width: 2,
  }),
  image: new CircleStyle({
    radius: 5,
    stroke: new Stroke({
      color: 'rgba(0, 0, 0, 0.7)',
    }),
    fill: new Fill({
      color: 'rgba(255, 255, 255, 0.2)',
    }),
  }),
});

function addInteraction() {
  const type = typeSelect.value == 'area' ? 'Polygon' : 'LineString';
  draw = new Draw({
    source: source,
    type: type,
    style: function (feature) {
      const geometryType = feature.getGeometry().getType();
      if (geometryType === type || geometryType === 'Point') {
        return style;
      }
    },
  });
  map.addInteraction(draw);

  createMeasureTooltip();
  createHelpTooltip();

  let listener;
  draw.on('drawstart', function (evt) {
    source.clear();
    helpTooltip.setPosition(undefined)
    measureTooltip.setPosition(undefined)
    // set sketch
    sketch = evt.feature;

    /** @type {import("../src/ol/coordinate.js").Coordinate|undefined} */
    let tooltipCoord = evt.coordinate;

    listener = sketch.getGeometry().on('change', function (evt) {
      const geom = evt.target;
      let output;
      if (geom instanceof Polygon) {
        output = formatArea(geom);
        tooltipCoord = geom.getInteriorPoint().getCoordinates();
      } else if (geom instanceof LineString) {
        output = formatLength(geom);
        tooltipCoord = geom.getLastCoordinate();
      }
      measureTooltipElement.innerHTML = output;
      measureTooltip.setPosition(tooltipCoord);
    });
  });

  draw.on('drawend', function (evt) {
    measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
    measureTooltip.setOffset([0, -7]);
    // unset sketch
    sketch = null;
    // unset tooltip so that a new one can be created
    // measureTooltipElement = null;
    // createMeasureTooltip();
    unByKey(listener);
    console.log({
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": {},
          "geometry": {
            "coordinates":evt.feature.getGeometry().getCoordinates()
            ,
            "type": "Polygon"
          }
        }
      ]
    })
  });
}

/**
 * Creates a new help tooltip
 */
function createHelpTooltip() {
  if (helpTooltipElement) {
    helpTooltipElement.remove();
  }
  helpTooltipElement = document.createElement('div');
  helpTooltipElement.className = 'ol-tooltip hidden';
  helpTooltip = new Overlay({
    element: helpTooltipElement,
    offset: [15, 0],
    positioning: 'center-left',
  });
  map.addOverlay(helpTooltip);
}

/**
 * Creates a new measure tooltip
 */
function createMeasureTooltip() {
  if (measureTooltipElement) {
    measureTooltipElement.remove();
  }
  measureTooltipElement = document.createElement('div');
  measureTooltipElement.className = 'ol-tooltip ol-tooltip-measure';
  measureTooltip = new Overlay({
    element: measureTooltipElement,
    offset: [0, -15],
    positioning: 'bottom-center',
    stopEvent: false,
    insertFirst: false,
  });
  map.addOverlay(measureTooltip);
}

/**
 * Let user change the geometry type.
 */
typeSelect.onchange = function () {
  map.removeInteraction(draw);
  addInteraction();
};

addInteraction();

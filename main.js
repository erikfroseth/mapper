var map = null;
var layers = L.featureGroup();
var counter = 1;
var detailLayerId = null;
var DEFAULT_WEIGHT = 2;

var colors = [
  '#e6194b',
  '#3cb44b',
  '#0082c8',
  '#f58231',
  '#911eb4',
  '#46f0f0',
  '#f032e6',
  '#d2f53c',
  '#fabebe',
  '#008080',
  '#e6beff',
  '#aa6e28',
  '#fffac8',
  '#800000',
  '#aaffc3',
  '#808000',
  '#ffd8b1',
  '#000080',
  '#808080',
  '#FFFFFF',
  '#000000'];

$( document ).ready(function()
{
  map = L.map('map').setView([51.505, -0.09], 13);

  // create the tile layer with correct attribution
  var osmUrl='http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  var osmAttrib='Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
  var osm = new L.TileLayer(osmUrl, {minZoom: 1, maxZoom: 30, attribution: osmAttrib});
  map.addLayer(osm);
  map.on('mousemove', mapMouseMove);
  layers.addTo(map);

  var measureControl = L.control.measure({
    'primaryLengthUnit': 'meters',
    'secondaryLengthUnit': 'kilometers',
    'primaryAreaUnit': 'sqmeters'
  });
  measureControl.addTo(map);
});

function mapMouseMove(mouseEvent)
{
  $('#cursorPosition').text('lat ' + mouseEvent.latlng.lat.toFixed(6) + ', lng ' + mouseEvent.latlng.lng.toFixed(6));
}

function addGeometryData()
{
  var geoText = $('#geodata').val();
  var geoJsonObject = null;

  if (getGeometryType(geoText) == 'GeoJSON')
  {
    geoJsonObject = JSON.parse(geoText);
  }
  else if (getGeometryType(geoText) == 'WKT')
  {
    // Create a new Wicket instance
    var wkt = new Wkt.Wkt();
    geoText = geoText.replace(/(\r\n|\n|\r)/gm,"");
    wkt.read(geoText);
    geoJsonObject = wkt.toJson();
  }
  else if (getGeometryType(geoText) == 'GPX')
  {
    geoJsonObject = omnivore.gpx.parse(geoText).toGeoJSON();
  }

  var layer = L.geoJSON(geoJsonObject, {
    pointToLayer: function(geoJsonPoint, latlng)
    { return L.circleMarker(latlng, {'radius': 5}); },
    'style': {'color': colors[counter % colors.length], 'weight': DEFAULT_WEIGHT }
  });

  layer.addTo(layers);
  map.fitBounds(layers.getBounds());

  var geometryDescription = $('#geometryDescription').val().trim();
  layer.description = geometryDescription;

  layer.myid = counter;
  geometryAdded(layer);
  counter++;
}

function getGeometryType(input)
{
  // 18 is the length of "GeometryCollection"
  var trimmedInput = input.trim().substring(0, 18).toUpperCase();
  if (trimmedInput.startsWith('<GPX'))
    return 'GPX';
  else if (trimmedInput.startsWith('{'))
    return 'GeoJSON';
  else if (trimmedInput.startsWith('POINT') ||
           trimmedInput.startsWith('LINESTRING') ||
           trimmedInput.startsWith('POLYGON') ||
           trimmedInput.startsWith('MULTIPOINT') ||
           trimmedInput.startsWith('MULTILINESTRING') ||
           trimmedInput.startsWith('MULTIPOLYGON') ||
           trimmedInput.startsWith('GEOMETRYCOLLECTION'))
    return 'WKT';
}

var markedIndex = null;
var markedLayerId = null;
function geometryAdded(layer)
{
  var item = $('<div class="item header" id="geometryListItem_' + layers.getLayerId(layer) + '" data-layer-id="' + layers.getLayerId(layer) + '"> \
                  <div class="content" data-layer-id="' + layers.getLayerId(layer) + '">' + createGeometryListText(layer.myid, layer.description) + '</div> \
                </div>');
  $(item).hover(hoverStart, hoverEnd);
  $(item).click(geometryClick);
  $('#addedGeometries').append(item);

  layer.eachLayer(function(layer)
  {
    layer.on('mouseover ', function(mouseEvent) {
      mouseEvent.target.setStyle({ 'weight': 4 });
      for (var key in mouseEvent.target._eventParents)
      {
        markedLayerId = key;
        $('div[data-layer-id=' + key + ']').addClass('hover');
      }
    });

    layer.on('mouseout  ', function(mouseEvent) {
      mouseEvent.target.setStyle({ 'weight': DEFAULT_WEIGHT });
      if (markedLayerId !== null)
      {
        $('div[data-layer-id=' + markedLayerId + ']').removeClass('hover');
        markedLayerId = null;
      }
    });
  });
}

function removeCurrent()
{
  if (detailLayerId !== null)
  {
    var layer = layers.getLayer(detailLayerId);
    $('#geometryListItem_' + layers.getLayerId(layer)).remove();
    layer.removeFrom(layers);

    $('#layerDetails').empty();
    detailLayerId = null;
  }
}

function viewCurrent()
{
  if (detailLayerId !== null)
  {
    var layer = layers.getLayer(detailLayerId);
    map.fitBounds(layer.getBounds());
  }
}

function hoverStart(arg)
{
  var geometry = layers.getLayer($(arg.target).attr('data-layer-id'));
  geometry.setStyle({ 'weight': 4 });
  geometry.bringToFront();
}

function hoverEnd(arg)
{
  var geometry = layers.getLayer($(arg.target).attr('data-layer-id'));
  geometry.setStyle({ 'weight': DEFAULT_WEIGHT });
}

function geometryClick(arg)
{
  $('#layerDetails').empty();
  var html = '<div class="ui list" style="height:300px;overflow-y: scroll;">';

  detailLayerId = parseInt($(arg.target).attr('data-layer-id'));
  var geometry = layers.getLayer(detailLayerId);
  $('#geometryDescriptionEditable').val(geometry.description);
  geometry.eachLayer(function(layer) {
    var geometry = layer.feature.geometry;

    html = html + '<div class="item">';
    html = html + '<div class="header">' + geometry.type + '</div>';
    if (geometry.type == 'LineString' || geometry.type == 'MultiPoint')
    {
      html = html + '<div class="ui selection list">';

      bounds = L.latLngBounds(geometry.coordinates[0]);
      for (var i = 0; i < geometry.coordinates.length; ++i)
      {
        var coordinate = geometry.coordinates[i];
        html = html + '<div data-index="' + i + '" class="item" onmouseover="detailMouseEnter(' + coordinate[0] + ',' + coordinate[1] + ');" onmouseleave="detailMouseLeave();">' + i + ': ' + coordinate[0] + ' ' + coordinate[1] + '</div>';
      }
      html = html + '</div>';
    }
    else if (geometry.type == 'Point')
    {
      html = html + '<div class="ui selection list">';
      html = html + '<div class="item" onmouseover="detailMouseEnter(' + geometry.coordinates[0] + ',' + geometry.coordinates[1] + ');" onmouseleave="detailMouseLeave();">' + geometry.coordinates[0] + ' ' + geometry.coordinates[1] + '</div>';
      html = html + '</div>';
    }

    html = html + '</div>';
  });

  html = html + '</div>';

  $('#layerDetails').append(html);
}


var marker = null;
function detailMouseEnter(longitude, latitude)
{
  marker = L.marker([latitude, longitude]).addTo(map);
}

function detailMouseLeave()
{
  marker.removeFrom(map);
}

function descriptionChanged(sender)
{
  if (detailLayerId !== null)
  {
    var newText = $(sender).val();
    var geometry = layers.getLayer(detailLayerId);
    geometry.description = newText;
    $($('#geometryListItem_' + detailLayerId).children()[0]).html(createGeometryListText(geometry.myid, newText));
  }
}

function createGeometryListText(id, description)
{
  if (description == 0)
    return id + ': Geometry #' + id;
  else
    return id + ': ' + description;
}

function getGeoJSON()
{
  if (detailLayerId !== null)
  {
    var geometry = layers.getLayer(detailLayerId);
    $('#geodata').val(JSON.stringify(geometry.toGeoJSON()));
  }
}
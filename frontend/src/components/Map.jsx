/* eslint-disable @stylistic/semi */
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import { useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, FeatureGroup, Polygon, Polyline } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import { DSManager } from '../data_structure.js';
import ReactDOM from 'react-dom';
import '../style.css';
import Alert from '@mui/material/Alert';
import CheckIcon from '@mui/icons-material/Check';
import ColorPicker from './ColorPicker.jsx';

var ds = new DSManager();
var pontos = []
var linhas = []
var poligonos = []
var fimpoints = false
var fimpolygons = false
var fimlines = false

const areCoordinatesEqual = (coords1, coords2) => {
  if (coords1.length !== coords2.length) return false;
  for (let i = 0; i < coords1.length; i++) {
    if (coords1[i][0] !== coords2[i][0] || coords1[i][1] !== coords2[i][1]) {
      return false;
    }
  }
  return true;
};

// eslint-disable-next-line react/prop-types

export default function Map({ file }) {
  if (file != null) {
    file.features.forEach((feature) => {
      if (feature.geometry.type == 'Point' && feature.properties.public_transport == 'stop_position') {
        const [lat, lng] = feature.geometry.coordinates;
        pontos.push([lng, lat]);
      }
      else if (feature.geometry.type == 'LineString') {
        const lineCoords = feature.geometry.coordinates.map(coord => [coord[1], coord[0]]); // Leaflet uses [lat, lng]
        if (lineCoords.length > 0) {
          linhas.push(lineCoords);
        }
      }
      else if (feature.geometry.type == 'Polygon') {
        var polyCoords = feature.geometry.coordinates[0].map(coord => [coord[1], coord[0]]); // Leaflet uses [lat, lng]
        if (polyCoords.length > 1) {
          if (areCoordinatesEqual([polyCoords[0]], [polyCoords[polyCoords.length - 1]])) {
            polyCoords.pop();
          }
          poligonos.push(polyCoords);
        }
      }
    })
  }

  function PopupContent({ id, type, properties, onSave, layer }) {
    const [localProperties, setLocalProperties] = useState(properties);
    const [alert, setAlert] = useState(false);

    const handlePropertiesChange = (key, value) => {
      const newProperties = { ...localProperties };
      newProperties[key] = value;
      setLocalProperties(newProperties);
    };

    const handleKeyChange = (oldKey, event) => {
      const newProperties = { ...localProperties };
      const value = newProperties[oldKey];
      delete newProperties[oldKey];
      newProperties[event.target.value] = value;
      setLocalProperties(newProperties);
    };

    const addNewProperty = () => {
      const newKey = 'new_property_' + Object.keys(localProperties).length;
      setLocalProperties({
        ...localProperties,
        [newKey]: '',
      });
    };

    const handleSave = () => {
      onSave(id, type, localProperties, setAlert);
      setTimeout(() => setAlert(false), 700);
      // Close the popup 0.5 seconds after saving
      setStyle(layer, localProperties)
      setTimeout(() => {
        layer.closePopup();
      }, 500);
    };

    return (
      <div className="w-full">
        {
          alert && (
            <Alert icon={<CheckIcon fontSize="inherit" />} severity="success">
              Properties saved!
            </Alert>
          )
          }
        {
          Object.entries(localProperties).map(([key, value], index) => (
            <div key={index} className="flex p-1">
              <input
                type="text"
                value={key}
                onChange={event => handleKeyChange(key, event)}
                className="text-center w-36 border h-6 rounded-md"
              />
              {(key == 'fillColor' || key == 'color')
              && <ColorPicker chave={key} value={value} func={handlePropertiesChange} />}
              <input
                type="text"
                value={value}
                onChange={event => handlePropertiesChange(key, event.target.value)}
                className="text-center w-36 border ml-3 h-6 rounded-md"
              />
            </div>
          ))
        }
        <div className="buttons flex justify-around p-1">
          <button className=" border-black border-2 rounded-md p-1 hover:bg-green-400 hover:text-white" onClick={addNewProperty}>Add Row</button>
          <button className="border-black border-2 rounded-md p-1 hover:bg-blue-400 hover:text-white" onClick={handleSave}>Save</button>
        </div>
      </div>
    );
  }

  const setStyle = (layer, properties) => {
    console.log(properties)
    for (var key of Object.keys(properties)) {
      try {
        var x = {};
        x[key] = properties[key];
        layer.setStyle(x)
      }
      catch (e) { /* empty */ }
    }
  };

  function Events() {
    const map = useMap();
    useEffect(() => {
      const handleLayerAdd = (event) => {
        const { layer } = event;
        if (layer instanceof L.Marker) {
          let isPointExisting = false
          const markerLat = layer.getLatLng().lat
          const markerLng = layer.getLatLng().lng
          isPointExisting = pontos.some(p => Math.abs(p[0] - markerLat) < 0.0001 && Math.abs(p[1] - markerLng) < 0.0001)
          if (isPointExisting && !fimpoints) {
            var point = ds.addPoint(layer._leaflet_id, layer.getLatLng(), { properties: 'GeoJson Point' })
            createPopup(layer, 'point', point.getProperties());
          }
        }

        if (layer instanceof L.Polyline) {
          const newLineCoords = layer.getLatLngs().map(latlng => [latlng.lat, latlng.lng])
          const isLineExisting = linhas.some(line => areCoordinatesEqual(line, newLineCoords))
          if (isLineExisting && !fimlines) {
            var line = ds.addLine(layer._leaflet_id, layer.getLatLngs(), { properties: 'GeoJson Line', weight: 5, color: '#ff0000' })
            createPopup(layer, 'line', line.getProperties());
            setStyle(layer, line.getProperties())
          }
        }

        if (layer instanceof L.Polygon) {
          const newPolyCoords = layer.getLatLngs()[0].map(latlng => [latlng.lat, latlng.lng])
          const isPolygonExisting = poligonos.some(polygon => areCoordinatesEqual(polygon, newPolyCoords))
          if (isPolygonExisting && !fimpolygons) {
            var polygon = ds.addPolygon(layer._leaflet_id, layer.getLatLngs()[0], { properties: 'GeoJson Polygon', color: '#0000FF', fillColor: '#0000FF' })
            createPopup(layer, 'polygon', polygon.getProperties());
            setStyle(layer, polygon.getProperties())
          }
        }

        if (pontos.length == ds.points.length && !fimpoints && ds.points.length != 0) {
          fimpoints = true
        }

        if (linhas.length == ds.lines.length && !fimlines && ds.lines.length != 0) {
          fimlines = true
        }

        if (poligonos.length == ds.polygons.length && !fimpolygons && ds.polygons.length != 0) {
          fimpolygons = true
        }
      };

      map.on('layeradd', handleLayerAdd)
      return () => {
        map.off('layeradd', handleLayerAdd)
      };
    }, [map]);

    return null;
  }

  const handleSaveProperties = (id, type, properties, setAlert) => {
    updateProperties(id, type, properties);
    setAlert(true);
    setTimeout(() => setAlert(false), 3000)
  };

  const updateProperties = (id, type, properties) => {
    if (type === 'point') {
      const point = ds.findPoint(id);
      point.setProperties(properties);
    }
    else if (type === 'line') {
      const line = ds.findLine(id);
      line.setProperties(properties);
    }
    else if (type === 'polygon') {
      const polygon = ds.findPolygon(id);
      polygon.setProperties(properties);
    }
  };

  const createPopup = (layer, type, properties) => {
    const container = document.createElement('div');
    // eslint-disable-next-line react/no-deprecated
    ReactDOM.render(
      <PopupContent
        id={layer._leaflet_id}
        type={type}
        properties={properties}
        onSave={handleSaveProperties}
        layer={layer} // Pass the layer to PopupContent

      />,
      container,
    );
    layer.bindPopup(container);
  };

  const onCreated = (e) => {
    const { layerType, layer } = e

    if (layerType === 'marker') {
      const point = ds.addPoint(layer._leaflet_id, layer.getLatLng(), { properties: 'New point' });
      createPopup(layer, 'point', point.getProperties());
    }

    if (layerType === 'polyline') {
      const line = ds.addLine(layer._leaflet_id, layer.getLatLngs(), { properties: 'New Line', color: '#0000FF' });
      createPopup(layer, 'line', line.getProperties());
    }

    if (layerType === 'polygon') {
      const polygon = ds.addPolygon(layer._leaflet_id, layer.getLatLngs()[0], { properties: 'New polygon', color: '#0000FF', fillColor: '#0000FF' });
      createPopup(layer, 'polygon', polygon.getProperties());
    }
    console.log('create: ')
    console.log(ds)
  }

  const onEdited = (e) => {
    const editedLayers = e.layers.getLayers()

    editedLayers.forEach((editedLayer) => {
      if (editedLayer instanceof L.Polygon) {
        ds.editPolygon(editedLayer._leaflet_id, editedLayer.getLatLngs()[0])
      }
      else if (editedLayer instanceof L.Polyline) {
        ds.editLine(editedLayer._leaflet_id, editedLayer.getLatLngs())
      }
      else if (editedLayer instanceof L.Marker) {
        ds.editPoint(editedLayer._leaflet_id, editedLayer.getLatLng())
      }
    })

    console.log('edit: ')
    console.log(ds)
  }

  const onDelete = (e) => {
    const removedLayers = e.layers.getLayers()

    removedLayers.forEach((removedLayer) => {
      if (removedLayer instanceof L.Marker) {
        ds.removePoint(removedLayer._leaflet_id)
      }

      if (removedLayer instanceof L.Polyline) {
        ds.removeLine(removedLayer._leaflet_id)
      }

      if (removedLayer instanceof L.Polygon) {
        ds.removePolygon(removedLayer._leaflet_id)
      }
    })
    console.log('delete: ')
    console.log(ds)
  }

  return (
    <MapContainer center={[51.505, -0.09]} zoom={3} scrollWheelZoom={true} className="MapContainer min-w-screen min-h-screen z-0">

      <Events />

      <FeatureGroup>

        <EditControl
          position="topleft"
          onCreated={onCreated}
          onEdited={onEdited}
          onDeleted={onDelete}
          draw={{
            rectangle: false,
            circle: false,
            circlemarker: false,
          }}
        />

        {pontos.map((ponto, i) => (
          <Marker key={i} position={ponto}>
          </Marker>
        ))}
        {linhas.map((linha, i) => (
          <Polyline key={i} positions={linha}>
          </Polyline>
        ))}
        {poligonos.map((poligono, i) => (
          <Polygon key={i} positions={poligono}>
          </Polygon>
        ))}

      </FeatureGroup>

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

    </MapContainer>

  )
}

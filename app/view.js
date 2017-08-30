import L from 'leaflet'
import { MapApi } from './api'
import { Search } from './search'

export class ViewController {
  constructor (mapId = 'mapid') {
    this.map = L.map(mapId, {
      center: [ 5, 20 ],
      zoom: 4,
      maxZoom: 10,
      minZoom: 4,
      maxBounds: [ [ 50, -30 ], [ -45, 100 ] ]
    })
    this.api = new MapApi()
    this.layers = { }
    this.selectedRegion = null
  }

  icon (iconUrl, iconSize = [ 24, 56 ]) {
    return L.icon({ iconUrl, iconSize })
  }

  async loadMapData () {
    L.tileLayer(
      'https://cartocdn-ashbu.global.ssl.fastly.net/ramirocartodb/api/v1/map/named/tpl_756aec63_3adb_48b6_9d14_331c6cbc47cf/all/{z}/{x}/{y}.png', {
        crs: L.CRS.EPSG4326
      }).addTo(this.map)

    const iconBaseURL = 'https://cdn.patricktriest.com/icons/atlas_of_thrones/'
    const locations = [
      [ 'castle', this.icon(`${iconBaseURL}castle.svg`) ],
      [ 'city', this.icon(`${iconBaseURL}city.svg`) ],
      [ 'town', this.icon(`${iconBaseURL}village.svg`) ],
      [ 'ruin', this.icon(`${iconBaseURL}ruin.svg`) ],
      [ 'landmark', this.icon(`${iconBaseURL}misc.svg`) ]
    ]

    let searchbase = []

    for (let location of locations) {
      let [ name, icon ] = location
      const geojson = await this.api.getLocations(name)
      searchbase = searchbase.concat(geojson.map((entry) => entry.properties))
      this.layers[name] = await this.addLocationGeojson(geojson, icon)
    }

    const boundaries = await this.api.getPoliticalBoundaries()
    searchbase = searchbase.concat(boundaries.map((entry) => {
      return Object.assign({ type: 'Kingdom' }, entry.properties)
    }))

    this.layers.boundaries = this.addBoundaryGeojson(boundaries)

    this.search = new Search(searchbase)

    this.toggleLayer('city')
    this.toggleLayer('town')
    this.toggleLayer('boundaries')
  }

  async showInfo (name, id, type) {
    const infoTitle = document.getElementById('info-title')
    infoTitle.innerHTML = `<h1>${name}</h1>`

    const infoContent = document.getElementById('info-content')
    infoContent.innerHTML = ''
    let info = {}

    if (id && type === 'regions') {
      let size = await this.api.getRegionSize(id)
      let sizeStr = size.toLocaleString(undefined, { maximumFractionDigits: 0 })
      console.log(sizeStr)
      infoContent.innerHTML += `<div>Size: ${sizeStr} km^2 (estimate)</div>`

      let castles = await this.api.getCastleCount(id)
      infoContent.innerHTML += `<div>Castles: ${castles}</div>`

      info = await this.api.getRegionDetails(id)
    } else {
      info = await this.api.getLocationDetails(id)
    }

    infoContent.innerHTML += `<div>${info.summaryText}  <a href="${info.url}" target="_blank" rel="noopener">Read More...</a></div>`

    // Show info window if hidden, and on desktop
    const infoContainer = document.getElementsByClassName('info-container')[0]
    if (!infoContainer.classList.contains('info-active') && window.innerWidth > 600) {
      this.toggleInfo()
    }
  }

  async addLocationGeojson (locations, icon) {
    const properties = {}
    properties.pointToLayer = function (feature, latlng) {
      return L.marker(latlng, { icon, title: feature.properties.name })
    }

    properties.onEachFeature = (feature, layer) => {
      layer.bindPopup(feature.properties.name, { closeButton: false })
      layer.on({
        click: async (e) => {
          this.showInfo(feature.properties.name, feature.properties.id, 'location')
          this.setHighlightedRegion(null)
        }
      })
    }

    return L.geoJSON(locations, properties)
  }

  addBoundaryGeojson (geojson) {
    const properties = {}
    properties.onEachFeature = (feature, layer) => {
      layer.on({
        click: async (e) => {
          this.showInfo(feature.properties.name, feature.properties.id, 'regions')
          this.setHighlightedRegion(layer)
        }
      })
    }

    return L.geoJSON(geojson, properties)
  }

  setHighlightedRegion (layer) {
    if (this.selected) {
      this.layers.boundaries.resetStyle(this.selected)
    }

    this.selected = layer
    if (this.selected) {
      this.selected.bringToFront()
      this.selected.setStyle({
        'color': 'red'
      })
    }
  }

  toggleInfo () {
    const infoContainer = document.getElementsByClassName('info-container')[0]
    infoContainer.classList.toggle('info-active')
  }

  toggleLayer (layerName) {
    const layer = this.layers[layerName]
    const button = document.getElementById(`${layerName}-toggle`)
    button.classList.toggle('toggle-active')

    if (this.map.hasLayer(layer)) {
      this.map.removeLayer(layer)
    } else {
      this.map.addLayer(layer)
    }
  }
}

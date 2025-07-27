mapboxgl.accessToken = 'pk.eyJ1IjoiamVycnljYXNobW9uZXkiLCJhIjoiY2w1anp5cmkwMDU5eTNpbHYyNHg2emc3eiJ9.KeRpsiBDWF8fht48TTFOZQ';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  zoom: 15,
  center: [0, 0],
});

const requestOrientation = async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const response = await DeviceOrientationEvent.requestPermission();
      if (response === 'granted') {
        window.addEventListener('deviceorientationabsolute', handleOrientation);
        // window.addEventListener('deviceorientation', handleOrientation);
        document.getElementById('enable-orientation').style.display = 'none';
      } else {
        alert('Permission denied for device orientation');
      }
    } catch (e) {
      alert('Error requesting permission for device orientation');
      console.error(e);
    }
  } else {
    // For non-iOS devices (or Android Chrome)
    window.addEventListener('deviceorientationabsolute', handleOrientation);
    window.addEventListener('deviceorientation', handleOrientation);
    console.log('Compass enabled');
  }
}


let pois = [];
let poiMarkers = [];
let userLocation = null;
let nearestPOI = null;
let heading = null;
let smoothedHeading = null;
const smoothingFactor = 0.15;
const compassDiv = document.getElementById('compass');
const arrow = document.getElementById('arrow');

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getNearestPOI(pos) {
  if (!pois.length) return null;
  return pois.reduce((a, b) => {
    const distA = haversine(pos.coords.latitude, pos.coords.longitude, a.coords[1], a.coords[0]);
    const distB = haversine(pos.coords.latitude, pos.coords.longitude, b.coords[1], b.coords[0]);
    return distA < distB ? a : b;
  });
}

function updateArrowDirection() {
  if (!heading || !userLocation || !nearestPOI) return;

  const user = userLocation.coords;
  const dx = nearestPOI.coords[0] - user.longitude;
  const dy = nearestPOI.coords[1] - user.latitude;
  const angleToPOI = Math.atan2(dy, dx) * 180 / Math.PI;

  console.log('Angle: ', angleToPOI);
  

  console.log(heading, angleToPOI)
  const rotation = angleToPOI - heading;
  arrow.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
}

function renderPOIMarkers(userLat, userLng) {
  poiMarkers.forEach(marker => marker.remove());
  poiMarkers = [];
  pois.forEach(poi => {
    const dist = Math.round(haversine(userLat, userLng, poi.coords[1], poi.coords[0]));
    const el = document.createElement('div');
    el.style.background = 'red';
    el.style.width = '12px';
    el.style.height = '12px';
    el.style.borderRadius = '50%';
    const popup = new mapboxgl.Popup({ offset: 25 }).setText(`${poi.name} (${dist} m)`);
    const marker = new mapboxgl.Marker(el).setLngLat(poi.coords).setPopup(popup).addTo(map);
    poiMarkers.push(marker);
  });
}

async function fetchAndRenderPOIs(lat, lng) {
  const category = document.getElementById('category').value;
  const maxDistance = 5000;
  const params = new URLSearchParams({ lat, lng, category, maxDistance });
  const res = await fetch(`http://localhost:3000/api/pois?${params}`);
  pois = await res.json();
  nearestPOI = getNearestPOI({ coords: { latitude: lat, longitude: lng } });
  updateArrowDirection();
  renderPOIMarkers(lat, lng);
}

document.getElementById('category').addEventListener('change', () => {
  if (userLocation) {
    const { latitude, longitude } = userLocation.coords;
    fetchAndRenderPOIs(latitude, longitude);
  }
});

navigator.geolocation.watchPosition((pos) => {
  userLocation = pos;
  const { latitude, longitude } = pos.coords;
  new mapboxgl.Marker({ color: 'blue' }).setLngLat([longitude, latitude]).addTo(map);
  map.setCenter([longitude, latitude]);
  fetchAndRenderPOIs(latitude, longitude);
});

function handleOrientation(event) {
  if (!event.alpha) return;
  const rawHeading = event.alpha;
  if (smoothedHeading === null) {
    smoothedHeading = rawHeading;
  } else {
    smoothedHeading = smoothedHeading * (1 - smoothingFactor) + rawHeading * smoothingFactor;
  }
  heading = smoothedHeading;
  compassDiv.innerText = `Heading: ${Math.round(heading)}°`;

  updateArrowDirection();
}

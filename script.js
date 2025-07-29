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
        window.addEventListener('deviceorientation', handleOrientation);

        document.getElementById('enable-orientation').style.display = 'none';
        arrow.style.display = 'flex';
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

    document.getElementById('enable-orientation').style.display = 'none';
    arrow.style.display = 'flex';
  }
}


// let pois = [];
const pois = [
	{ name: "Vitosha Boulevard", coords: [23.3189, 42.6934], category: "shopping" },
	{ name: "National Palace of Culture (NDK)", coords: [23.3199, 42.6863], category: "landmark" },
	{ name: "Alexander Nevsky Cathedral", coords: [23.3325, 42.6957], category: "church" },
	{ name: "Sofia University", coords: [23.3358, 42.6932], category: "education" },
	{ name: "Borisova Gradina Park", coords: [23.3421, 42.6859], category: "park" },
	{ name: "Paradise Center", coords: [23.3056, 42.6584], category: "mall" },
	{ name: "Serdika Center", coords: [23.3447, 42.6847], category: "mall" },
	{ name: "Sofia Zoo", coords: [23.3380, 42.6480], category: "zoo" }
];
let poiMarkers = [];
let userLocation = null;
let nearestPOI = null;
let heading = null;
let smoothedHeading = null;
const smoothingFactor = 0.15;
const arrow = document.getElementById('arrow-component');

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
  }); // TODO: Return distance as well
}

function bearingBetweenPoints(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const toDeg = rad => rad * 180 / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  let brng = Math.atan2(y, x);
  brng = toDeg(brng);
  return (brng + 360) % 360;
}

function updateArrowDirection() {
  if (!heading || !userLocation || !nearestPOI) return;

  const user = userLocation.coords;
  const poi = nearestPOI.coords;

  const bearingToPOI = bearingBetweenPoints(user.latitude, user.longitude, poi[1], poi[0]);
  let rotation = bearingToPOI - heading;

  // arrow.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
  arrow.style.transform = `rotate(${rotation}deg)`;
  console.log('rotation: ', rotation);

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
  // const category = document.getElementById('category').value;
  // const maxDistance = 5000;
  // const params = new URLSearchParams({ lat, lng, category, maxDistance });
  // // const res = await fetch(`http://localhost:3000/api/pois?${params}`);
  // const res = await fetch(`https://192.168.0.104:3000/api/pois?${params}`);
  // pois = await res.json();
  nearestPOI = getNearestPOI({ coords: { latitude: lat, longitude: lng } });
  updateArrowDirection();
  renderPOIMarkers(lat, lng);
}

// document.getElementById('category').addEventListener('change', () => {
//   if (userLocation) {
//     const { latitude, longitude } = userLocation.coords;
//     fetchAndRenderPOIs(latitude, longitude);
//   }
// });

navigator.geolocation.watchPosition((pos) => {
  userLocation = pos;
  const { latitude, longitude } = pos.coords;
  new mapboxgl.Marker({ color: 'blue' }).setLngLat([longitude, latitude]).addTo(map);
  map.setCenter([longitude, latitude]);
  fetchAndRenderPOIs(latitude, longitude);
});

function handleOrientation(event) {
  if (event.webkitCompassHeading !== undefined) {

    heading = event.webkitCompassHeading;
  } else if (event.alpha !== null) {
    const rawHeading = 360 - event.alpha;
    if (smoothedHeading === null) {
      smoothedHeading = rawHeading;
    } else {
      smoothedHeading = smoothedHeading * (1 - smoothingFactor) + rawHeading * smoothingFactor;
    }
    heading = smoothedHeading;
  } else {
    return;
  }

  // compassDiv.innerText = `Heading: ${Math.round(heading)}°`;
  updateArrowDirection();
}
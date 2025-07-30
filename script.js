mapboxgl.accessToken = 'pk.eyJ1IjoiamVycnljYXNobW9uZXkiLCJhIjoiY2w1anp5cmkwMDU5eTNpbHYyNHg2emc3eiJ9.KeRpsiBDWF8fht48TTFOZQ';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  zoom: 15,
  center: [0, 0],
});

let ORIENTATION_ACCESS = false;

const requestOrientation = async () => {
  if(ORIENTATION_ACCESS) return;
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const response = await DeviceOrientationEvent.requestPermission();
      if (response === 'granted') {
        window.addEventListener('deviceorientationabsolute', handleOrientation);
        window.addEventListener('deviceorientation', handleOrientation);

        document.getElementById('enable-orientation').style.display = 'none';
        arrow.style.display = 'flex';

        ORIENTATION_ACCESS = true;
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

    ORIENTATION_ACCESS = true;
  }
}


// CATEGORIES: alc, food, club

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
const pulse = document.getElementById('pulse');
const headingText = document.getElementById('heading-text');
const distanceText = document.getElementById('distance-text');
const debug = document.getElementById('debug')

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
    return distA < distB ?  a : b;
  });
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
  console.log(bearingToPOI, heading);

  let rotation = bearingToPOI - heading;
  if (rotation < 0) rotation = 360 + rotation;

  arrow.style.transform = `rotate(${rotation}deg)`;

  if(rotation > 20 && rotation < 340) {
    pulse.style.setProperty('--pulse-bg-gradient', 'rgb(218, 205, 27) 50%');

    if(rotation > 60 && rotation < 300) {
      pulse.style.setProperty('--pulse-bg-gradient', 'rgba(214, 17, 17, 1) 50%');
    }
  } else {
    pulse.style.setProperty('--pulse-bg-gradient', 'rgb(83, 192, 128) 50%');
  }
}

function renderPOIMarkers(userLat, userlon) {
  poiMarkers.forEach(marker => marker.remove());
  poiMarkers = [];
  pois.forEach(poi => {
    const dist = Math.round(haversine(userLat, userlon, poi.coords[1], poi.coords[0]));

    const el = document.createElement('div');
    el.style.background = 'red';
    el.style.width = '12px';
    el.style.height = '12px';
    el.style.borderRadius = '50%';

    const popup = new mapboxgl.Popup({ offset: 25 }).setText(`${poi.name} (${dist} m)`);
    const marker = new mapboxgl.Marker(el).setlonLat(poi.coords).setPopup(popup).addTo(map);

    poiMarkers.push(marker);
  });
}

function recalculateDistance(lat, lon) {
  console.log(nearestPOI);

  let dist = Math.round(haversine(lat, lon, nearestPOI.coords[1], nearestPOI.coords[0]));

  if(dist > 1000) {
    dist = (dist / 1000).toFixed(2) + 'км';
  } else {
    dist = dist + 'м';
  }

  distanceText.innerText = 'Разстояние: ' + dist;
}

async function renderPOIs(lat, lon) {
  nearestPOI = getNearestPOI({ coords: { latitude: lat, longitude: lon } });
  updateArrowDirection();
  recalculateDistance(lat, lon);
  // renderPOIMarkers(lat, lon);
}

navigator.geolocation.watchPosition((pos) => {
  userLocation = pos;
  const { latitude, longitude } = pos.coords;
  renderPOIs(latitude, longitude);
  recalculateDistance(latitude, longitude);
});

function formatHeading(heading) {
  const dirs = ["С", "СИ", "И", "ЮИ", "Ю", "ЮЗ", "З", "СЗ"];
  const formatted = heading + '°' + ' ' + dirs[Math.round(heading / 45) % 8];

  return formatted;
}

function handleOrientation(event) {
  if (event.webkitCompassHeading !== undefined) {
    heading = event.webkitCompassHeading;
  }
  else if (event.alpha !== null) {
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

  heading = Math.round(heading);
  if(heading == 360) heading = 0;

  const formattedHeading = formatHeading(heading);

  headingText.innerText = `Направление: ${formattedHeading}`;
  updateArrowDirection();
}
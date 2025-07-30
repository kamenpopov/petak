let ORIENTATION_ACCESS = false;

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => el.querySelectorAll(sel);

const homeButtons = $$('.home-button');

let CATEGORY = '';

homeButtons.forEach(e => {
  e.addEventListener('click', ev => {
    requestOrientation();
    CATEGORY = e.id;
  });
});

let userLocation = null;
let nearestPOI = null;
let heading = null;
let smoothedHeading = null;
const smoothingFactor = 0.15;

const arrow = document.getElementById('arrow-component');
const cross = document.getElementById('cross-component');
const arrowPulse = document.getElementById('arrow-pulse');
const headingText = document.getElementById('heading-text');
const distanceText = document.getElementById('distance-text');
const goingToText = document.getElementById('going-to-text');

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getNearestPOI(pos) {
  if (POIS.length == 0) return null;

  if(CATEGORY == 'rand') {
    return POIS[Math.floor(Math.random() * POIS.length)];
  }

  const searchablePOIs = POIS.filter(p => p.category == CATEGORY);
  if(searchablePOIs.length == 0) return null;

  return searchablePOIs.reduce((a, b) => {
    const distA = haversine(pos.coords.latitude, pos.coords.longitude, a.coords[0], a.coords[1]);
    const distB = haversine(pos.coords.latitude, pos.coords.longitude, b.coords[0], b.coords[1]);
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

  const bearingToPOI = bearingBetweenPoints(user.latitude, user.longitude, poi[0], poi[1]);
  console.log(bearingToPOI, heading);

  let rotation = bearingToPOI - heading;
  if (rotation < 0) rotation = 360 + rotation;

  arrow.style.transform = `rotate(${rotation}deg)`;

  if(rotation > 20 && rotation < 340) {
    arrowPulse.style.setProperty('--arrow-pulse-bg-gradient', 'rgb(218, 205, 27) 50%');

    if(rotation > 60 && rotation < 300) {
      arrowPulse.style.setProperty('--arrow-pulse-bg-gradient', 'rgba(214, 17, 17, 1) 50%');
    }
  } else {
    arrowPulse.style.setProperty('--arrow-pulse-bg-gradient', 'rgb(83, 192, 128) 50%');
  }
}

function recalculateDistance(lat, lon) {
  let dist = Math.round(haversine(lat, lon, nearestPOI.coords[0], nearestPOI.coords[1]));

  if(dist > 1000) {
    dist = (dist / 1000).toFixed(2) + 'км';
  } else {
    dist = dist + 'м';
  }

  distanceText.innerText = 'Разстояние: ' + dist;
}

async function findPOI(lat, lon) {
  nearestPOI = getNearestPOI({ coords: { latitude: lat, longitude: lon }});

  if(!nearestPOI) {
    headingText.innerText = 'За жалост няма такова в момента...';
    arrow.style.display = 'none';
    cross.style.display = 'flex';
    return;
  }

  goingToText.innerText = "Отиваш към: " + nearestPOI.name;

  updateArrowDirection();
  recalculateDistance(lat, lon);
}

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

function enableGeolocation() {
  navigator.geolocation.watchPosition((pos) => {
    userLocation = pos;
    const { latitude, longitude } = pos.coords;
    findPOI(latitude, longitude);
    recalculateDistance(latitude, longitude);
  });
}

const requestOrientation = async () => {
  if(ORIENTATION_ACCESS) return;
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const response = await DeviceOrientationEvent.requestPermission();
      if (response === 'granted') {
        window.addEventListener('deviceorientationabsolute', handleOrientation);
        window.addEventListener('deviceorientation', handleOrientation);

        homeButtons.forEach(e => e.style.display = 'none');
        arrow.style.display = 'flex';

        enableGeolocation();

        ORIENTATION_ACCESS = true;
      } else {
        alert('Permission denied for device orientation');
      }
    } catch (e) {
      alert('Error requesting permission for device orientation');
      console.error(e);
    }
  } else {
    // For non-iOS devices
    window.addEventListener('deviceorientationabsolute', handleOrientation);
    window.addEventListener('deviceorientation', handleOrientation);

    homeButtons.forEach(e => e.style.display = 'none');
    arrow.style.display = 'flex';

    enableGeolocation();

    ORIENTATION_ACCESS = true;
  }
}
let headingHistory = [];
const MAX_HISTORY = 10;
let userLat = null;
let userLng = null;
let poi = null;

// Degrees to radians
const toRad = deg => deg * Math.PI / 180;
// Radians to degrees
const toDeg = rad => rad * 180 / Math.PI;

// Smooth heading using a moving average
function smoothHeading(alpha) {
  headingHistory.push(alpha);
  if (headingHistory.length > MAX_HISTORY) {
    headingHistory.shift();
  }
  const sum = headingHistory.reduce((a, b) => a + b, 0);
  return sum / headingHistory.length;
}

// Calculate bearing from user to POI
function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Update arrow based on compass and POI
function updateArrow(smoothedAlpha) {
  if (!poi || userLat === null || userLng === null) return;

  const poiBearing = calculateBearing(userLat, userLng, poi.coords[1], poi.coords[0]);
  const relativeBearing = (poiBearing - smoothedAlpha + 360) % 360;

  const arrow = document.getElementById('direction-arrow');
  arrow.style.transform = `rotate(${relativeBearing}deg)`;
}

// DeviceOrientation handler
function handleOrientation(event) {
  const alpha = event.alpha;
  if (alpha === null) return;

  const smoothed = smoothHeading(alpha);
  updateArrow(smoothed);
}

// Fetch nearest POI
async function fetchNearestPOI() {
  const res = await fetch(`/api/pois?lat=${userLat}&lng=${userLng}&maxDistance=5000`);
  const data = await res.json();
  if (data.length > 0) {
    poi = data[0];
    console.log("Target POI:", poi);
  }
}

// Get user location
function getLocation() {
  navigator.geolocation.watchPosition(pos => {
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;
    fetchNearestPOI();
  });
}

// Setup on user permission
document.getElementById('enable-orientation').addEventListener('click', async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const response = await DeviceOrientationEvent.requestPermission();
      if (response === 'granted') {
        window.addEventListener('deviceorientationabsolute', handleOrientation);
        window.addEventListener('deviceorientation', handleOrientation);
        document.getElementById('enable-orientation').style.display = 'none';
        getLocation();
      } else {
        alert('Permission denied');
      }
    } catch (err) {
      alert('Permission request failed');
    }
  } else {
    // For Android / non-iOS
    window.addEventListener('deviceorientationabsolute', handleOrientation);
    window.addEventListener('deviceorientation', handleOrientation);
    document.getElementById('enable-orientation').style.display = 'none';
    getLocation();
  }
});

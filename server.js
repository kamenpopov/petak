const express = require('express');
const cors = require('cors');
const app = express();
const https = require('https');
const fs = require('fs');
const PORT = process.env.PORT || 3000;

const privateKey = fs.readFileSync('./certs/key.pem', 'utf8');
const certificate = fs.readFileSync('./certs/cert.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

// Sample POIs – in production, you'd query a real database or API
const samplePOIs = [
	{ name: "Vitosha Boulevard", coords: [23.3189, 42.6934], category: "shopping" },
	{ name: "National Palace of Culture (NDK)", coords: [23.3199, 42.6863], category: "landmark" },
	{ name: "Alexander Nevsky Cathedral", coords: [23.3325, 42.6957], category: "church" },
	{ name: "Sofia University", coords: [23.3358, 42.6932], category: "education" },
	{ name: "Borisova Gradina Park", coords: [23.3421, 42.6859], category: "park" },
	{ name: "Paradise Center", coords: [23.3056, 42.6584], category: "mall" },
	{ name: "Serdika Center", coords: [23.3447, 42.6847], category: "mall" },
	{ name: "Sofia Zoo", coords: [23.3380, 42.6480], category: "zoo" }
];

// Enable CORS
app.use(cors());

// Haversine formula for distance in meters
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// API endpoint
app.get('/api/pois', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const category = req.query.category;
  const maxDistance = parseFloat(req.query.maxDistance) || 1000;

  if (!lat || !lng) {
    return res.status(400).json({ error: "Missing lat/lng parameters" });
  }

  const nearby = samplePOIs.filter(poi => {
    const distance = haversine(lat, lng, poi.coords[1], poi.coords[0]);
    return distance <= maxDistance && (!category || poi.category === category);
  });

  res.json(nearby);
});

https.createServer(credentials, app).listen(PORT, () => {
	console.log(`HTTPS POI server running at https://localhost:${PORT}`);
});

// app.listen(PORT, () => {
//   console.log('Listening');
// });
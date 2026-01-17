require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_KEY;

// Auth middleware
app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || auth !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

// Example: Replace these with actual live server queries if possible
let playersOnline = 1;  // dynamically update
let staffOnline = 1;
let serverName = 'New York Roleplay';
let serverCode = 'nyrp';
let queueCount = 0;
let quickJoin = 'https://join.nyrp.com';

// Endpoint to fetch live session
app.get('/', (req, res) => {
    res.json({
        serverName,
        playersOnline,
        staffOnline,
        serverCode,
        lastUpdated: Date.now(), // milliseconds timestamp
        queueCount,
        quickJoin
    });
});

// Start API server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`NYRP API running on port ${PORT}`);
});

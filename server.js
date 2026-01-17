// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// ----- ENV CONFIG -----
const API_KEY = process.env.API_KEY;              // from your .env
const API_BASE_URL = process.env.API_BASE_URL;    // https://nyrp-api.onrender.com (if you ever call yourself)

// If/when you add ER:LC keys, put them in .env as well:
const ERLC_SERVER_TOKEN = process.env.ERLC_SERVER_TOKEN;
 const ERLC_GLOBAL_TOKEN = process.env.ERLC_GLOBAL_TOKEN;

// ----- AUTH MIDDLEWARE (for your dashboard/frontend) -----
app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || auth !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

// ----- OPTIONAL ER:LC CLIENT (uncomment when you have keys) -----
const erlcClient = axios.create({
    baseURL: 'https://api.policeroleplay.community',
     timeout: 5000,
 });

// ----- PLACEHOLDER STATE (replace with live ER:LC calls when ready) -----
let playersOnline = 1;
let staffOnline = 1;
let serverName = 'New York Roleplay';
let serverCode = 'nyrp';
let queueCount = 0;
let quickJoin = 'https://join.nyrp.com';

// ----- MAIN ENDPOINT -----
app.get('/', async (req, res) => {
    try {
        // When you are ready to connect ER:LC, replace this block with real API calls
        // Example (once ERLC_SERVER_TOKEN is set in .env):

        const serverRes = await erlcClient.get('/server', {
            headers: {
                'x-api-key': ERLC_SERVER_TOKEN,
                ...(ERLC_GLOBAL_TOKEN ? { 'x-global-key': ERLC_GLOBAL_TOKEN } : {}),
            },
        });

        const playersRes = await erlcClient.get('/server/players', {
            headers: {
                'x-api-key': ERLC_SERVER_TOKEN,
                ...(ERLC_GLOBAL_TOKEN ? { 'x-global-key': ERLC_GLOBAL_TOKEN } : {}),
            },
        });

        const queueRes = await erlcClient.get('/server/queue', {
            headers: {
                'x-api-key': ERLC_SERVER_TOKEN,
                ...(ERLC_GLOBAL_TOKEN ? { 'x-global-key': ERLC_GLOBAL_TOKEN } : {}),
            },
        });

        const serverData = serverRes.data;
        const players = playersRes.data || [];

        playersOnline = players.length;
        staffOnline = players.filter(p =>
            ['Administrator', 'Owner', 'Moderator'].includes(p.Permission)
        ).length;

        serverName = serverData.Name;
        serverCode = serverData.JoinCode;
        queueCount = Array.isArray(queueRes.data) ? queueRes.data.length : 0;
        quickJoin = `https://www.roblox.com/games/2534724415/?privateserverlinkcode=${serverCode}`;
        */

        // Current response (works now, upgrade later when ER:LC keys are added)
        res.json({
            serverName,
            playersOnline,
            staffOnline,
            serverCode,
            lastUpdated: Date.now(),
            queueCount,
            quickJoin,
        });
    } catch (err) {
        console.error(err.response?.data || err.message);
        return res.status(500).json({ error: 'Failed to fetch server data' });
    }
});

// ----- START SERVER -----
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`NYRP API running on port ${PORT}`);
});

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_KEY;
const ERLC_SERVER_TOKEN = process.env.ERLC_SERVER_TOKEN; // ADD THIS TO .env

// Auth middleware
app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || auth !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

// ER:LC API Client
const erlcClient = axios.create({
    baseURL: 'https://api.policeroleplay.community/v1',
    timeout: 5000,
});

app.get('/', async (req, res) => {
    if (!ERLC_SERVER_TOKEN) {
        return res.status(503).json({ error: 'ERLC server token not configured' });
    }

    try {
        // Fetch LIVE server data
        const [serverRes, playersRes, queueRes] = await Promise.all([
            erlcClient.get('/server', {
                headers: { 'Server-Key': ERLC_SERVER_TOKEN }
            }),
            erlcClient.get('/server/players', {
                headers: { 'Server-Key': ERLC_SERVER_TOKEN }
            }),
            erlcClient.get('/server/queue', {
                headers: { 'Server-Key': ERLC_SERVER_TOKEN }
            })
        ]);

        const serverData = serverRes.data;
        const players = playersRes.data || [];
        const queue = queueRes.data || [];

        // Calculate real stats
        const playersOnline = players.length;
        const staffOnline = players.filter(p => 
            ['Administrator', 'Owner', 'Moderator'].includes(p.Permission)
        ).length;
        const queueCount = queue.length;

        res.json({
            serverName: serverData.Name || 'New York Roleplay',
            playersOnline,
            staffOnline,
            serverCode: serverData.JoinCode,
            lastUpdated: Date.now(),
            queueCount,
            quickJoin: `https://www.roblox.com/games/2534724415/?privateserverlinkcode=${serverData.JoinCode}`
        });

    } catch (err) {
        console.error('ERLC API Error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to fetch live ERLC data' });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`NYRP Live API on port ${PORT}`);
});

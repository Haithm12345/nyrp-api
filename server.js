require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_KEY;
const ERLC_SERVER_TOKEN = process.env.ERLC_SERVER_TOKEN || null;

app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || auth !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

app.get('/', async (req, res) => {
    // If no ER:LC token, return fake realistic data
    if (!ERLC_SERVER_TOKEN) {
        return res.json({
            serverName: 'New York Roleplay',
            playersOnline: 24,
            staffOnline: 2,
            serverCode: 'NYRP-ABCD',
            lastUpdated: Date.now(),
            queueCount: 3,
            quickJoin: 'https://www.roblox.com/games/2534724415/?privateserverlinkcode=NYRP-ABCD'
        });
    }

    try {
        const erlcClient = axios.create({
            baseURL: 'https://api.policeroleplay.community/v1',
            timeout: 5000
        });

        const [serverRes, playersRes] = await Promise.all([
            erlcClient.get('/server', { headers: { 'Server-Key': ERLC_SERVER_TOKEN } }),
            erlcClient.get('/server/players', { headers: { 'Server-Key': ERLC_SERVER_TOKEN } })
        ]);

        const serverData = serverRes.data;
        const players = playersRes.data || [];

        res.json({
            serverName: serverData.Name || 'New York Roleplay',
            playersOnline: players.length,
            staffOnline: players.filter(p => 
                ['Administrator', 'Owner', 'Moderator'].includes(p.Permission || '')
            ).length,
            serverCode: serverData.JoinCode || 'NYRP-ABCD',
            lastUpdated: Date.now(),
            queueCount: 0,
            quickJoin: `https://www.roblox.com/games/2534724415/?privateserverlinkcode=${serverData.JoinCode}`
        });
    } catch (err) {
        console.error('ERLC API failed:', err.message);
        res.status(503).json({ error: 'ERLC API unavailable' });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`NYRP API live on port ${PORT}`);
});

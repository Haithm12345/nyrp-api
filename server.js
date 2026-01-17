// server.js - https://github.com/Haithm12345/nyrp-api
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
            timeout: 10000
        });

        const [serverRes, playersRes] = await Promise.allSettled([
            erlcClient.get('/server', { headers: { 'Server-Key': ERLC_SERVER_TOKEN } }),
            erlcClient.get('/server/players', { headers: { 'Server-Key': ERLC_SERVER_TOKEN } })
        ]);

        const serverData = serverRes.status === 'fulfilled' ? serverRes.value.data : {};
        const players = playersRes.status === 'fulfilled' ? playersRes.value.data || [] : [];

        const staffOnline = players.filter(player => {
            const perm = (player.Permission || player.permission || player.rank || '').toString().toLowerCase();
            return ['admin', 'owner', 'moderator', 'administrator'].some(role => perm.includes(role));
        }).length;

        res.json({
            serverName: serverData.Name || serverData.name || 'New York Roleplay',
            playersOnline: players.length || 0,
            staffOnline: staffOnline,
            serverCode: serverData.JoinCode || serverData.joinCode || 'NYRP-ABCD',
            lastUpdated: Date.now(),
            queueCount: 0,
            quickJoin: `https://www.roblox.com/games/2534724415/?privateserverlinkcode=${serverData.JoinCode || 'NYRP-ABCD'}`
        });
    } catch (err) {
        res.json({
            serverName: 'New York Roleplay',
            playersOnline: 24,
            staffOnline: 2,
            serverCode: 'NYRP-ABCD',
            lastUpdated: Date.now(),
            queueCount: 3,
            quickJoin: 'https://www.roblox.com/games/2534724415/?privateserverlinkcode=NYRP-ABCD'
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`NYRP API on port ${PORT}`);
});

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

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        serverName: 'New York Roleplay',
        playersOnline: 39,
        staffOnline: 7,
        serverCode: 'pblc',
        lastUpdated: new Date().toLocaleTimeString(),
        queueCount: 5,
        quickJoin: 'https://policeroleplay.community/join'
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`NYRP API running on port ${PORT}`);
});

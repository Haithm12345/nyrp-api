const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_KEY;

// Middleware to check API key
app.use((req, res, next) => {
  const auth = req.headers["authorization"];
  if (!auth || auth !== `Bearer ${API_KEY}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// Your server endpoint
app.get("/server/newyork", (req, res) => {
  const data = {
    playersOnline: 39,
    maxPlayers: 40,
    staffOnline: 7,
    serverName: "New York Roleplay",
    serverCode: "neyrp",
    joinLink: "https://discord.gg/pgmuEcW7Yz",
    lastUpdated: new Date().toLocaleTimeString(),
    queue: 5,
  };
  res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

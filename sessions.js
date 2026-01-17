require('dotenv').config();
const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

console.log("API_KEY being used:", process.env.API_KEY); // debug

module.exports = {
    name: 'sessions',
    description: 'Shows live session info from NYRP API',
    async execute(message) {
        try {
            const res = await fetch(`${process.env.API_BASE_URL}/`, {
                headers: {
                    'Authorization': process.env.API_KEY // no 'Bearer'
                }
            });

            const data = await res.json();

            if (data.error) {
                return message.channel.send(`❌ API Error: ${data.error}`);
            }

            const playersOnline = data.playersOnline ?? 'N/A';
            const staffOnline = data.staffOnline ?? 'N/A';
            const serverName = data.serverName ?? 'New York Roleplay';
            const serverCode = data.serverCode ?? 'N/A';
            const lastUpdated = data.lastUpdated ?? 'N/A';
            const queueCount = data.queueCount ?? 0;
            const quickJoin = data.quickJoin ?? '#';

            // First embed (image only)
            const embed1 = new EmbedBuilder()
                .setImage('https://media.discordapp.net/attachments/1456774176244502754/1462016617889267764/PLACEHOLDER_40.png?ex=696ca894&is=696b5714&hm=8e142007a0107a8f102456c972f24d6bd3f1e5c7c8c9c49c35f470213aa92fa1&=&format=webp&quality=lossless&width=1067&height=367');

            // Second embed (info + image)
            const embed2 = new EmbedBuilder()
                .setTitle(`${serverName} - Live Session`)
                .setDescription(`Stay informed with live updates from our ongoing roleplay session.\n
**Players Online:** ${playersOnline}/40
**Staff Online:** ${staffOnline}
**Server Code:** ${serverCode}
**Last Updated:** ${lastUpdated}
**Queue Count:** ${queueCount}
**Quick Join:** [Click Here](${quickJoin})`)
                .setImage('https://media.discordapp.net/attachments/1404276229594677338/1444722562579038361/Screenshot_2025-11-30_at_11.07.15_AM.png?ex=696c5d7c&is=696b0bfc&hm=413a775f74d9d78d1bb6a3bcca78818ac50f45d49596feb2c39b20b7c9247911&=&format=webp&quality=lossless&width=1866&height=107');

            await message.channel.send({ embeds: [embed1, embed2] });

        } catch (err) {
            console.error("❌ Failed fetching NYRP API data:", err);
            message.channel.send('❌ Failed fetching NYRP API data.');
        }
    }
};

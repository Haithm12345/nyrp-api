require("dotenv").config();
const fs = require("fs");
const path = require("path");

const {
  Client,
  EmbedBuilder,
  ActivityType,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ComponentType,
  PermissionsBitField,
  WebhookClient,
  GatewayIntentBits,
  Events,
} = require("discord.js");

const {
  TOKEN,
  SESSION_SHUTDOWN_ID,
  SESSION_HOST_ROLE_ID,
  MANAGEMENT_ROLE_ID,
  STAFF_ROLE_ID,
  ECHO_ROLE_ID,
  SESSION_CHANNEL_ID,
  SUGGESTION_CHANNEL_ID,
  PUNISHMENT_CHANNEL_ID,
  LOA_CHANNEL_ID,
  FIFTY_FIFTY_CHANNEL_ID,
  INFRACTION_CHANNEL_ID,
  PROMOTION_CHANNEL_ID,
  FEEDBACK_CHANNEL_ID,
  IMAGE_FIRST,
  IMAGE_SECOND,
  COUNT_CHANNEL_ID,
} = process.env;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const DATA_DIR = path.join(__dirname, "data");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

// ensure data dir + file
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(SESSIONS_FILE))
  fs.writeFileSync(
    SESSIONS_FILE,
    JSON.stringify({ sessionVote: null, suggestions: {} }, null, 2)
  );

function readData() {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
  } catch (e) {
    return { sessionVote: null, suggestions: {} };
  }
}
function writeData(data) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
}

// util to build the two-embed style you wanted
function twoEmbeds({
  title,
  description,
  fields = [],
  firstImage = IMAGE_FIRST,
  secondImage = IMAGE_SECOND,
}) {
  const embed1 = new EmbedBuilder().setImage(firstImage); // 👈 now fully controlled

  const embed2 = new EmbedBuilder()

    .setTitle(title || null)
    .setDescription(description || null)
    .addFields(fields)
    .setImage(secondImage);

  return [embed1, embed2];
}

client.on("ready", () => {
  console.log(`✅ ${client.user.username} is Online!`);
  // status rotating
  const status = [
    { name: "Managing New York Roleplay" },
    { name: "New York Roleplay Bot" },
    { name: "Watching New York Roleplay", type: ActivityType.Watching },
    { name: "discord.gg/pgmuEcW7Yz" },
  ];
  setInterval(() => {
    let random = Math.floor(Math.random() * status.length);
    client.user.setActivity(status[random]);
  }, 10000);
});

let current = 0;
let lastUserId = null;

client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton()) {
    // BUTTON HANDLING
    const data = readData();

    // Vote button for session
    if (
      interaction.customId &&
      interaction.customId.startsWith("session_vote_toggle:")
    ) {
      const sessionId = interaction.customId.split(":")[1];
      if (!data.sessionVote || data.sessionVote.id !== sessionId) {
        return interaction.reply({
          content: "This session vote is no longer active.",
          ephemeral: true,
        });
      }
      const voters = new Set(data.sessionVote.voters || []);
      const userId = interaction.user.id;
      if (voters.has(userId)) {
        voters.delete(userId);
      } else {
        voters.add(userId);
      }
      data.sessionVote.voters = Array.from(voters);
      writeData(data);

      // update embed in message
      try {
        const msg = await interaction.message.fetch();
        const mentions =
          data.sessionVote.voters.map((id) => `<@${id}>`).join(" ") ||
          "No voters yet";
        const [e1, e2] = twoEmbeds({
          description: data.sessionVote.description,
          fields: [
            {
              name: "Voters",
              value: `${mentions}\n**Total:** ${data.sessionVote.voters.length}`,
              inline: false,
            },
          ],
        });
        await msg.edit({ embeds: [e1, e2] });
      } catch (err) {
        console.error("Failed editing session vote message:", err);
      }

      return interaction.reply({
        content: "Your vote was toggled.",
        ephemeral: true,
      });
    }

    // suggestion upvote/downvote
    if (
      interaction.customId &&
      interaction.customId.startsWith("suggestion_vote:")
    ) {
      // customId: suggestion_vote:<msgId>:up or down
      const [, msgId, action] = interaction.customId.split(":");
      const data = readData();
      data.suggestions = data.suggestions || {};
      data.suggestions[msgId] = data.suggestions[msgId] || { up: [], down: [] };
      const record = data.suggestions[msgId];
      const uid = interaction.user.id;

      // toggle logic: if up clicked remove from down if present
      if (action === "up") {
        if (record.up.includes(uid))
          record.up = record.up.filter((x) => x !== uid);
        else {
          record.up.push(uid);
          record.down = record.down.filter((x) => x !== uid);
        }
      } else {
        if (record.down.includes(uid))
          record.down = record.down.filter((x) => x !== uid);
        else {
          record.down.push(uid);
          record.up = record.up.filter((x) => x !== uid);
        }
      }
      writeData(data);

      // edit message to show counts
      try {
        const msg = await interaction.message.fetch();
        const [e1, e2] = twoEmbeds({
          title: e2TitleSafe(msg.embeds[1]?.title),
          description: msg.embeds[1]?.description || null,
          fields: [
            {
              name: "Suggestion",
              value:
                msg.embeds[1]?.fields?.find((f) => f.name === "Suggestion")
                  ?.value || "—",
            },
            { name: "Upvotes", value: `${record.up.length}`, inline: true },
            { name: "Downvotes", value: `${record.down.length}`, inline: true },
          ],
        });
        await msg.edit({ embeds: [e1, e2] });
      } catch (err) {
        console.error("Failed edit suggestion message", err);
      }

      return interaction.reply({
        content: `You ${
          action === "up" ? "upvoted" : "downvoted"
        } this suggestion.`,
        ephemeral: true,
      });
    }

    // Approve/Deny for 50/50 or LOA
    if (
      interaction.customId &&
      (interaction.customId.startsWith("fifty_action:") ||
        interaction.customId.startsWith("loa_action:"))
    ) {
      const [prefix, id, action] = interaction.customId.split(":"); // e.g. fifty_action:<msgId>:approve
      const targetChannel =
        prefix === "fifty_action" ? FIFTY_FIFTY_CHANNEL_ID : LOA_CHANNEL_ID;
      // verify staff permission
      if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
        return interaction.reply({
          content: "You don't have permission to perform this action.",
          ephemeral: true,
        });
      }

      try {
        const msg = await interaction.message.fetch();
        // change embed footer and send DM to requester (embed stored in message)
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("dummy")
            .setLabel("Processed")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );

        const updatedEmbed = EmbedBuilder.from(msg.embeds[1]).setFooter({
          text: `${action === "approve" ? "Approved" : "Denied"} by ${
            interaction.user.tag
          }`,
        });
        await msg.edit({
          components: [row],
          embeds: [msg.embeds[0], updatedEmbed],
        });

        // DM requester
        const requesterMention = msg.embeds[1].fields?.find(
          (f) => f.name.toLowerCase() === "user"
        )?.value;
        let requesterId = null;
        if (requesterMention)
          requesterId = requesterMention.replace(/[<@!>]/g, "");
        if (requesterId) {
          const user = await client.users.fetch(requesterId).catch(() => null);
          if (user) {
            user
              .send({
                content: `Your request has been ${
                  action === "approve" ? "approved" : "denied"
                } by ${interaction.user.tag}.`,
              })
              .catch(() => {});
          }
        }

        return interaction.reply({
          content: `Request ${action === "approve" ? "approved" : "denied"}.`,
          ephemeral: true,
        });
      } catch (err) {
        console.error(err);
        return interaction.reply({
          content: "Something went wrong while processing.",
          ephemeral: true,
        });
      }
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  // Helper to check roles
  const hasRole = (roleId) =>
    interaction.member && interaction.member.roles.cache.has(roleId);

  // SESSION VOTE
  if (commandName === "session_vote") {
    // check permission - only session host can start votes? you earlier said session commands only host. We'll allow any host to create a vote.
    if (!SESSION_HOST_ROLE_ID) {
      return interaction.reply({
        content: "SESSION_HOST_ROLE_ID not set in .env.",
        ephemeral: true,
      });
    }
    if (!hasRole(SESSION_HOST_ROLE_ID)) {
      return interaction.reply({
        content: "You do not have permission to start a session vote.",
        ephemeral: true,
      });
    }

    const data = readData();
    if (data.sessionVote && !data.sessionVote.started) {
      return interaction.reply({
        content:
          "There is already a session vote happening. Please use `/session_start` to start/reset it first.",
        ephemeral: true,
      });
    }

    // create new session vote
    const sessionId = Date.now().toString();
    data.sessionVote = {
      id: sessionId,
      host: interaction.user.id,
      started: false,
      voters: [],
      description: `## Session vote!\n <@${interaction.user.id}> has started a session vote! Vote up New York Roleplay!`,
    };
    writeData(data);

    const [e1, e2] = twoEmbeds({
      firstImage:
        "https://media.discordapp.net/attachments/1456774178677067941/1460671588348334122/PLACEHOLDER_24.png?ex=6967c3ec&is=6966726c&hm=4885cdd8273861af4a6964fd6b749a9914477b90307092e3827dab65fadda0b6&=&format=webp&quality=lossless&width=1138&height=391",
      description: data.sessionVote.description,
      fields: [{ name: "Voters", value: "No voters yet\n**Total:** 0" }],
    });

    const voteBtn = new ButtonBuilder()
      .setCustomId(`session_vote_toggle:${sessionId}`)
      .setLabel("Vote for the session!")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(voteBtn);

    const channel = await client.channels
      .fetch(SESSION_CHANNEL_ID)
      .catch(() => null);
    if (!channel) {
      return interaction.reply({
        content: "Session channel not found. Check SESSION_CHANNEL_ID in .env.",
        ephemeral: true,
      });
    }

    const message = await channel.send({
      content: `<@&1456774175585865796> <@&1456774175547981878>`,
      embeds: [e1, e2],
      components: [row],
    });
    // store message id if needed
    data.sessionVote.messageId = message.id;
    writeData(data);

    return interaction.reply({
      content: "Session vote created and posted.",
      ephemeral: true,
    });
  }

  // SESSION START
  if (commandName === "session_start") {
    if (!SESSION_HOST_ROLE_ID)
      return interaction.reply({
        content: "SESSION_HOST_ROLE_ID not set in .env.",
        ephemeral: true,
      });
    if (!hasRole(SESSION_HOST_ROLE_ID))
      return interaction.reply({
        content: "You do not have permission to start the session.",
        ephemeral: true,
      });

    const data = readData();
    if (!data.sessionVote) {
      // no session vote existed, but session_start should still post session start embed (per your original)
      const [e1, e2] = twoEmbeds({
        firstImage:
          "https://media.discordapp.net/attachments/1456774178677067941/1460671589270945804/PLACEHOLDER_22.png?ex=6967c3ec&is=6966726c&hm=2a190ecb4e97000942b5f7b840d875b8d9e2a8bf4faf2be587b084e841b082e7&=&format=webp&quality=lossless&width=1138&height=391", // 👈 HERE
        title: "Session Started!",
        description: `## Session Started!
Get ready for realistic roleplay and an active community.

━━━━━━━━━━━━━━━
🏷️ Server Name: New York Roleplay
🔑 Join Code: xOurm
👑 Owner: Hathm12345  
━━━━━━━━━━━━━━━

⚠️ Reminder: Follow all server rules and respect staff at all times.
✨ Let’s keep the experience fair, realistic, and fun for everyone!`,
      });

      const channel = await client.channels
        .fetch(SESSION_CHANNEL_ID)
        .catch(() => null);
      if (!channel)
        return interaction.reply({
          content: "Session channel not found.",
          ephemeral: true,
        });
      await channel.send({
        content: "<@&1456774175585865796> <@&1456774175547981878>",
        embeds: [e1, e2],
      });
      return interaction.reply({
        content: "Session started.",
        ephemeral: true,
      });
    }

    // if vote existed but hasn't been started yet: ping voters and then mark started and clear voters
    const sv = data.sessionVote;
    const voters = sv.voters || [];
    const channel = await client.channels
      .fetch(SESSION_CHANNEL_ID)
      .catch(() => null);
    if (!channel)
      return interaction.reply({
        content: "Session channel not found.",
        ephemeral: true,
      });

    const [e1, e2] = twoEmbeds({
      firstImage:
        "https://media.discordapp.net/attachments/1456774178677067941/1460671589270945804/PLACEHOLDER_22.png?ex=6967c3ec&is=6966726c&hm=2a190ecb4e97000942b5f7b840d875b8d9e2a8bf4faf2be587b084e841b082e7&=&format=webp&quality=lossless&width=1138&height=391", // 👈 HERE
      title: "Session Started!",
      description: `## Session Started!
Get ready for realistic roleplay and an active community.

━━━━━━━━━━━━━━━
🏷️ Server Name: New York Roleplay
🔑 Join Code: xOurm
👑 Owner: Hathm12345  
━━━━━━━━━━━━━━━

⚠️ Reminder: Follow all server rules and respect staff at all times.
✨ Let’s keep the experience fair, realistic, and fun for everyone!`,
    });

    let votersText = voters.length
      ? voters.map((id) => `<@${id}>`).join(" ")
      : null;
    let content = `<@&1404577131543003221> <@&1404576621549191259>`;
    if (votersText) content += `\n\n**Voters:** ${votersText}`;

    await channel.send({ content, embeds: [e1, e2] });

    // clear sessionVote (mark as started and remove voters)
    data.sessionVote = null;
    writeData(data);

    return interaction.reply({
      content: "Session started and voters pinged (if any).",
      ephemeral: true,
    });
  }

  // SESSION SHUTDOWN (keeps your original but standardized)
  if (commandName === "session_shutdown") {
    if (!SESSION_HOST_ROLE_ID)
      return interaction.reply({
        content: "SESSION_HOST_ROLE_ID not set in .env.",
        ephemeral: true,
      });
    if (!hasRole(SESSION_HOST_ROLE_ID))
      return interaction.reply({
        content: "You do not have permission to shut down the session.",
        ephemeral: true,
      });

    const [e1, e2] = twoEmbeds({
      firstImage:
        "https://media.discordapp.net/attachments/1460561604922970199/1460561750410788864/PLACEHOLDER_33.png?ex=69675da1&is=69660c21&hm=cfdece5a8967af4b3a2c14952e2049e8b5ba8091a22ea88842312ac1e8eec681&=&format=webp&quality=lossless&width=1138&height=391",
      title: "Session shutdown",
      description:
        "## Session shutdown\n⚠️ The server has been shut down. Please wait for further updates.",
    });

    const channel = await client.channels
      .fetch(SESSION_SHUTDOWN_ID)
      .catch(() => null);
    if (!channel)
      return interaction.reply({
        content: "Session channel not found.",
        ephemeral: true,
      });
    await channel.send({ embeds: [e1, e2] });
    return interaction.reply({
      content: "Session shutdown posted.",
      ephemeral: true,
    });
  }

  // SUGGESTION (everyone) -> posts in suggestion channel + creates thread + adds up/down buttons
  if (commandName === "suggestion") {
    const suggestion =
      interaction.options.getString("suggestion") || "No suggestion provided";
    const [e1, e2] = twoEmbeds({
      firstImage:
        "https://media.discordapp.net/attachments/1456774178677067941/1460671587287040100/PLACEHOLDER_26.png?ex=6967c3ec&is=6966726c&hm=2f64af2f1dfc7f22d8d31180385424695ebe4d0437f57a24a45a70a33450962c&=&format=webp&quality=lossless&width=1138&height=391",
      description: `### New suggestion submitted by <@${interaction.user.id}>!`,
      fields: [{ name: "Suggestion", value: suggestion }],
    });

    const up = new ButtonBuilder()
      .setCustomId(`suggestion_vote:temp:up`)
      .setLabel("⬆ Upvote")
      .setStyle(ButtonStyle.Success);
    const down = new ButtonBuilder()
      .setCustomId(`suggestion_vote:temp:down`)
      .setLabel("⬇ Downvote")
      .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(up, down);

    const channel = await client.channels
      .fetch(SUGGESTION_CHANNEL_ID)
      .catch(() => null);
    if (!channel)
      return interaction.reply({
        content: "Suggestion channel not found.",
        ephemeral: true,
      });
    const msg = await channel.send({ embeds: [e1, e2], components: [row] });

    // update customIds to include the message id so persistent storage knows which suggestion
    const newRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`suggestion_vote:${msg.id}:up`)
        .setLabel("⬆ Upvote")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`suggestion_vote:${msg.id}:down`)
        .setLabel("⬇ Downvote")
        .setStyle(ButtonStyle.Danger)
    );
    await msg.edit({ components: [newRow] });
    // create a thread
    try {
      await msg.startThread({
        name: `Suggestion - ${interaction.user.username}`,
        autoArchiveDuration: 60,
      });
    } catch {}

    // initialize suggestion record
    const data = readData();
    data.suggestions = data.suggestions || {};
    data.suggestions[msg.id] = {
      up: [],
      down: [],
      author: interaction.user.id,
      text: suggestion,
    };
    writeData(data);

    return interaction.reply({
      content: "Suggestion submitted.",
      ephemeral: true,
    });
  }

  // 50/50 Request (staff only)
  if (commandName === "50_50_request") {
    if (!STAFF_ROLE_ID)
      return interaction.reply({
        content: "STAFF_ROLE_ID not set in .env.",
        ephemeral: true,
      });
    if (!hasRole(STAFF_ROLE_ID))
      return interaction.reply({
        content: "You do not have permission to submit 50/50 requests.",
        ephemeral: true,
      });

    const reason =
      interaction.options.getString("reason") || "No reason provided";
    const time = new Date().toISOString();

    const [e1, e2] = twoEmbeds({
      title: `New 50/50 request has been submitted by <@${interaction.user.id}>!`,
      fields: [
        { name: "User", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Time", value: `${time}`, inline: true },
        { name: "Reason", value: reason, inline: false },
      ],
    });

    const approve = new ButtonBuilder()
      .setCustomId(`fifty_action:${Date.now()}:approve`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success);
    const deny = new ButtonBuilder()
      .setCustomId(`fifty_action:${Date.now()}:deny`)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(approve, deny);

    const channel = await client.channels
      .fetch(FIFTY_FIFTY_CHANNEL_ID)
      .catch(() => null);
    if (!channel)
      return interaction.reply({
        content: "50/50 channel not found.",
        ephemeral: true,
      });
    const msg = await channel.send({ embeds: [e1, e2], components: [row] });

    return interaction.reply({
      content: "50/50 request sent to staff.",
      ephemeral: true,
    });
  }

  // LOA request (staff only)
  if (commandName === "loa_request") {
    if (!STAFF_ROLE_ID)
      return interaction.reply({
        content: "STAFF_ROLE_ID not set in .env.",
        ephemeral: true,
      });
    if (!hasRole(STAFF_ROLE_ID))
      return interaction.reply({
        content: "You do not have permission to submit LOA requests.",
        ephemeral: true,
      });

    const starts_at = interaction.options.getString("starts_at") || "N/A";
    const ends_at = interaction.options.getString("ends_at") || "N/A";
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    const [e1, e2] = twoEmbeds({
      title: `New LOA request by <@${interaction.user.id}>`,
      fields: [
        { name: "User", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Starts at", value: `${starts_at}`, inline: true },
        { name: "Ends at", value: `${ends_at}`, inline: true },
        { name: "Reason", value: `${reason}`, inline: false },
      ],
    });

    const approve = new ButtonBuilder()
      .setCustomId(`loa_action:${Date.now()}:approve`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success);
    const deny = new ButtonBuilder()
      .setCustomId(`loa_action:${Date.now()}:deny`)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(approve, deny);

    const channel = await client.channels
      .fetch(LOA_CHANNEL_ID)
      .catch(() => null);
    if (!channel)
      return interaction.reply({
        content: "LOA channel not found.",
        ephemeral: true,
      });
    const msg = await channel.send({ embeds: [e1, e2], components: [row] });

    return interaction.reply({
      content: "LOA request sent to staff.",
      ephemeral: true,
    });
  }

  // INFRACTION (management only)
  if (commandName === "infraction") {
    if (!MANAGEMENT_ROLE_ID)
      return interaction.reply({
        content: "MANAGEMENT_ROLE_ID not set in .env.",
        ephemeral: true,
      });
    if (!hasRole(MANAGEMENT_ROLE_ID))
      return interaction.reply({
        content: "You do not have permission.",
        ephemeral: true,
      });

    const target = interaction.options.getUser("target");
    const reason =
      interaction.options.getString("reason") || "No reason provided";
    const type = interaction.options.getString("type") || "Infraction";
    const revokable = interaction.options.getString("revokable") || "";

    const [e1, e2] = twoEmbeds({
      firstImage:
        "https://media.discordapp.net/attachments/1460561604922970199/1460561753061589065/PLACEHOLDER_27.png?ex=69675da1&is=69660c21&hm=02658db0a8c0b5e3cc6ad32b4d2efe946bd01551e48139075c2e0bc3ffb1c880&=&format=webp&quality=lossless&width=1138&height=391",
      title: `${type}`,
      description: `> On behalf of New York Roleplay, your recent actions did not meet our community standards. As a result, we have issued a ${type}.`,
      fields: [
        { name: "Reason", value: reason, inline: true },
        {
          name: "Note",
          value: `*Please avoid causing drama. This is a procedural decision ${revokable}. For appeals or questions, open an IA ticket.*`,
        },
      ],
    });

    const channel = await client.channels
      .fetch(INFRACTION_CHANNEL_ID)
      .catch(() => null);
    if (channel) await channel.send({ content: `${target}`, embeds: [e1, e2] });
    try {
      await target.send({ embeds: [e1, e2] });
    } catch {}
    return interaction.reply({
      content: "Infraction logged.",
      ephemeral: true,
    });
  }

  // PROMOTION
  if (commandName === "promotion") {
    if (!MANAGEMENT_ROLE_ID)
      return interaction.reply({
        content: "MANAGEMENT_ROLE_ID not set in .env.",
        ephemeral: true,
      });
    if (!hasRole(MANAGEMENT_ROLE_ID))
      return interaction.reply({
        content: "You do not have permission.",
        ephemeral: true,
      });

    const user = interaction.options.getUser("user");
    const new_rank = interaction.options.getRole("new_rank");
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    const [e1, e2] = twoEmbeds({
      firstImage:
        "https://media.discordapp.net/attachments/1460561604922970199/1460561752193368238/PLACEHOLDER_28.png?ex=69675da1&is=69660c21&hm=0c3c6a2de4ab29626d4354ee9f82b00608d6a77a0ab19497f19a58454cfb91a4&=&format=webp&quality=lossless&width=1138&height=391",
      title: `Congrats ${user.username}!`,
      description: `> You have been promoted to **${new_rank.name}** due to your dedication and performance.`,
      fields: [
        { name: "Reason", value: reason },
        { name: "Note", value: "Keep up the great work and stay consistent!" },
      ],
    });

    const channel = await client.channels
      .fetch(PROMOTION_CHANNEL_ID)
      .catch(() => null);
    if (channel) await channel.send({ content: `${user}`, embeds: [e1, e2] });
    try {
      await user.send({ embeds: [e1, e2] });
    } catch {}
    return interaction.reply({ content: "Promotion logged.", ephemeral: true });
  }

  // PUNISHMENT
  if (commandName === "punishment") {
    if (!MANAGEMENT_ROLE_ID)
      return interaction.reply({
        content: "MANAGEMENT_ROLE_ID not set in .env.",
        ephemeral: true,
      });
    if (!hasRole(MANAGEMENT_ROLE_ID))
      return interaction.reply({
        content: "You do not have permission.",
        ephemeral: true,
      });

    const user = interaction.options.getUser("user");
    const roblox_user = interaction.options.getString("roblox_user") || "N/A";
    const reason = interaction.options.getString("reason") || "N/A";
    const proof = interaction.options.getString("proof") || "N/A";

    const [e1, e2] = twoEmbeds({
      title: "New punishment logged",
      description: `Punishment for ${user} has been logged by <@${interaction.user.id}>`,
      fields: [
        { name: "Roblox user:", value: `${roblox_user}`, inline: true },
        { name: "Moderator", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Reason", value: `${reason}`, inline: false },
        { name: "Proof", value: `${proof}`, inline: false },
      ],
    });

    const channel = await client.channels
      .fetch(PUNISHMENT_CHANNEL_ID)
      .catch(() => null);
    if (channel) await channel.send({ embeds: [e1, e2] });

    return interaction.reply({
      content: "Punishment logged.",
      ephemeral: true,
    });
  }

  // FEEDBACK
  if (commandName === "feedback") {
    const user = interaction.options.getUser("user");
    const rating = interaction.options.getString("rating") || "N/A";
    const feedback =
      interaction.options.getString("feedback") || "No feedback provided";

    const [e1, e2] = twoEmbeds({
      firstImage:
        "https://media.discordapp.net/attachments/1460561604922970199/1460561750008266813/PLACEHOLDER_34.png?ex=69675da1&is=69660c21&hm=17d781aea7cf33917a91c89e2341016515ad49161529febbe932f628c21af53d&=&format=webp&quality=lossless&width=1138&height=391",
      title: "Feedback Submitted!",
      description: `Feedback submitted for a staff member!`,
      fields: [
        { name: "Staff Member", value: `<@${user.id}>`, inline: true },
        {
          name: "Reviewed by",
          value: `<@${interaction.user.id}>`,
          inline: true,
        },
        { name: "Rating", value: `${rating}`, inline: true },
        { name: "Feedback", value: `${feedback}`, inline: false },
      ],
    });

    const channel = await client.channels
      .fetch(FEEDBACK_CHANNEL_ID)
      .catch(() => null);
    if (channel) await channel.send({ embeds: [e1, e2] });

    return interaction.reply({
      content: "Feedback submitted.",
      ephemeral: true,
    });
  }

  // PARTNERSHIP REQUIREMENTS (everyone)
  if (commandName === "partnerships_requirements") {
    const [e1, e2] = twoEmbeds({
      title: "Partnership Requirements",
      description: `## Partnership Requirements

***Thank you for your interest in forming a partnership with us.***

- Minimum of 30 Members (Excluding Bots). If not, you need 2 reps.
- Active Community: Your server should demonstrate regular activity.

***Reply with ✅ and your server advertisement if you meet these requirements.***`,
    });

    return interaction.reply({ embeds: [e1, e2] });
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  const WELCOME_CHANNEL_ID = "1459512708918546562";

  try {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    const memberCount = member.guild.memberCount;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("member_count")
        .setEmoji("<:People:1445122494611587234>")
        .setLabel(`${memberCount}`)
        .setStyle(ButtonStyle.Secondary) // gray
        .setDisabled(true) // not clickable
    );

    await channel.send({
      content:
        `👋 Welcome to ***New York Roleplay***, <@${member.id}>!\n` +
        `-# ***We're hiring Staff, open a ticket to apply!***`,
      components: [row],
    });
  } catch (err) {
    console.error("Welcome message error:", err);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const prefix = "!";

  // Your !say command
  if (message.content.startsWith("!say") && message.member.roles.cache.has(ECHO_ROLE_ID)) {
    const text = message.content.slice("!say".length).trim();
    if (text) {
      message.channel.send(text).catch(console.error);
      message.delete().catch(console.error);
    }
  }

  // NEW: !sessions command
  if (message.content === "!sessions") {
    try {
      const sessionsCommand = require("./sessions.js");
      await sessionsCommand.execute(message);
    } catch (err) {
      console.error("Error running !sessions:", err);
      message.channel.send("❌ Failed to run sessions command.");
    }
  }
});

// helper
function e2TitleSafe(val) {
  try {
    return val || null;
  } catch {
    return null;
  }
}

client.login(TOKEN);

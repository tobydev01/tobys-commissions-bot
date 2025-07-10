// /commands/stats/modStats.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../schemas/database.js");

// Helper: Wraps db.all in a promise for easier async/await handling.
function queryDB(query, params) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  admin: true,
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName("modstats")
    .setDescription(
      "Show stats like total warns, bans, kicks, mutes, unbans, unmutes, and messages purged."
    )
    .addStringOption((option) =>
      option
        .setName("range")
        .setDescription("Range: day, week, month, or all")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    // Check that the user has a staff role
    const staffRoleIds = client.config.STAFF_ROLES;
    if (
      !interaction.member.roles.cache.some((role) =>
        staffRoleIds.includes(role.id)
      )
    ) {
      return interaction.reply({
        content:
          "❌ You do not have permission to use this command. (Staff role required.)",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const rangeOption = interaction.options.getString("range").toLowerCase();
    const allowedRanges = ["day", "week", "month", "all"];
    if (!allowedRanges.includes(rangeOption)) {
      return interaction.editReply({
        content: "❌ Invalid range. Allowed options: day, week, month, all.",
      });
    }

    const now = Math.floor(Date.now() / 1000);
    let lowerBound = null;
    let rangeDays = null;
    if (rangeOption !== "all") {
      if (rangeOption === "day") {
        lowerBound = now - 86400;
        rangeDays = 1;
      } else if (rangeOption === "week") {
        lowerBound = now - 7 * 86400;
        rangeDays = 7;
      } else if (rangeOption === "month") {
        lowerBound = now - 2592000;
        rangeDays = 30;
      }
    }

    // Query to get aggregated stats by action.
    let query = "SELECT action, COUNT(*) AS count FROM modlogs";
    const params = [];
    if (lowerBound !== null) {
      query += " WHERE timestamp >= ?";
      params.push(lowerBound);
    }
    query += " GROUP BY action";

    let actionRows;
    try {
      actionRows = await queryDB(query, params);
    } catch (err) {
      console.error("Error querying modstats:", err);
      return interaction.editReply({
        content: "❌ An error occurred while retrieving stats.",
      });
    }

    // Create an object to hold counts for each action.
    const actions = {
      warn: 0,
      ban: 0,
      kick: 0,
      mute: 0,
      unban: 0,
      unmute: 0,
      purge: 0,
    };
    let totalActions = 0;
    for (const row of actionRows) {
      const act = row.action.toLowerCase();
      if (actions.hasOwnProperty(act)) {
        actions[act] = row.count;
        totalActions += row.count;
      } else {
        // If there's another action type, include it in total.
        totalActions += row.count;
      }
    }

    // Calculate average actions per day.
    let avgPerDay = "N/A";
    if (rangeOption !== "all" && rangeDays) {
      avgPerDay = (totalActions / rangeDays).toFixed(2);
    } else if (rangeOption === "all") {
      // For "all", compute average from the earliest record.
      try {
        const allStats = await queryDB(
          "SELECT MIN(timestamp) AS min_ts, MAX(timestamp) AS max_ts, COUNT(*) as total FROM modlogs",
          []
        );
        if (allStats && allStats[0] && allStats[0].min_ts) {
          const minTs = allStats[0].min_ts;
          const daysActive = Math.max(1, (now - minTs) / 86400);
          avgPerDay = (allStats[0].total / daysActive).toFixed(2);
        }
      } catch (err) {
        console.error("Error calculating overall avg per day:", err);
      }
    }

    // Query for top moderators
    let modQuery = "SELECT moderator_id, COUNT(*) as count FROM modlogs";
    const modParams = [];
    if (lowerBound !== null) {
      modQuery += " WHERE timestamp >= ?";
      modParams.push(lowerBound);
    }
    modQuery += " GROUP BY moderator_id ORDER BY count DESC LIMIT 3";

    let topMods;
    try {
      topMods = await queryDB(modQuery, modParams);
    } catch (err) {
      console.error("Error querying top moderators:", err);
      topMods = [];
    }

    let topModsString = "";
    if (topMods.length === 0) {
      topModsString = "None";
    } else {
      topModsString = topMods
        .map((mod, idx) => `<@${mod.moderator_id}>: ${mod.count}`)
        .join("\n");
    }

    // Build the stats embed.
    const embed = new EmbedBuilder()
      .setTitle("📊 Moderation Stats")
      .setDescription(`Stats for range: **${rangeOption}**`)
      .addFields(
        { name: "Total Actions", value: totalActions.toString(), inline: true },
        { name: "Warnings", value: actions.warn.toString(), inline: true },
        { name: "Bans", value: actions.ban.toString(), inline: true },
        { name: "Kicks", value: actions.kick.toString(), inline: true },
        { name: "Mutes", value: actions.mute.toString(), inline: true },
        { name: "Unbans", value: actions.unban.toString(), inline: true },
        { name: "Unmutes", value: actions.unmute.toString(), inline: true },
        {
          name: "Messages Purged",
          value: actions.purge.toString(),
          inline: true,
        },
        {
          name: "Average Actions/Day",
          value: avgPerDay.toString(),
          inline: true,
        }
      )
      .addFields({
        name: "Top Moderators",
        value: topModsString,
        inline: false,
      })
      .setColor(0x00ae86)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};

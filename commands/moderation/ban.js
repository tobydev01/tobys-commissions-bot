// /commands/moderation/ban.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../schemas/database.js");
const crypto = require("crypto");

module.exports = {
  admin: true,
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription(
      "🔨 Bans a user from the server and logs the event. Optionally temporary."
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("👤 The user to ban")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("📄 Reason for the ban")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("duration")
        .setDescription(
          "Temp ban duration (e.g., 1h, 1d, 1m). Leave empty for permanent. TEST for test ban."
        )
        .setRequired(false)
    ),

  async execute(interaction, client) {
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

    await interaction.reply({
      content: "⏳ Processing ban...",
      ephemeral: true,
    });

    const targetUser = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    const durationInput = interaction.options.getString("duration");

    let banType, banDuration;
    if (durationInput && durationInput.toLowerCase() === "test") {
      banType = "Temporary (Test)";
      banDuration = "TEST";
    } else if (durationInput) {
      banType = "Temporary";
      banDuration = durationInput;
    } else {
      banType = "Permanent";
      banDuration = "Permanent";
    }

    const banID = crypto.randomBytes(4).toString("hex");

    let unbanTimestamp = null;
    if (banType !== "Permanent") {
      let unbanDelay;
      if (banDuration.toLowerCase() === "test") {
        unbanDelay = 30000;
      } else if (banDuration.toLowerCase().endsWith("h")) {
        const hours = parseFloat(banDuration.slice(0, -1));
        unbanDelay = hours * 3600000;
      } else if (banDuration.toLowerCase().endsWith("d")) {
        const days = parseFloat(banDuration.slice(0, -1));
        unbanDelay = days * 86400000;
      } else if (banDuration.toLowerCase().endsWith("m")) {
        const months = parseFloat(banDuration.slice(0, -1));
        unbanDelay = months * 2592000000;
      }
      if (unbanDelay) {
        unbanTimestamp =
          Math.floor(Date.now() / 1000) + Math.floor(unbanDelay / 1000);
      }
    }

    let unbanTimeString = "";
    if (unbanTimestamp) {
      unbanTimeString = new Date(unbanTimestamp * 1000).toLocaleString();
    }

    const staffEmbed = new EmbedBuilder()
      .setTitle("🚨 Confirm Ban")
      .setDescription(
        `You are about to ban **${targetUser.tag}** from the server.`
      )
      .addFields(
        { name: "🆔 Ban ID", value: banID, inline: true },
        { name: "👤 User", value: targetUser.tag, inline: true },
        { name: "📄 Reason", value: reason },
        { name: "🔨 Ban Type", value: banType, inline: true },
        { name: "⏳ Duration", value: banDuration, inline: true },
        { name: "⏰ Time", value: new Date().toLocaleString(), inline: true }
      )
      .setColor(0xffa500)
      .setFooter({
        text: "Reply with evidence (attach an image or video) to finalize the ban.",
      });
    if (unbanTimestamp) {
      staffEmbed.addFields({
        name: "⏲ Unban Time",
        value: unbanTimeString,
        inline: true,
      });
    }

    let staffDM;
    try {
      staffDM = await interaction.user.send({ embeds: [staffEmbed] });
    } catch (error) {
      console.error("Failed to send DM to staff member:", error);
      return interaction.editReply({
        content: "❌ Unable to send you a DM. Please check your DM settings.",
      });
    }

    const filter = (msg) =>
      msg.author.id === interaction.user.id && msg.attachments.size > 0;
    let evidence;
    try {
      const collected = await staffDM.channel.awaitMessages({
        filter,
        max: 1,
        time: 60000,
        errors: ["time"],
      });
      evidence = collected.first().attachments.first().url;
    } catch (error) {
      return interaction.editReply({
        content: "⚠️ Ban creation cancelled: evidence not provided in time.",
      });
    }

    staffEmbed.addFields({ name: "📎 Evidence", value: evidence });
    staffEmbed.setFooter({ text: "Ban finalized." });
    await interaction.user.send({
      content: "✅ Evidence received, finalizing ban...",
      embeds: [staffEmbed],
    });

    const userEmbed = new EmbedBuilder()
      .setTitle("🚨 You have been banned")
      .setDescription(
        `You have been banned from **${interaction.guild.name}** by **${interaction.user.tag}**.`
      )
      .addFields(
        { name: "🆔 Ban ID", value: banID, inline: true },
        { name: "📄 Reason", value: reason },
        { name: "🔨 Ban Type", value: banType, inline: true },
        { name: "⏳ Duration", value: banDuration, inline: true },
        { name: "⏰ Time", value: new Date().toLocaleString(), inline: true }
      )
      .setColor(0xff4500)
      .setFooter({
        text: "To appeal, please open a ticket (🎫) and reference your Ban ID.",
      });
    if (unbanTimestamp) {
      userEmbed.addFields(
        { name: "⏲ Unban Time", value: unbanTimeString, inline: true },
        {
          name: "📨 Server Invite",
          value: "https://discord.gg/QxQwXfUHW9",
          inline: false,
        }
      );
    }

    try {
      await targetUser.send({ embeds: [userEmbed] });
    } catch (error) {
      console.error("Failed to send DM to the banned user:", error);
      try {
        const fallbackChannel = await client.channels.fetch(
          "1360689865871589587"
        );
        if (fallbackChannel) {
          fallbackChannel.send({
            content: `<@${targetUser.id}> Your DMs are off. Here is your ban notice:`,
            embeds: [userEmbed],
          });
        }
      } catch (fallbackError) {
        console.error(
          "Failed to send message in fallback channel:",
          fallbackError
        );
      }
    }

    let member;
    try {
      member = await interaction.guild.members.fetch(targetUser.id);
    } catch (error) {
      console.error("Error fetching guild member:", error);
      return interaction.editReply({
        content: "❌ Could not find the specified user in this server.",
      });
    }
    try {
      await interaction.guild.members.ban(targetUser, { reason });
    } catch (error) {
      console.error("Error banning member:", error);
      return interaction.editReply({
        content:
          "❌ Failed to ban the user. Check my permissions and role hierarchy.",
      });
    }

    // NOTE: Removed insertion into modlogs table for column 'id'
    db.run(
      `INSERT INTO modlogs (punishment_id, user_id, moderator_id, action, reason, duration, timestamp, channel_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        banID,
        targetUser.id,
        interaction.user.id,
        "ban",
        reason,
        banDuration,
        Math.floor(Date.now() / 1000),
        interaction.channelId,
      ],
      function (err) {
        if (err) {
          console.error("Error inserting ban into database:", err.message);
        } else {
          console.log(`Ban ${banID} logged for ${targetUser.tag}`);
        }
      }
    );

    if (banType !== "Permanent" && unbanTimestamp !== null) {
      db.run(
        `INSERT INTO temp_bans (ban_id, user_id, guild_id, unban_timestamp)
         VALUES (?, ?, ?, ?)`,
        [banID, targetUser.id, interaction.guild.id, unbanTimestamp],
        function (err) {
          if (err) {
            console.error("Error inserting into temp_bans:", err.message);
          } else {
            console.log(
              `Temporary ban record ${banID} stored with unban at ${unbanTimestamp}`
            );
          }
        }
      );
    }

    await interaction.editReply({
      content: `✅ Ban issued successfully (Ban ID: ${banID}).`,
    });

    if (client.config.MOD_LOG_CHANNEL) {
      try {
        const modChannel = await client.channels.fetch(
          client.config.MOD_LOG_CHANNEL
        );
        if (modChannel) {
          const modLogEmbed = new EmbedBuilder()
            .setTitle("🚀 New Ban Issued")
            .setDescription(`**${targetUser.tag}** has been banned.`)
            .addFields(
              { name: "🆔 Ban ID", value: banID, inline: true },
              {
                name: "👤 Moderator",
                value: interaction.user.tag,
                inline: true,
              },
              { name: "📄 Reason", value: reason },
              { name: "🔨 Ban Type", value: banType, inline: true },
              { name: "⏳ Duration", value: banDuration, inline: true },
              {
                name: "⏰ Time",
                value: new Date().toLocaleString(),
                inline: true,
              }
            )
            .setColor(0xffd700);
          if (unbanTimestamp) {
            modLogEmbed.addFields({
              name: "⏲ Unban Time",
              value: unbanTimeString,
              inline: true,
            });
          }
          modLogEmbed.addFields({ name: "📎 Evidence", value: evidence });
          modChannel.send({ embeds: [modLogEmbed] });
        }
      } catch (error) {
        console.error("Failed to send mod log message:", error);
      }
    } else {
      console.log("MOD_LOG_CHANNEL is not configured.");
    }
  },
};

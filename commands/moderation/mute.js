// /commands/moderation/mute.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../schemas/database.js");
const crypto = require("crypto");

module.exports = {
  // Restrict command to staff members.
  admin: true,
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription(
      "🤫 Mutes a user for a specified duration and logs the event."
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to mute")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("duration")
        .setDescription(
          "Mute duration (e.g., 10m for 10 minutes, 1h for 1 hour, 1d for 1 day)"
        )
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the mute")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    // Verify that the executor has one of the configured staff roles.
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
      content: "⏳ Processing mute...",
      ephemeral: true,
    });

    // Retrieve options.
    const targetUser = interaction.options.getUser("user");
    const durationInput = interaction.options.getString("duration");
    const reason = interaction.options.getString("reason");

    // Generate a short unique Mute ID.
    const muteID = crypto.randomBytes(4).toString("hex");

    // Parse duration input into milliseconds.
    let timeoutDuration = null;
    const inputLower = durationInput.toLowerCase();
    if (inputLower.endsWith("m")) {
      const minutes = parseFloat(durationInput.slice(0, -1));
      timeoutDuration = minutes * 60000;
    } else if (inputLower.endsWith("h")) {
      const hours = parseFloat(durationInput.slice(0, -1));
      timeoutDuration = hours * 3600000;
    } else if (inputLower.endsWith("d")) {
      const days = parseFloat(durationInput.slice(0, -1));
      timeoutDuration = days * 86400000;
    } else {
      return interaction.editReply({
        content:
          "❌ Invalid duration format. Please specify a valid duration (e.g., 10m, 1h, 1d).",
      });
    }

    const muteTimeString = new Date().toLocaleString();

    // Fetch the guild member to mute.
    let member;
    try {
      member = await interaction.guild.members.fetch(targetUser.id);
    } catch (error) {
      console.error("Error fetching guild member:", error);
      return interaction.editReply({
        content: "❌ Could not find the specified user in this server.",
      });
    }

    // Apply the timeout (mute) using Discord's built-in timeout feature.
    try {
      await member.timeout(timeoutDuration, reason);
    } catch (error) {
      console.error("Error applying timeout:", error);
      return interaction.editReply({
        content:
          "❌ Failed to mute the user. Check my permissions and role hierarchy.",
      });
    }

    // Build the mod log embed.
    const modLogEmbed = new EmbedBuilder()
      .setTitle("🚀 New Mute Issued")
      .setDescription(`**${targetUser.tag}** has been muted.`)
      .addFields(
        { name: "🆔 Mute ID", value: muteID, inline: true },
        { name: "👤 Moderator", value: interaction.user.tag, inline: true },
        { name: "📄 Reason", value: reason, inline: false },
        { name: "⏳ Duration", value: durationInput, inline: true },
        { name: "⏰ Time", value: muteTimeString, inline: true }
      )
      .setColor(0xffd700);

    // Log the mute event in the modlogs table.
    // Here we let the "id" column auto-increment and include our custom muteID in the reason text.
    db.run(
      `INSERT INTO modlogs (punishment_id, user_id, moderator_id, action, reason, duration, timestamp, channel_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        muteID,
        targetUser.id,
        interaction.user.id,
        "mute",
        `Mute ID: ${muteID}\n${reason}`,
        durationInput,
        Math.floor(Date.now() / 1000),
        interaction.channelId,
      ],
      function (err) {
        if (err) {
          console.error("Error inserting mute into database:", err.message);
        } else {
          console.log(`Mute ${muteID} logged for ${targetUser.tag}`);
        }
      }
    );

    // Build the notification embed for the muted user.
    const userEmbed = new EmbedBuilder()
      .setTitle("🤫 You have been muted")
      .setDescription(
        `You have been muted in **${interaction.guild.name}** by **${interaction.user.tag}**.`
      )
      .addFields(
        { name: "🆔 Mute ID", value: muteID, inline: true },
        { name: "📄 Reason", value: reason },
        { name: "⏳ Duration", value: durationInput, inline: true },
        { name: "⏰ Time", value: muteTimeString, inline: true }
      )
      .setColor(0xff4500)
      .setFooter({
        text: "If you believe this is a mistake, please open a ticket (🎫) to appeal.",
      });

    // Attempt to DM the muted user. If DMs are off, send the embed in a fallback channel.
    try {
      await targetUser.send({ embeds: [userEmbed] });
    } catch (error) {
      console.error("Failed to send DM to the muted user:", error);
      try {
        const fallbackChannel = await client.channels.fetch(
          "1360689865871589587"
        );
        if (fallbackChannel) {
          fallbackChannel.send({
            content: `<@${targetUser.id}> Your DMs are off. Here is your mute notice:`,
            embeds: [userEmbed],
          });
        }
      } catch (fallbackError) {
        console.error(
          "Failed to send mute notice in fallback channel:",
          fallbackError
        );
      }
    }

    // Confirm to the staff member that the mute was successfully applied.
    await interaction.editReply({
      content: `✅ **${targetUser.tag}** has been muted (Mute ID: ${muteID}).`,
    });

    // Send the mod log embed to the mod log channel if configured.
    if (client.config.MOD_LOG_CHANNEL) {
      try {
        const modChannel = await client.channels.fetch(
          client.config.MOD_LOG_CHANNEL
        );
        if (modChannel) {
          modChannel.send({ embeds: [modLogEmbed] });
        }
      } catch (error) {
        console.error("Failed to send mute log message:", error);
      }
    } else {
      console.log("MOD_LOG_CHANNEL is not configured.");
    }
  },
};

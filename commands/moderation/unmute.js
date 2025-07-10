// /commands/moderation/unmute.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../schemas/database.js");

module.exports = {
  // Restrict to staff members.
  admin: true,
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("🔓 Removes a mute from a user and logs the event.")
    .addStringOption((option) =>
      option
        .setName("user_id")
        .setDescription("The ID of the user to unmute")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    // Verify staff permissions.
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
      content: "⏳ Processing unmute...",
      ephemeral: true,
    });

    const userId = interaction.options.getString("user_id");

    try {
      // Fetch the guild member and remove their timeout.
      const member = await interaction.guild.members.fetch(userId);
      await member.timeout(null, "Unmute command executed");

      // Build the mod log embed.
      const unmuteEmbed = new EmbedBuilder()
        .setTitle("🔓 User Unmuted")
        .setDescription(`User with ID **${userId}** has been unmuted.`)
        .addFields(
          { name: "👤 Unmuted by", value: interaction.user.tag, inline: true },
          { name: "🆔 Moderator ID", value: interaction.user.id, inline: true },
          { name: "⏰ Time", value: new Date().toLocaleString(), inline: true }
        )
        .setColor(0x00ff00);

      // Send the log to the mod log channel if configured.
      if (client.config.MOD_LOG_CHANNEL) {
        try {
          const modChannel = await client.channels.fetch(
            client.config.MOD_LOG_CHANNEL
          );
          if (modChannel) {
            modChannel.send({ embeds: [unmuteEmbed] });
          }
        } catch (err) {
          console.error("Error sending unmute log to mod channel:", err);
        }
      }

      // Log the unmute event in the modlogs table.
      db.run(
        `INSERT INTO modlogs (punishment_id, user_id, moderator_id, action, reason, timestamp, channel_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          null,
          userId,
          interaction.user.id,
          "unmute",
          "User manually unmuted",
          Math.floor(Date.now() / 1000),
          interaction.channelId,
        ],
        function (err) {
          if (err) {
            console.error("Error logging unmute in database:", err);
          }
        }
      );

      await interaction.editReply({
        content: `✅ User with ID **${userId}** has been unmuted and the event has been logged.`,
      });
    } catch (error) {
      console.error("Error unmuting user:", error);
      await interaction.editReply({
        content:
          "❌ Failed to unmute the user. Please verify if the user is muted and try again.",
      });
    }
  },
};

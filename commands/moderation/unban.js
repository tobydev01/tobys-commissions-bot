// /commands/moderation/unban.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../schemas/database.js");

module.exports = {
  // This command is restricted to staff members.
  admin: true,
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("🚫 Unbans a user from the server and logs the event.")
    .addStringOption((option) =>
      option
        .setName("user_id")
        .setDescription("The ID of the user to unban")
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
      content: "⏳ Processing unban...",
      ephemeral: true,
    });

    const userId = interaction.options.getString("user_id");

    try {
      // Attempt to unban the user from the guild.
      await interaction.guild.members.unban(userId, "Unban command executed");

      // Build the mod log embed.
      const unbanEmbed = new EmbedBuilder()
        .setTitle("🔓 User Unbanned")
        .setDescription(`User with ID **${userId}** has been unbanned.`)
        .addFields(
          { name: "👤 Unbanned by", value: interaction.user.tag, inline: true },
          { name: "🆔 Moderator ID", value: interaction.user.id, inline: true },
          { name: "⏰ Time", value: new Date().toLocaleString(), inline: true }
        )
        .setColor(0x00ff00);

      // Send the log to the mod log channel if it is configured.
      if (client.config.MOD_LOG_CHANNEL) {
        try {
          const modChannel = await client.channels.fetch(
            client.config.MOD_LOG_CHANNEL
          );
          if (modChannel) {
            modChannel.send({ embeds: [unbanEmbed] });
          }
        } catch (err) {
          console.error("Error sending unban log to mod channel:", err);
        }
      }

      // Log the unban event in the modlogs table.
      // The modlogs table structure (from your init.sql) is:
      // (id, user_id, moderator_id, action, reason, duration, timestamp, channel_id)
      // For this unban record, we set action as "unban", provide a reason message,
      // and leave duration empty.
      db.run(
        `INSERT INTO modlogs (punishment_id, user_id, moderator_id, action, reason, timestamp, channel_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          null,
          userId,
          interaction.user.id,
          "unban",
          "User manually unbanned",
          Math.floor(Date.now() / 1000),
          interaction.channelId,
        ],
        function (err) {
          if (err) {
            console.error("Error logging unban in database:", err);
          }
        }
      );

      await interaction.editReply({
        content: `✅ User with ID **${userId}** has been unbanned and the event has been logged.`,
      });
    } catch (error) {
      console.error("Error unbanning user:", error);
      await interaction.editReply({
        content:
          "❌ Failed to unban the user. Please verify if the user is banned and try again.",
      });
    }
  },
};

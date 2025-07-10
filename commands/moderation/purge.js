// /commands/moderation/purge.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../schemas/database.js");

module.exports = {
  // This command is restricted to staff members.
  admin: true,
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription(
      "🧹 Deletes a number of messages in this channel and logs the purge."
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("The number of messages to delete (1-100)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for purging messages")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    // Check that the executor holds one of the staff roles.
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
      content: "⏳ Purging messages...",
      ephemeral: true,
    });

    const amount = interaction.options.getInteger("amount");
    const reason = interaction.options.getString("reason");

    // Validate the amount: bulkDelete supports 1 to 100 messages.
    if (amount < 1 || amount > 100) {
      return interaction.editReply({
        content: "❌ Please provide a number between 1 and 100.",
      });
    }

    try {
      // Bulk delete messages; the second parameter "true" ensures that messages older than 14 days are skipped.
      const deleted = await interaction.channel.bulkDelete(amount, true);
      const purgeCount = deleted.size;

      // Build the mod log embed.
      const modLogEmbed = new EmbedBuilder()
        .setTitle("🧹 Messages Purged")
        .setDescription(
          `**${purgeCount}** messages have been purged from <#${interaction.channelId}>.`
        )
        .addFields(
          { name: "Moderator", value: interaction.user.tag, inline: true },
          { name: "Reason", value: reason, inline: true },
          { name: "Time", value: new Date().toLocaleString(), inline: true }
        )
        .setColor(0xffa500);

      // Insert the purge event into the modlogs table.
      // We use "Multiple" as the user_id because multiple messages from multiple users are affected.
      db.run(
        `INSERT INTO modlogs (punishment_id, user_id, moderator_id, action, reason, duration, timestamp, channel_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          null,
          "Multiple",
          interaction.user.id,
          "purge",
          `Purged ${purgeCount} messages. Reason: ${reason}`,
          "", // No duration applicable
          Math.floor(Date.now() / 1000),
          interaction.channelId,
        ],
        function (err) {
          if (err) {
            console.error("Error inserting purge into database:", err.message);
          } else {
            console.log(
              `Purge logged: ${purgeCount} messages purged by ${interaction.user.tag}`
            );
          }
        }
      );

      // Send the mod log embed to the mod log channel if configured.
      if (client.config.MOD_LOG_CHANNEL) {
        try {
          const modChannel = await client.channels.fetch(
            client.config.MOD_LOG_CHANNEL
          );
          if (modChannel) {
            modChannel.send({ embeds: [modLogEmbed] });
          }
        } catch (e) {
          console.error("Failed to send purge log to mod channel:", e);
        }
      } else {
        console.log("MOD_LOG_CHANNEL is not configured.");
      }

      await interaction.editReply({
        content: `✅ Successfully purged **${purgeCount}** messages.`,
      });
    } catch (error) {
      console.error("Error purging messages:", error);
      await interaction.editReply({
        content: "❌ An error occurred while purging messages.",
      });
    }
  },
};

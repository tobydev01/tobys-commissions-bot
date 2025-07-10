// /commands/moderation/modlog_view.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const db = require("../../schemas/database.js");

module.exports = {
  // Restrict command to staff members.
  admin: true,
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName("modlog")
    .setDescription("Views moderation logs for a user.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View all mod logs for a specified user")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user whose logs you wish to view")
            .setRequired(true)
        )
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

    await interaction.deferReply({ ephemeral: true });

    // Get the user from the command options.
    const user = interaction.options.getUser("user");

    // Query the database for logs for this user. (Assumes modlogs table includes a column "punishment_id".)
    db.all(
      "SELECT * FROM modlogs WHERE user_id = ? ORDER BY timestamp ASC",
      [user.id],
      async (err, rows) => {
        if (err) {
          console.error("Error querying modlogs:", err);
          return interaction.editReply({
            content: "❌ An error occurred while retrieving mod logs.",
          });
        }

        if (!rows || rows.length === 0) {
          return interaction.editReply({
            content: `ℹ️ No mod logs found for **${user.tag}**.`,
          });
        }

        // Paginate the results—show 5 logs per page.
        const logsPerPage = 5;
        const totalPages = Math.ceil(rows.length / logsPerPage);

        // Format a single log entry as a string.
        const formatLog = (log) => {
          return `**Punishment ID:** ${log.punishment_id || "N/A"}
**Action:** ${log.action}
**Moderator:** <@${log.moderator_id}>
**Reason:** ${log.reason}
**Duration:** ${log.duration || "N/A"}
**Channel:** <#${log.channel_id}>
**Time:** ${new Date(log.timestamp * 1000).toLocaleString()}`;
        };

        // Create pages of logs.
        const pages = [];
        for (let i = 0; i < totalPages; i++) {
          const pageLogs = rows
            .slice(i * logsPerPage, (i + 1) * logsPerPage)
            .map(formatLog);
          pages.push(pageLogs.join("\n\n")); // Separate entries by an extra newline.
        }

        // Function to generate an embed for the specified page.
        const generateEmbed = (pageIndex) => {
          return new EmbedBuilder()
            .setTitle(`Moderation Logs for ${user.tag}`)
            .setDescription(pages[pageIndex])
            .setFooter({ text: `Page ${pageIndex + 1} of ${totalPages}` })
            .setColor(0x00ae86);
        };

        // Build buttons for pagination.
        const getButtons = (currentPage) => {
          return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("prev")
              .setLabel("Previous")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(currentPage === 0),
            new ButtonBuilder()
              .setCustomId("next")
              .setLabel("Next")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(currentPage === totalPages - 1)
          );
        };

        let currentPage = 0;

        // Send the initial embed.
        const message = await interaction.editReply({
          embeds: [generateEmbed(currentPage)],
          components: [getButtons(currentPage)],
        });

        // Create a collector for button interactions (only from the command invoker).
        const collector = message.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 180000, // 3 minutes
        });

        collector.on("collect", async (i) => {
          // Ensure only the command invoker can interact.
          if (i.user.id !== interaction.user.id) {
            return i.reply({
              content: "❌ These buttons are not for you!",
              ephemeral: true,
            });
          }

          // Update currentPage based on which button was pressed.
          if (i.customId === "prev" && currentPage > 0) {
            currentPage--;
          } else if (i.customId === "next" && currentPage < totalPages - 1) {
            currentPage++;
          }

          await i.update({
            embeds: [generateEmbed(currentPage)],
            components: [getButtons(currentPage)],
          });
        });

        collector.on("end", async () => {
          // Disable buttons when collector expires.
          if (message.editable) {
            await message.edit({ components: [] });
          }
        });
      }
    );
  },
};

// /commands/moderation/warn.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../schemas/database.js");
const crypto = require("crypto");

module.exports = {
  admin: true,
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("⚠️ Issues a warning to a user and logs it.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("👤 The user to warn")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("📄 Reason for the warning")
        .setRequired(true)
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
      content: "⏳ Processing warning...",
      ephemeral: true,
    });

    const targetUser = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");

    const warnID = crypto.randomBytes(4).toString("hex");

    const staffEmbed = new EmbedBuilder()
      .setTitle("⚠️ Confirm Warning")
      .setDescription(
        `You are about to issue a warning to **${targetUser.tag}**.`
      )
      .addFields(
        { name: "🆔 Warn ID", value: warnID, inline: true },
        { name: "👤 User", value: targetUser.tag, inline: true },
        { name: "📄 Reason", value: reason },
        { name: "⏰ Time", value: new Date().toLocaleString(), inline: true }
      )
      .setFooter({
        text: "Please reply with evidence (attach an image or video) to finalize the warning.",
      })
      .setColor(0xffa500);

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
        content:
          "⚠️ Warning creation cancelled: evidence not provided in time.",
      });
    }

    staffEmbed.addFields({ name: "📎 Evidence", value: evidence });
    staffEmbed.setFooter({ text: "Warning finalized." });
    await interaction.user.send({
      content: "✅ Evidence received, finalizing warning...",
      embeds: [staffEmbed],
    });

    const userEmbed = new EmbedBuilder()
      .setTitle("🚨 You have received a warning")
      .setDescription(`You have been warned by **${interaction.user.tag}**.`)
      .addFields(
        { name: "🆔 Warn ID", value: warnID, inline: true },
        { name: "📄 Reason", value: reason },
        { name: "⏰ Time", value: new Date().toLocaleString(), inline: true }
      )
      .setFooter({
        text: "To appeal, please open a ticket (🎫) and reference your Warn ID.",
      })
      .setColor(0xff0000);

    try {
      await targetUser.send({ embeds: [userEmbed] });
    } catch (error) {
      console.error("Failed to send DM to the warned user:", error);
      try {
        const fallbackChannel = await client.channels.fetch(
          "1360689865871589587"
        );
        if (fallbackChannel) {
          fallbackChannel.send({
            content: `<@${targetUser.id}> Your DMs are off. Here is your warning:`,
            embeds: [userEmbed],
          });
        }
      } catch (fallbackError) {
        console.error(
          "Failed to send warning in fallback channel:",
          fallbackError
        );
      }
    }

    db.run(
      `INSERT INTO modlogs (punishment_id, user_id, moderator_id, action, reason, timestamp, channel_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        warnID,
        targetUser.id,
        interaction.user.id,
        "warn",
        reason,
        Math.floor(Date.now() / 1000),
        interaction.channelId,
      ],
      function (err) {
        if (err) {
          console.error("Error inserting warn into database:", err.message);
        } else {
          console.log(`Warn ${warnID} logged for ${targetUser.tag}`);
        }
      }
    );

    await interaction.editReply({
      content: `✅ Warning issued successfully (Warn ID: ${warnID}).`,
    });

    if (client.config.MOD_LOG_CHANNEL) {
      try {
        const modChannel = await client.channels.fetch(
          client.config.MOD_LOG_CHANNEL
        );
        if (modChannel) {
          const modLogEmbed = new EmbedBuilder()
            .setTitle("⚠️ New Warning Issued")
            .setDescription(`**${targetUser.tag}** has been warned.`)
            .addFields(
              { name: "🆔 Warn ID", value: warnID, inline: true },
              {
                name: "👤 Moderator",
                value: interaction.user.tag,
                inline: true,
              },
              { name: "📄 Reason", value: reason },
              {
                name: "⏰ Time",
                value: new Date().toLocaleString(),
                inline: true,
              },
              { name: "📎 Evidence", value: evidence }
            )
            .setColor(0xffff00);
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

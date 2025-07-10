// /commands/moderation/kick.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../schemas/database.js");
const crypto = require("crypto");

module.exports = {
  admin: true,
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("🚀 Kicks a user from the server and logs the event.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("👤 The user to kick")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("📄 Reason for the kick")
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
      content: "⏳ Processing kick...",
      ephemeral: true,
    });

    const targetUser = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");

    const kickID = crypto.randomBytes(4).toString("hex");

    const staffEmbed = new EmbedBuilder()
      .setTitle("🚨 Confirm Kick")
      .setDescription(
        `You are about to kick **${targetUser.tag}** from the server.`
      )
      .addFields(
        { name: "🆔 Kick ID", value: kickID, inline: true },
        { name: "👤 User", value: targetUser.tag, inline: true },
        { name: "📄 Reason", value: reason },
        { name: "⏰ Time", value: new Date().toLocaleString(), inline: true }
      )
      .setFooter({
        text: "Reply with evidence (attach an image or video) to finalize the kick.",
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
        content: "⚠️ Kick creation cancelled: evidence not provided in time.",
      });
    }

    staffEmbed.addFields({ name: "📎 Evidence", value: evidence });
    staffEmbed.setFooter({ text: "Kick finalized." });
    await interaction.user.send({
      content: "✅ Evidence received, finalizing kick...",
      embeds: [staffEmbed],
    });

    const userEmbed = new EmbedBuilder()
      .setTitle("🚨 You have been kicked")
      .setDescription(
        `You have been kicked from **${interaction.guild.name}** by **${interaction.user.tag}**.`
      )
      .addFields(
        { name: "🆔 Kick ID", value: kickID, inline: true },
        { name: "📄 Reason", value: reason },
        { name: "⏰ Time", value: new Date().toLocaleString(), inline: true }
      )
      .setFooter({
        text: "To appeal, please open a ticket (🎫) and reference your Kick ID.",
      })
      .setColor(0xff4500);

    try {
      await targetUser.send({ embeds: [userEmbed] });
    } catch (error) {
      console.error("Failed to send DM to the user:", error);
      try {
        const fallbackChannel = await client.channels.fetch(
          "1360689865871589587"
        );
        if (fallbackChannel) {
          fallbackChannel.send({
            content: `<@${targetUser.id}> Your DMs are off. Here is your kick notice:`,
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
      await member.kick(reason);
    } catch (error) {
      console.error("Error kicking member:", error);
      return interaction.editReply({
        content:
          "❌ Failed to kick the user. Please check my permissions and role hierarchy.",
      });
    }

    db.run(
      `INSERT INTO modlogs (punishment_id, user_id, moderator_id, action, reason, timestamp, channel_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        kickID,
        targetUser.id,
        interaction.user.id,
        "kick",
        reason,
        Math.floor(Date.now() / 1000),
        interaction.channelId,
      ],
      function (err) {
        if (err) {
          console.error("Error inserting kick into database:", err.message);
        } else {
          console.log(`Kick ${kickID} logged for ${targetUser.tag}`);
        }
      }
    );

    await interaction.editReply({
      content: `✅ Kick issued successfully (Kick ID: ${kickID}).`,
    });

    if (client.config.MOD_LOG_CHANNEL) {
      try {
        const modChannel = await client.channels.fetch(
          client.config.MOD_LOG_CHANNEL
        );
        if (modChannel) {
          const modLogEmbed = new EmbedBuilder()
            .setTitle("🚀 New Kick Issued")
            .setDescription(`**${targetUser.tag}** has been kicked.`)
            .addFields(
              { name: "🆔 Kick ID", value: kickID, inline: true },
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

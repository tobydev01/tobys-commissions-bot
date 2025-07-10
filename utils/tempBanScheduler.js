// /utils/tempBanScheduler.js
const db = require("../schemas/database.js");
const { EmbedBuilder } = require("discord.js");

async function processExpiredTempBans(client) {
  const now = Math.floor(Date.now() / 1000);
  db.all(
    "SELECT * FROM temp_bans WHERE unban_timestamp <= ?",
    [now],
    async (err, rows) => {
      if (err) {
        console.error("Error fetching temporary bans:", err.message);
        return;
      }
      for (const row of rows) {
        try {
          // Get the guild.
          let guild = client.guilds.cache.get(row.guild_id);
          if (!guild) {
            guild = await client.guilds.fetch(row.guild_id);
          }
          if (!guild) continue;

          // Attempt to unban the user.
          await guild.members
            .unban(row.user_id, "Temporary ban expired")
            .catch((error) => {
              // If error code 10026 "Unknown Ban" is returned, log and ignore
              if (error.code === 10026) {
                console.log(`User ${row.user_id} is not banned (Unknown Ban).`);
              } else {
                // Re-throw other errors
                throw error;
              }
            });
          console.log(
            `Temporary ban ${row.ban_id} for user ${row.user_id} in guild ${row.guild_id} has been lifted.`
          );

          // Optionally, notify the mod log channel.
          if (client.config.MOD_LOG_CHANNEL) {
            try {
              const modChannel = await client.channels.fetch(
                client.config.MOD_LOG_CHANNEL
              );
              if (modChannel) {
                const unbanEmbed = new EmbedBuilder()
                  .setTitle("🔓 Temporary Ban Lifted")
                  .setDescription(
                    `Temporary ban for <@${row.user_id}> (Ban ID: ${row.ban_id}) has been lifted.`
                  )
                  .setColor(0x00ff00)
                  .setTimestamp();
                modChannel.send({ embeds: [unbanEmbed] });
              }
            } catch (notifyErr) {
              console.error(
                "Error sending temporary unban mod log:",
                notifyErr
              );
            }
          }

          // Remove the record from temp_bans so it is not checked again.
          db.run(
            "DELETE FROM temp_bans WHERE ban_id = ?",
            [row.ban_id],
            (err) => {
              if (err) {
                console.error(
                  "Error deleting temporary ban record:",
                  err.message
                );
              }
            }
          );
        } catch (error) {
          console.error(
            `Error unbanning user ${row.user_id} in guild ${row.guild_id}:`,
            error
          );
        }
      }
    }
  );
}

module.exports = function scheduleTempBanCheck(client) {
  // Run an immediate check on startup.
  processExpiredTempBans(client);

  // Then schedule a check every minute.
  setInterval(() => {
    processExpiredTempBans(client);
  }, 60000); // 60000 ms = 1 minute
};

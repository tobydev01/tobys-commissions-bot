const db = require("../schemas/database.js");

module.exports = {
  // Must match the static customID above
  customID: "modnoteAddModal",

  async execute(interaction, client) {
    try {
      // 1. Look up which user this note is for
      const cacheKey = `modnoteAdd:${interaction.user.id}`;
      if (!client.cache) client.cache = new Map();
      const targetUserId = client.cache.get(cacheKey);

      if (!targetUserId) {
        console.error("[modnote_add] Missing cache entry for", cacheKey);
        return interaction.reply({
          content:
            "❌ Could not determine which user this note is for. Please try again.",
          ephemeral: true,
        });
      }
      // Clean up
      client.cache.delete(cacheKey);

      // 2. Grab the modal inputs
      const noteTitle = interaction.fields.getTextInputValue("noteTitle") || "";
      const noteContent =
        interaction.fields.getTextInputValue("noteContent") || "";
      if (!noteContent) {
        return interaction.reply({
          content: "❌ Note content cannot be empty.",
          ephemeral: true,
        });
      }

      // 3. Format and insert into the database
      const fullNote = noteTitle
        ? `**${noteTitle}**\n${noteContent}`
        : noteContent;
      const timestamp = Math.floor(Date.now() / 1000);

      db.run(
        `INSERT INTO usernotes (user_id, staff_id, note, timestamp) VALUES (?, ?, ?, ?)`,
        [targetUserId, interaction.user.id, fullNote, timestamp],
        function (err) {
          if (err) {
            console.error("[modnote_add] DB error:", err.message);
            return interaction.reply({
              content: "❌ There was an error saving the mod note.",
              ephemeral: true,
            });
          }
          console.log(`[modnote_add] Note saved for ${targetUserId}`);
          return interaction.reply({
            content: "✅ Mod note added successfully.",
            ephemeral: true,
          });
        }
      );
    } catch (error) {
      console.error("[modnote_add] Handler error:", error);
      return interaction.reply({
        content: "❌ Something went wrong. Try again.",
        ephemeral: true,
      });
    }
  },
};

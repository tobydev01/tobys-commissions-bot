const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

module.exports = {
  admin: true,
  staffOnly: true,
  data: new SlashCommandBuilder()
    .setName("modnote")
    .setDescription("Mod note commands")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a private note about a user")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("The user to add a note to")
            .setRequired(true)
        )
    ),

  async execute(interaction, client) {
    // 1. Permission check
    const staffRoleIds = client.config.STAFF_ROLES;
    if (
      !interaction.member.roles.cache.some((r) => staffRoleIds.includes(r.id))
    ) {
      return interaction.reply({
        content: "❌ You do not have permission.",
        ephemeral: true,
      });
    }

    // 2. Grab the target user
    const targetUser = interaction.options.getUser("user");

    // 3. Store in cache under a key unique to this staff member
    if (!client.cache) client.cache = new Map();
    client.cache.set(`modnoteAdd:${interaction.user.id}`, targetUser.id);

    // 4. Build a modal with static customID
    const noteModal = new ModalBuilder()
      .setCustomId("modnoteAddModal")
      .setTitle("Add Mod Note");

    const titleInput = new TextInputBuilder()
      .setCustomId("noteTitle")
      .setLabel("Note Title (optional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder("Optional title");

    const contentInput = new TextInputBuilder()
      .setCustomId("noteContent")
      .setLabel("Note Content")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder("Enter your note (up to 4000 chars)");

    noteModal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(contentInput)
    );

    // 5. Show the modal
    await interaction.showModal(noteModal);
  },
};

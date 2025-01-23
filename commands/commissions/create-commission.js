const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
} = require("discord.js");
const {
  addCommission,
  createLog,
  deleteCommission,
} = require("../../utils/databaseUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("create-commission")
    .setDescription(
      "Creates a new commission and manages the details with the client."
    ),

  async execute(interaction) {
    // Check if the user has the developer role
    const developerRoleID = "1331403957431566495";
    if (!interaction.member.roles.cache.has(developerRoleID)) {
      return interaction.reply({
        content: "You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    // Generate a commission ID
    const commissionId = Math.floor(Math.random() * 1000000); // Example: random ID for the commission

    // Send an initial embed saying the process will continue in DMs
    const initialEmbed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("Creating Commission")
      .setDescription(
        `You are trying to create a new commission with ID **${commissionId}**. Please follow the prompts.`
      )
      .setFooter({
        text: "You have 3 minutes to respond before this process is auto-cancelled.",
      });

    await interaction.reply({ embeds: [initialEmbed], ephemeral: true });

    // Start the DM process
    const dmChannel = await interaction.user.createDM();

    // Step 1: Ask for client info
    const clientInfoEmbed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("Step 1: **Client Information**")
      .setDescription(
        "Please provide the client's Discord username and ID (e.g., **Username#1234, 123456789012345678**)."
      )
      .setFooter({
        text: "You have 3 minutes to respond before this process is auto-cancelled.",
      });

    await dmChannel.send({ embeds: [clientInfoEmbed] });

    const clientMessage = await dmChannel
      .awaitMessages({
        max: 1,
        time: 180000, // 3 minutes
        errors: ["time"],
        filter: (msg) => msg.author.id === interaction.user.id,
      })
      .catch(() => {
        return dmChannel.send(
          "You took too long to respond, and the process has been cancelled."
        );
      });

    const clientInfo = clientMessage.first().content;
    const [clientName, clientId] = clientInfo.split(",").map((s) => s.trim());

    // Step 2: Ask for commission details
    const detailsEmbed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("Step 2: **Commission Details**")
      .setDescription("Please provide the **full details** of the commission.")
      .setFooter({
        text: "You have 3 minutes to respond before this process is auto-cancelled.",
      });

    await dmChannel.send({ embeds: [detailsEmbed] });

    const detailsMessage = await dmChannel
      .awaitMessages({
        max: 1,
        time: 180000, // 3 minutes
        errors: ["time"],
        filter: (msg) => msg.author.id === interaction.user.id,
      })
      .catch(() => {
        return dmChannel.send(
          "You took too long to respond, and the process has been cancelled."
        );
      });

    const commissionDetails = detailsMessage.first().content;

    // Step 3: Media links (files, URLs)
    const mediaEmbed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("Step 3: **Media (optional)**")
      .setDescription(
        "Please provide any media files or links related to the commission (optional)."
      )
      .setFooter({
        text: "You have 3 minutes to respond before this process is auto-cancelled.",
      });

    await dmChannel.send({ embeds: [mediaEmbed] });

    const mediaMessage = await dmChannel
      .awaitMessages({
        max: 1,
        time: 180000, // 3 minutes
        errors: ["time"],
        filter: (msg) => msg.author.id === interaction.user.id,
      })
      .catch(() => {
        return dmChannel.send(
          "You took too long to respond, and the process has been cancelled."
        );
      });

    let mediaLinks = "";
    if (mediaMessage.first().attachments.size > 0) {
      // Collect media files if any were provided
      mediaMessage.first().attachments.forEach((attachment) => {
        mediaLinks += `[Media Link](${attachment.url})\n`;
      });
    } else if (mediaMessage.first().content) {
      mediaLinks = mediaMessage.first().content; // Any links typed by the user
    }

    // Step 4: Payment method (PayPal or Robux)
    const paymentEmbed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("Step 4: **Payment Method**")
      .setDescription("Select the **payment method**: **PayPal** or **Robux**.")
      .setFooter({
        text: "You have 3 minutes to respond before this process is auto-cancelled.",
      });

    const paymentButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("paypal").setLabel("PayPal").setStyle(1), // Primary button style
      new ButtonBuilder().setCustomId("robux").setLabel("Robux").setStyle(1) // Primary button style
    );

    await dmChannel.send({
      embeds: [paymentEmbed],
      components: [paymentButtons],
    });

    const paymentMessage = await dmChannel
      .awaitMessageComponent({
        time: 180000, // 3 minutes
        filter: (buttonInteraction) =>
          buttonInteraction.user.id === interaction.user.id,
      })
      .catch(() => {
        return dmChannel.send(
          "You took too long to respond, and the process has been cancelled."
        );
      });

    const paymentMethod = paymentMessage.customId;
    let priceEmbed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("Step 5: **Payment Amount**")
      .setDescription(
        `Please enter the amount for the commission in **${
          paymentMethod === "paypal" ? "USD (via PayPal)" : "Robux"
        }**.`
      )
      .setFooter({
        text: "You have 3 minutes to respond before this process is auto-cancelled.",
      });

    await dmChannel.send({ embeds: [priceEmbed] });

    const priceMessage = await dmChannel
      .awaitMessages({
        max: 1,
        time: 180000, // 3 minutes
        errors: ["time"],
        filter: (msg) => msg.author.id === interaction.user.id,
      })
      .catch(() => {
        return dmChannel.send(
          "You took too long to respond, and the process has been cancelled."
        );
      });

    const price = priceMessage.first().content;

    // Step 6: Review all commission details
    const reviewEmbed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("Review Commission Details")
      .setDescription(
        `
                **Client**: ${clientName} (${clientId})
                **Details**: ${commissionDetails}
                **Media**: ${mediaLinks || "None provided"}
                **Payment**: ${paymentMethod} - ${price}
            `
      )
      .setFooter({
        text: "You have 48 hours to respond before this process is auto-cancelled.",
      });

    const confirmButton = new ButtonBuilder()
      .setCustomId("confirm")
      .setLabel("Confirm Commission")
      .setStyle(3); // Success style
    const denyButton = new ButtonBuilder()
      .setCustomId("deny")
      .setLabel("Deny Commission")
      .setStyle(4); // Danger style

    const actionRow = new ActionRowBuilder().addComponents(
      confirmButton,
      denyButton
    );

    await dmChannel.send({ embeds: [reviewEmbed], components: [actionRow] });

    // Wait for the client to confirm or deny the commission
    const response = await dmChannel
      .awaitMessageComponent({
        time: 172800000, // 3 minutes
        filter: (buttonInteraction) =>
          buttonInteraction.user.id === interaction.user.id,
      })
      .catch(() => {
        return dmChannel.send(
          "You took too long to respond, and the process has been cancelled."
        );
      });

    // Commission confirmation logic
    if (response.customId === "confirm") {
      // Add commission to the database, including media
      await addCommission(
        commissionId, // Pass the random ID
        clientId,
        commissionDetails,
        price,
        paymentMethod,
        mediaLinks
      );

      // Log the commission creation
      const logMessage = `Commission created with ID: ${commissionId} by ${interaction.user.tag}.`;
      await createLog("Commission", logMessage);

      // Create the commission channel under 'commissions' category
      const commissionCategory = interaction.guild.channels.cache.find(
        (c) => c.name === "commissions" && c.type === 4
      );
      if (!commissionCategory) {
        return dmChannel.send(
          "Could not find a category to create the commission channel."
        );
      }

      // Generate a channel name with the commission ID
      const commissionChannelName = `commission-${commissionId}`;

      // Create the channel with all required fields
      const commissionChannel = await interaction.guild.channels.create({
        name: commissionChannelName, // Name of the channel
        type: 0, // Text channel
        parent: commissionCategory.id, // Parent category for the channel
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: ["ViewChannel"], // Deny all access to the channel initially
          },
          {
            id: clientId,
            allow: ["ViewChannel"], // Allow the client to view the channel
          },
          {
            id: interaction.user.id,
            allow: ["ViewChannel"], // Allow the creator (developer) to view the channel
          },
        ],
      });

      // Send a confirmation DM to the user
      await dmChannel.send(
        `Commission with ID: **${commissionId}** has been successfully created! You can view the commission details in the new channel: ${commissionChannel.toString()}`
      );

      // Now send the commission details to the developer (you)
      const developerUser = await interaction.guild.members.fetch(
        interaction.user.id
      );

      const developerEmbed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle("New Commission Created")
        .setDescription(
          `A new commission has been created! Here are the details:`
        )
        .addFields(
          {
            name: "Commission ID",
            value: commissionId.toString(),
            inline: true,
          }, // Convert to string
          {
            name: "Client",
            value: `${clientName} (${clientId})`,
            inline: true,
          },
          { name: "Details", value: commissionDetails, inline: true },
          { name: "Media", value: mediaLinks || "None provided", inline: true },
          { name: "Payment Method", value: paymentMethod, inline: true },
          { name: "Price", value: price, inline: true }
        )
        .setFooter({ text: "Commission created by " + interaction.user.tag });

      await developerUser.send({ embeds: [developerEmbed] });
    } // Step 7: Commission Denial
    else if (response.customId === "deny") {
      // Commission denied, ask for a reason
      const denyReasonEmbed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle("Please Provide a Reason for Denial")
        .setDescription(
          "Why are you denying the commission? Please provide a reason."
        )
        .setFooter({
          text: "You have 48 hours to respond before this process is auto-cancelled.",
        });

      await dmChannel.send({ embeds: [denyReasonEmbed] });

      const denyReasonMessage = await dmChannel
        .awaitMessages({
          max: 1,
          time: 172800000, // 48 hours
          errors: ["time"],
          filter: (msg) => msg.author.id === interaction.user.id,
        })
        .catch(() => {
          return dmChannel.send(
            "You took too long to respond, and the process has been cancelled."
          );
        });

      const denyReason = denyReasonMessage.first().content;

      // Log the denial reason and send a message to the developer
      await createLog(
        "Commission Denied",
        `Commission denied with reason: ${denyReason}`
      );

      // Send denial confirmation to the user
      await dmChannel.send(
        "The commission has been denied. The reason has been logged."
      );

      // Delete the commission from the database
      await deleteCommission(commissionId.toString()); // Make sure it's a string for DB

      // Send the deletion confirmation to the developer
      const developerUser = await interaction.guild.members.fetch(
        interaction.user.id
      );
      const deleteEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle("Commission Denied and Deleted")
        .setDescription(
          `A commission has been denied and deleted. Here are the details:`
        )
        .addFields(
          {
            name: "Commission ID",
            value: commissionId.toString(),
            inline: true,
          }, // Convert to string
          { name: "Reason", value: denyReason, inline: true }
        )
        .setFooter({ text: "Commission denied by " + interaction.user.tag });

      await developerUser.send({ embeds: [deleteEmbed] });

      // Send a message to the developer about re-running the command
      await developerUser.send(
        `The commission with ID ${commissionId} has been denied and deleted from the database. Please run \`/create-commission\` to remake the commission.`
      );
    }
  },
};

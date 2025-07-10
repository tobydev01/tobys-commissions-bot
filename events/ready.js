const { ActivityType } = require("discord.js");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    client.user.setActivity({
      name: "Handling Toby's Commissions!",
    });
  },
};

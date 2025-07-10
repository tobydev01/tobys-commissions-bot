// schemas/database.js
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

// Define the path to your SQLite database file
const DB_PATH = path.join(__dirname, "../botdata.db");

// Define the path to your initialization SQL file
const INIT_SQL_PATH = path.join(__dirname, "../init.sql");

// Read the initialization SQL file (this file creates all your tables)
const initSQL = fs.readFileSync(INIT_SQL_PATH, "utf-8");

// Connect to (or create) the database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Could not connect to the database:", err.message);
    process.exit(1);
  }
  console.log("Connected to SQLite database.");
});

// Execute the initialization SQL to ensure your tables are set up
db.exec(initSQL, (err) => {
  if (err) {
    console.error("Error initializing database:", err.message);
  } else {
    console.log("Database initialized successfully.");
  }
});

// Export the db so other modules can use it
module.exports = db;

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Set the path for the SQLite database file
const dbPath = path.join(__dirname, "database.sqlite");

// Create or open the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to the SQLite database.");
  }
});

// Create the tables if they don't exist
db.serialize(() => {
  // Log to confirm the database setup is happening
  console.log("Setting up the database...");

  // Check if the 'media' column exists, and add it if it doesn't
  db.all("PRAGMA table_info(Commissions);", (err, columns) => {
    if (err) {
      console.error("Error retrieving table info:", err.message);
    } else {
      const hasMediaColumn = columns.some((col) => col.name === "media");
      if (!hasMediaColumn) {
        console.log("Adding 'media' column to Commissions table...");
        db.run(`ALTER TABLE Commissions ADD COLUMN media TEXT`, (err) => {
          if (err) {
            console.error("Error adding media column:", err.message);
          } else {
            console.log("Media column added successfully.");
          }
        });
      }
    }
  });

  // Create the tables if they don't exist
  db.run(
    `
    CREATE TABLE IF NOT EXISTS Commissions (
        commission_id INTEGER PRIMARY KEY,  -- No AUTOINCREMENT, allow random IDs
        client_id TEXT,
        details TEXT,
        price INTEGER,
        status TEXT DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        payment_method TEXT,
        media TEXT
    )
  `,
    (err) => {
      if (err) {
        console.error("Error creating Commissions table:", err.message);
      } else {
        console.log("Commissions table is set up or already exists.");
      }
    }
  );

  db.run(
    `
        CREATE TABLE IF NOT EXISTS Logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,
    (err) => {
      if (err) {
        console.error("Error creating Logs table:", err.message);
      } else {
        console.log("Logs table is set up or already exists.");
      }
    }
  );
});

module.exports = { db };

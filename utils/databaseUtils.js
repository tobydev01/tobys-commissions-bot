const { db } = require("../schemas/database"); // Import the database connection

/**
 * Adds a new commission to the database.
 * @param {string} clientId - The ID of the client for the commission.
 * @param {string} commissionDetails - The details of the commission.
 * @param {number} price - The price of the commission.
 * @param {string} paymentMethod - The payment method (PayPal or Robux).
 * @param {string} media - The media links or file paths (comma-separated).
 * @returns {Promise<number>} - The commission ID of the new commission.
 */
function addCommission(
  commissionId, // Accept commissionId as a parameter
  clientId,
  commissionDetails,
  price,
  paymentMethod,
  media
) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO Commissions (commission_id, client_id, details, price, status, created_at, updated_at, payment_method, media) 
      VALUES (?, ?, ?, ?, 'Pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?)
    `;

    db.run(
      sql,
      [commissionId, clientId, commissionDetails, price, paymentMethod, media],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID); // This will return the commission_id from the database (which will be the same as the random commission ID)
        }
      }
    );
  });
}

function deleteCommission(commissionId) {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM Commissions WHERE commission_id = ?`;
    db.run(sql, [commissionId], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(`Commission ${commissionId} deleted successfully.`);
      }
    });
  });
}

/**
 * Creates a log in the database.
 * @param {string} type - The type of log (e.g., "Commission").
 * @param {string} details - The details of the log entry.
 * @returns {Promise<void>} - Resolves when the log is created.
 */
const createLog = (type, details) => {
  return new Promise((resolve, reject) => {
    const query = `INSERT INTO Logs (type, details) VALUES (?, ?)`;
    db.run(query, [type, details], function (err) {
      if (err) reject(err);
      resolve();
    });
  });
};

module.exports = {
  addCommission,
  deleteCommission,
  createLog,
};

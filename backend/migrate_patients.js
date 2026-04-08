require('dotenv').config();
const db = require('./db');

async function migratePatients() {
  try {
    // Add name column if not exists
    try {
      await db.execute(`ALTER TABLE patients ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT ''`);
    } catch (e) {
      // Column might already exist
    }

    // Add email column if not exists
    try {
      await db.execute(`ALTER TABLE patients ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT ''`);
    } catch (e) {
      // Column might already exist
    }

    // Update existing patients with name and email from users
    await db.execute(`
      UPDATE patients p
      JOIN users u ON p.user_id = u.id
      SET p.name = u.name, p.email = u.email
    `);
    console.log('Migration complete: patients table updated with name and email');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    process.exit();
  }
}

migratePatients();
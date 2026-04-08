const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    // Check patients
    const [patients] = await connection.execute('SELECT COUNT(*) as count FROM patients');
    console.log(`Patients: ${patients[0].count}`);

    // Check vitals
    const [vitals] = await connection.execute('SELECT COUNT(*) as count FROM vitals');
    console.log(`Vitals: ${vitals[0].count}`);

    // Check alerts
    const [alerts] = await connection.execute('SELECT COUNT(*) as count FROM alerts');
    console.log(`Alerts: ${alerts[0].count}`);

    // Check predictions
    const [predictions] = await connection.execute('SELECT COUNT(*) as count FROM predictions');
    console.log(`Predictions: ${predictions[0].count}`);

    // Check recent vitals
    const [recentVitals] = await connection.execute('SELECT * FROM vitals ORDER BY timestamp DESC LIMIT 5');
    console.log('Recent vitals:', recentVitals);

    // Check recent alerts
    const [recentAlerts] = await connection.execute('SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 5');
    console.log('Recent alerts:', recentAlerts);

    await connection.end();
  } catch (error) {
    console.error('Database error:', error);
  }
}

checkDatabase();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createTestData() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    // Create test users
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Doctor
    await connection.execute(
      'INSERT INTO users (role, name, email, password_hash) VALUES (?, ?, ?, ?)',
      ['doctor', 'Dr. Smith', 'doctor@test.com', hashedPassword]
    );

    // Nurse
    await connection.execute(
      'INSERT INTO users (role, name, email, password_hash) VALUES (?, ?, ?, ?)',
      ['nurse', 'Nurse Johnson', 'nurse@test.com', hashedPassword]
    );

    // Patients
    const patientNames = ['John Doe', 'Jane Smith', 'Bob Wilson', 'Alice Brown', 'Charlie Davis'];
    const patientEmails = ['john@test.com', 'jane@test.com', 'bob@test.com', 'alice@test.com', 'charlie@test.com'];

    for (let i = 0; i < patientNames.length; i++) {
      // Create user
      const [userResult] = await connection.execute(
        'INSERT INTO users (role, name, email, password_hash) VALUES (?, ?, ?, ?)',
        ['patient', patientNames[i], patientEmails[i], hashedPassword]
      );
      const userId = userResult.insertId;

      // Create patient record
      await connection.execute(
        'INSERT INTO patients (user_id, name, email, medical_info) VALUES (?, ?, ?, ?)',
        [userId, patientNames[i], patientEmails[i], 'Test patient data']
      );
    }

    console.log('Test data created successfully!');
    await connection.end();
  } catch (error) {
    console.error('Error creating test data:', error);
  }
}

createTestData();
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// --- Authentication Middlewares ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- Socket.IO Setup ---
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// --- Routes ---

// 1. Auth: Register
app.post('/auth/register', async (req, res) => {
  const { role, name, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      'INSERT INTO users (role, name, email, password_hash) VALUES (?, ?, ?, ?)',
      [role, name, email, hashedPassword]
    );
    const userId = result.insertId;

    // If registering as patient, create patient record
    if (role === 'patient') {
      await db.execute('INSERT INTO patients (user_id, name, email, medical_info) VALUES (?, ?, ?, ?)', [userId, name, email, '']);
    }

    res.status(201).json({ message: 'User created successfully', id: userId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: error.message });
  }
});

// 2. Auth: Login
app.post('/auth/login', async (req, res) => {
  const { role, email, password } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ? AND role = ?', [email, role]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials or wrong role selected' });
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '24h' });
    
    let patient_id = null;
    if (user.role === 'patient') {
      const [pRows] = await db.execute('SELECT id FROM patients WHERE user_id = ?', [user.id]);
      if (pRows.length > 0) {
        patient_id = pRows[0].id;
      } else {
        // Create patient record if missing (for existing users)
        const [pInsert] = await db.execute('INSERT INTO patients (user_id, name, email, medical_info) VALUES (?, ?, ?, ?)', [user.id, user.name, user.email, '']);
        patient_id = pInsert.insertId;
      }
    }
    
    res.json({ token, role: user.role, name: user.name, id: user.id, patient_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Staff Dashboard: Get all patients with permission status
app.get('/patients', authenticateToken, async (req, res) => {
  if (!['doctor', 'nurse'].includes(req.user.role)) return res.sendStatus(403);
  try {
    const [rows] = await db.execute(`
      SELECT p.id as patient_id, p.name, p.email, p.medical_info, COALESCE(perm.status, 'none') as permission_status
      FROM patients p
      LEFT JOIN permissions perm ON perm.patient_id = p.id AND perm.staff_id = ?
    `, [req.user.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3.5. Search patients for staff
app.get('/patients/search', authenticateToken, async (req, res) => {
  if (!['doctor', 'nurse'].includes(req.user.role)) return res.sendStatus(403);
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  try {
    const [rows] = await db.execute(`
      SELECT p.id as patient_id, p.name, p.email
      FROM patients p
      WHERE p.name LIKE ? OR p.email LIKE ?
    `, [`%${q}%`, `%${q}%`]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3.6. Send permission request
app.post('/permissions', authenticateToken, async (req, res) => {
  if (!['doctor', 'nurse'].includes(req.user.role)) return res.sendStatus(403);
  const { patient_id } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'patient_id required' });
  try {
    // Check if already exists
    const [existing] = await db.execute(
      'SELECT id FROM permissions WHERE staff_id = ? AND patient_id = ?',
      [req.user.id, patient_id]
    );
    if (existing.length > 0) return res.status(400).json({ error: 'Request already exists' });
    
    await db.execute(
      'INSERT INTO permissions (staff_id, patient_id, status) VALUES (?, ?, ?)',
      [req.user.id, patient_id, 'pending']
    );
    res.status(201).json({ message: 'Request sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending permission requests for a patient
app.get('/permissions/pending', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  try {
    const [requests] = await db.execute(
      `SELECT p.id, p.staff_id, u.name, u.email, p.status, p.created_at
       FROM permissions p
       JOIN users u ON u.id = p.staff_id
       WHERE p.patient_id = (SELECT id FROM patients WHERE user_id = ?)
       AND p.status = 'pending'
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve or deny permission request
app.put('/permissions/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  const { id } = req.params;
  const { status } = req.body;
  
  if (!['approved', 'revoked'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    // Verify the permission request belongs to the patient
    const [permission] = await db.execute(
      `SELECT p.id FROM permissions p
       JOIN patients pt ON pt.id = p.patient_id
       WHERE p.id = ? AND pt.user_id = ?`,
      [id, req.user.id]
    );

    if (permission.length === 0) {
      return res.status(404).json({ error: 'Permission request not found' });
    }

    await db.execute(
      'UPDATE permissions SET status = ? WHERE id = ?',
      [status, id]
    );

    res.json({ message: `Permission ${status}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Submit Vitals & Process ML
app.post('/vitals', async (req, res) => {
  const { patient_id, heart_rate, spo2, temp } = req.body;
  
  if (!patient_id || heart_rate == null || spo2 == null || temp == null) {
      return res.status(400).json({error: "Missing required vital data."});
  }

  // Generate resp_rate if not provided (for now, assume 16 as default)
  const resp_rate = req.body.resp_rate || 16;

  try {
    // 1. Insert vital
    await db.execute(
      'INSERT INTO vitals (patient_id, heart_rate, spo2, temp, resp_rate) VALUES (?, ?, ?, ?, ?)',
      [patient_id, heart_rate, spo2, temp, resp_rate]
    );

    // 2. Fetch last 10 vitals including this one
    const [vitalsRows] = await db.execute(
      'SELECT heart_rate, spo2, temp, COALESCE(resp_rate, 16) AS resp_rate FROM vitals WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 10',
      [patient_id]
    );

    // Broadcast raw vital to all connected clients
    io.emit(`vitals-${patient_id}`, { heart_rate, spo2, temp, resp_rate, timestamp: new Date() });

    // Only send to ML if we have exactly 10 records
    if (vitalsRows.length === 10) {
      // Must reverse to be chronologically forward for sequence modeling
      const vitals_sequence = vitalsRows.reverse();
      
      try {
        const mlResponse = await axios.post(process.env.ML_SERVICE_URL, {
          patient_id,
          vitals_sequence
        });
        
        const { risk_probability, alert } = mlResponse.data;
        
        // Save prediction
        await db.execute(
          'INSERT INTO predictions (patient_id, probability, result) VALUES (?, ?, ?)',
          [patient_id, risk_probability, alert]
        );

        // Broadcast prediction
        io.emit(`prediction-${patient_id}`, mlResponse.data);

        // If alert is true, save alert and broadcast
        if (alert) {
          const msg = `High risk detected (Prob: ${(risk_probability*100).toFixed(2)}%)`;
          await db.execute(
            'INSERT INTO alerts (patient_id, message, severity) VALUES (?, ?, ?)',
            [patient_id, msg, 'high']
          );
          const [patientRows] = await db.execute('SELECT name FROM patients WHERE id = ?', [patient_id]);
          const patient_name = patientRows.length > 0 ? patientRows[0].name : 'Unknown Patient';
          const location_lat = (Math.random() - 0.5) * 180;
          const location_lon = (Math.random() - 0.5) * 360;
          io.emit(`alert-${patient_id}`, { patient_id, message: msg, severity: 'high' });
          io.emit('staff-alert', { patient_id, patient_name, message: msg, severity: 'high', location_lat, location_lon }); // global alert
        }
        
      } catch (mlError) {
        console.error("ML Service Error:", mlError.message);
      }
    }
    res.status(201).json({ message: 'Vital recorded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4.5. Add Prescription
app.post('/patients/:id/prescriptions', authenticateToken, async (req, res) => {
  if (req.user.role !== 'doctor') return res.sendStatus(403);
  const patient_id = req.params.id;
  const { medication, dosage, instructions } = req.body;
  if (!medication || !dosage) return res.status(400).json({ error: 'Medication and dosage are required' });
  try {
    await db.execute(
      'INSERT INTO prescriptions (patient_id, staff_id, medication, dosage, instructions) VALUES (?, ?, ?, ?, ?)',
      [patient_id, req.user.id, medication, dosage, instructions || '']
    );
    res.status(201).json({ message: 'Prescription added' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4.6. Get Prescriptions
app.get('/patients/:id/prescriptions', authenticateToken, async (req, res) => {
  const patient_id = req.params.id;
  try {
    const [rows] = await db.execute(
      `SELECT p.*, u.name as staff_name, u.role as staff_role 
       FROM prescriptions p 
       JOIN users u ON p.staff_id = u.id 
       WHERE p.patient_id = ? ORDER BY p.created_at DESC`,
      [patient_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Get Vitals history
app.get('/patients/:id/vitals', authenticateToken, async (req, res) => {
  const patient_id = req.params.id;
  try {
    const [rows] = await db.execute(
      'SELECT * FROM vitals WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 50',
      [patient_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5.5. Generate random gradual vitals for all patients
app.post('/generate-vitals', async (req, res) => {
  try {
    // Get all patients
    const [patients] = await db.execute('SELECT id FROM patients');

    for (const patient of patients) {
      const patient_id = patient.id;

      // Get last vital
      const [lastVitals] = await db.execute(
        'SELECT heart_rate, spo2, temp, COALESCE(resp_rate, 16) AS resp_rate FROM vitals WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 1',
        [patient_id]
      );

      let heart_rate, spo2, temp, resp_rate;

      if (lastVitals.length > 0) {
        // Generate with spike logic
        const last = lastVitals[0];
        const shouldSpike = Math.random() < 0.15;
        
        if (shouldSpike) {
          // Spike high risk values
          heart_rate = Math.round((110 + Math.random() * 20) * 10) / 10;
          spo2 = Math.round((88 + Math.random() * 5) * 10) / 10;
          temp = Math.round((100 + Math.random() * 1.5) * 10) / 10;
          resp_rate = Math.round((22 + Math.random() * 6) * 10) / 10;
        } else {
          // Fast decay back to baseline
          const targetHR = 75, targetSpo2 = 97, targetTemp = 98.5, targetResp = 15;
          heart_rate = Math.round((last.heart_rate * 0.5 + targetHR * 0.5) * 10) / 10;
          spo2 = Math.round((last.spo2 * 0.5 + targetSpo2 * 0.5) * 10) / 10;
          temp = Math.round((last.temp * 0.6 + targetTemp * 0.4) * 10) / 10;
          resp_rate = Math.round((last.resp_rate * 0.5 + targetResp * 0.5) * 10) / 10;
        }
      } else {
        // Initial random values
        heart_rate = 70 + Math.random() * 20;
        spo2 = 95 + Math.random() * 5;
        temp = 98 + Math.random() * 2;
        resp_rate = 12 + Math.random() * 8;
      }

      // Insert new vital
      await db.execute(
        'INSERT INTO vitals (patient_id, heart_rate, spo2, temp, resp_rate) VALUES (?, ?, ?, ?, ?)',
        [patient_id, heart_rate, spo2, temp, resp_rate]
      );

      // Check if 10 vitals, trigger ML
      const [vitalsRows] = await db.execute(
        'SELECT heart_rate, spo2, temp, COALESCE(resp_rate, 16) AS resp_rate FROM vitals WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 10',
        [patient_id]
      );

      if (vitalsRows.length === 10) {
        const vitals_sequence = vitalsRows.reverse();
        try {
          const mlResponse = await axios.post(process.env.ML_SERVICE_URL, {
            patient_id,
            vitals_sequence
          });
          const { risk_probability, alert } = mlResponse.data;
          await db.execute(
            'INSERT INTO predictions (patient_id, probability, result) VALUES (?, ?, ?)',
            [patient_id, risk_probability, alert]
          );
          io.emit(`prediction-${patient_id}`, mlResponse.data);

          // If alert, save to alerts table
          if (alert) {
            const severity = risk_probability > 0.8 ? 'critical' : risk_probability > 0.6 ? 'high' : 'medium';
            await db.execute(
              'INSERT INTO alerts (patient_id, message, severity) VALUES (?, ?, ?)',
              [patient_id, `Risk alert: ${alert}`, severity]
            );
            const [patientRows] = await db.execute('SELECT name FROM patients WHERE id = ?', [patient_id]);
            const patient_name = patientRows.length > 0 ? patientRows[0].name : 'Patient ' + patient_id;
            const location_lat = (Math.random() - 0.5) * 180;
            const location_lon = (Math.random() - 0.5) * 360;
            io.emit('staff-alert', { patient_id, patient_name, message: `Risk alert: ${alert}`, severity, location_lat, location_lon });
          }
        } catch (mlError) {
          console.error('ML service error:', mlError);
        }
      }

      // Broadcast vital to clients with resp_rate
      io.emit(`vitals-${patient_id}`, { heart_rate, spo2, temp, resp_rate, timestamp: new Date() });
    }

    res.json({ message: 'Vitals generated for all patients' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Get Alerts
app.get('/alerts', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT a.*, p.name as patient_name 
      FROM alerts a
      JOIN patients p ON a.patient_id = p.id
      ORDER BY a.timestamp DESC LIMIT 20
    `;
    let params = [];
    if (req.user.role === 'patient') {
      const [pRows] = await db.execute('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
      if (pRows.length > 0) {
        query = `
          SELECT a.*, p.name as patient_name 
          FROM alerts a
          JOIN patients p ON a.patient_id = p.id
          WHERE a.patient_id = ?
          ORDER BY a.timestamp DESC LIMIT 20
        `;
        params = [pRows[0].id];
      }
    }
    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


const PORT = process.env.PORT || 5000;

// Auto-generate vitals every 5 minutes
setInterval(async () => {
  try {
    console.log('Auto-generating vitals...');
    // Get all patients
    const [patients] = await db.execute('SELECT id FROM patients');

    for (const patient of patients) {
      const patient_id = patient.id;

      // Get last vital
      const [lastVitals] = await db.execute(
        'SELECT heart_rate, spo2, temp, COALESCE(resp_rate, 16) AS resp_rate FROM vitals WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 1',
        [patient_id]
      );

      let heart_rate, spo2, temp, resp_rate;

      if (lastVitals.length > 0) {
        // Generate gradual change
        const last = lastVitals[0];
        
        // Randomly decide if this should spike (25% chance for longer demo)
        const shouldSpike = Math.random() < 0.25;
        
        if (shouldSpike) {
          // Spike high risk values
          heart_rate = Math.round((110 + Math.random() * 20) * 10) / 10; // 110-130
          spo2 = Math.round((88 + Math.random() * 5) * 10) / 10; // 88-93
          temp = Math.round((100 + Math.random() * 1.5) * 10) / 10; // 100-101.5
          resp_rate = Math.round((22 + Math.random() * 6) * 10) / 10; // 22-28
        } else {
          // Slow decay - keeps vitals elevated longer for demo purposes
          const targetHR = 75;
          const targetSpo2 = 97;
          const targetTemp = 98.5;
          const targetResp = 15;
          
          // 70% previous value + 30% target = slower return to baseline
          heart_rate = Math.round((last.heart_rate * 0.7 + targetHR * 0.3) * 10) / 10;
          spo2 = Math.round((last.spo2 * 0.7 + targetSpo2 * 0.3) * 10) / 10;
          temp = Math.round((last.temp * 0.7 + targetTemp * 0.3) * 10) / 10;
          resp_rate = Math.round((last.resp_rate * 0.7 + targetResp * 0.3) * 10) / 10;
        }
      } else {
        // Initial random values
        heart_rate = 70 + Math.random() * 20; // 70-90
        spo2 = 95 + Math.random() * 5; // 95-100
        temp = 98 + Math.random() * 2; // 98-100
        resp_rate = 12 + Math.random() * 8; // 12-20
      }

      // Round to 1 decimal
      heart_rate = Math.round(heart_rate * 10) / 10;
      spo2 = Math.round(spo2 * 10) / 10;
      temp = Math.round(temp * 10) / 10;
      resp_rate = Math.round(resp_rate * 10) / 10;

      // Insert new vital
      await db.execute(
        'INSERT INTO vitals (patient_id, heart_rate, spo2, temp, resp_rate) VALUES (?, ?, ?, ?, ?)',
        [patient_id, heart_rate, spo2, temp, resp_rate]
      );

      // Check if 10 vitals, trigger ML
      const [vitalsRows] = await db.execute(
        'SELECT heart_rate, spo2, temp, COALESCE(resp_rate, 16) AS resp_rate FROM vitals WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 10',
        [patient_id]
      );

      if (vitalsRows.length === 10) {
        const vitals_sequence = vitalsRows.reverse();
        try {
          const mlResponse = await axios.post(process.env.ML_SERVICE_URL, {
            patient_id,
            vitals_sequence
          });
          const { risk_probability, alert } = mlResponse.data;
          await db.execute(
            'INSERT INTO predictions (patient_id, probability, result) VALUES (?, ?, ?)',
            [patient_id, risk_probability, alert]
          );
          io.emit(`prediction-${patient_id}`, mlResponse.data);

          // If alert, save to alerts table
          if (alert) {
            const severity = risk_probability > 0.8 ? 'critical' : risk_probability > 0.6 ? 'high' : 'medium';
            await db.execute(
              'INSERT INTO alerts (patient_id, message, severity) VALUES (?, ?, ?)',
              [patient_id, `Risk alert: ${alert}`, severity]
            );
            const [patientRows] = await db.execute('SELECT name FROM patients WHERE id = ?', [patient_id]);
            const patient_name = patientRows.length > 0 ? patientRows[0].name : 'Patient ' + patient_id;
            const location_lat = (Math.random() - 0.5) * 180;
            const location_lon = (Math.random() - 0.5) * 360;
            io.emit('staff-alert', { patient_id, patient_name, message: `Risk alert: ${alert}`, severity, location_lat, location_lon });
          }
        } catch (mlError) {
          console.error('ML service error:', mlError);
        }
      }

      // Broadcast vital to all connected clients
      io.emit(`vitals-${patient_id}`, { heart_rate, spo2, temp, resp_rate, timestamp: new Date() });
    }

    console.log('Auto vitals generation complete');
  } catch (error) {
    console.error('Error in auto vitals generation:', error);
  }
}, 2 * 1000); // 2 seconds

server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

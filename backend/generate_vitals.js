require('dotenv').config();
const db = require('./db');

async function generateVitals() {
  try {
    // Get all patients
    const [patients] = await db.execute('SELECT id FROM patients');

    for (const patient of patients) {
      const patient_id = patient.id;

      // Get last vital
      const [lastVitals] = await db.execute(
        'SELECT heart_rate, spo2, temp, resp_rate FROM vitals WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 1',
        [patient_id]
      );

      let heart_rate, spo2, temp, resp_rate;

      if (lastVitals.length > 0) {
        // Generate gradual change
        const last = lastVitals[0];
        
        // Randomly decide if this should spike (simulate every 10-20 seconds)
        const shouldSpike = Math.random() < 0.15; // 15% chance for spike
        
        if (shouldSpike) {
          // Spike high risk values
          heart_rate = Math.round((110 + Math.random() * 20) * 10) / 10; // 110-130
          spo2 = Math.round((88 + Math.random() * 5) * 10) / 10; // 88-93
          temp = Math.round((100 + Math.random() * 1.5) * 10) / 10; // 100-101.5
          resp_rate = Math.round((22 + Math.random() * 6) * 10) / 10; // 22-28
        } else {
          // Fast decay back to baseline
          const targetHR = 75;
          const targetSpo2 = 97;
          const targetTemp = 98.5;
          const targetResp = 15;
          
          heart_rate = Math.round((last.heart_rate * 0.5 + targetHR * 0.5) * 10) / 10;
          spo2 = Math.round((last.spo2 * 0.5 + targetSpo2 * 0.5) * 10) / 10;
          temp = Math.round((last.temp * 0.6 + targetTemp * 0.4) * 10) / 10;
          resp_rate = Math.round((last.resp_rate * 0.5 + targetResp * 0.5) * 10) / 10;
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

      console.log(`Generated vitals for patient ${patient_id}: HR=${heart_rate}, SPO2=${spo2}, Temp=${temp}, Resp=${resp_rate}`);
    }

    console.log('Vitals generation complete');
  } catch (error) {
    console.error('Error generating vitals:', error);
  } finally {
    process.exit();
  }
}

generateVitals();
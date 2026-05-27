const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok', service: 'health-service' }));

// For "Elder Check-in"
app.post('/checkin', async (req, res) => {
  try {
    // In a real app, userId comes from a validated JWT token passed from UI or API gateway
    const { userId, status } = req.body;
    const result = await pool.query(
      'INSERT INTO health_logs (user_id, status) VALUES ($1, $2) RETURNING *',
      [userId, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// For recording vitals (heart rate, bp)
app.post('/vitals', async (req, res) => {
  try {
    const { userId, heartRate, bloodPressure } = req.body;
    const result = await pool.query(
      'INSERT INTO health_logs (user_id, status, heart_rate, blood_pressure) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, 'vitals_logged', heartRate, bloodPressure]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/vitals/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT * FROM health_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Health service running on port ${PORT}`);
});

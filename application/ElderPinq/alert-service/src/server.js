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

app.get('/health', (req, res) => res.status(200).json({ status: 'ok', service: 'alert-service' }));

// Log internal alert/emergency
app.post('/alerts', async (req, res) => {
  try {
    const { serviceName, message, severity } = req.body;
    const result = await pool.query(
      'INSERT INTO alerts (service_name, message, severity) VALUES ($1, $2, $3) RETURNING *',
      [serviceName, message, severity || 'info']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent alerts
app.get('/alerts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Alert service running on port ${PORT}`);
});

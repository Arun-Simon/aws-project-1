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

app.get('/health', (req, res) => res.status(200).json({ status: 'ok', service: 'reminder-service' }));

// Add new medication reminder
app.post('/reminders', async (req, res) => {
  try {
    const { userId, medicationName, dosage, timeOfDay } = req.body;
    const result = await pool.query(
      'INSERT INTO reminders (user_id, medication_name, dosage, time_of_day) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, medicationName, dosage, timeOfDay]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get reminders for user
app.get('/reminders/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query('SELECT * FROM reminders WHERE user_id = $1 ORDER BY time_of_day ASC', [userId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark medication as taken
app.put('/reminders/:id/take', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE reminders SET taken = TRUE WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reminder not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Reminder service running on port ${PORT}`);
});

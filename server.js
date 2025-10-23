const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

if (!process.env.DATABASE_URL) {
  console.warn(
    'DATABASE_URL is not set. The API will fall back to sample data only.'
  );
}

const pool =
  process.env.DATABASE_URL &&
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

app.use(cors());
app.use(express.static(path.join(__dirname)));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/products', async (req, res) => {
  if (!pool) {
    return res.status(200).json({ fallback: true, products: [] });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
        id,
        name,
        category,
        stock,
        unit,
        reorder_point AS "reorderPoint",
        price
      FROM products
      ORDER BY id ASC`
    );

    res.json({ fallback: false, products: rows });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to load products' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Product management app running on port ${PORT}`);
});

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

const ensureDatabase = (res) => {
  if (!pool) {
    res
      .status(503)
      .json({ message: 'Database connection is not configured on the server.' });
    return false;
  }
  return true;
};

app.use(cors());
app.use(express.json());
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
        price,
        image_url AS "imageUrl"
      FROM products
      ORDER BY id ASC`
    );

    res.json({ fallback: false, products: rows });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to load products' });
  }
});

app.post('/api/products', async (req, res) => {
  if (!ensureDatabase(res)) {
    return;
  }

  const required = [
    'id',
    'name',
    'category',
    'stock',
    'unit',
    'reorderPoint',
    'price',
  ];

  const missing = required.filter((field) => req.body[field] === undefined);
  if (missing.length) {
    return res
      .status(400)
      .json({ message: `Missing required fields: ${missing.join(', ')}` });
  }

  const payload = {
    id: String(req.body.id).trim(),
    name: String(req.body.name).trim(),
    category: String(req.body.category).trim(),
    stock: Number(req.body.stock),
    unit: String(req.body.unit).trim(),
    reorderPoint: Number(req.body.reorderPoint),
    price: Number(req.body.price),
    imageUrl: req.body.imageUrl ? String(req.body.imageUrl).trim() : null,
  };

  if (!payload.id || !payload.name || !payload.category || !payload.unit) {
    return res
      .status(400)
      .json({ message: 'ID, name, category, and unit must not be empty.' });
  }

  if (
    Number.isNaN(payload.stock) ||
    Number.isNaN(payload.reorderPoint) ||
    Number.isNaN(payload.price)
  ) {
    return res
      .status(400)
      .json({ message: 'Stock, reorderPoint, and price must be numbers.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO products (
        id, name, category, stock, unit, reorder_point, price, image_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        name,
        category,
        stock,
        unit,
        reorder_point AS "reorderPoint",
        price,
        image_url AS "imageUrl"`,
      [
        payload.id,
        payload.name,
        payload.category,
        payload.stock,
        payload.unit,
        payload.reorderPoint,
        payload.price,
        payload.imageUrl,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    if (error.code === '23505') {
      return res
        .status(409)
        .json({ message: 'A product with this ID already exists.' });
    }
    res.status(500).json({ message: 'Failed to create product.' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  if (!ensureDatabase(res)) {
    return;
  }

  const { id } = req.params;
  const payload = {
    name: req.body.name !== undefined ? String(req.body.name).trim() : null,
    category:
      req.body.category !== undefined ? String(req.body.category).trim() : null,
    stock: req.body.stock !== undefined ? Number(req.body.stock) : null,
    unit: req.body.unit !== undefined ? String(req.body.unit).trim() : null,
    reorderPoint:
      req.body.reorderPoint !== undefined ? Number(req.body.reorderPoint) : null,
    price: req.body.price !== undefined ? Number(req.body.price) : null,
    imageUrl:
      req.body.imageUrl !== undefined ? String(req.body.imageUrl).trim() : null,
  };

  if (
    [
      payload.name,
      payload.category,
      payload.stock,
      payload.unit,
      payload.reorderPoint,
      payload.price,
      payload.imageUrl,
    ].every((value) => value === null)
  ) {
    return res.status(400).json({ message: 'No fields provided to update.' });
  }

  if (
    (payload.stock !== null && Number.isNaN(payload.stock)) ||
    (payload.reorderPoint !== null && Number.isNaN(payload.reorderPoint)) ||
    (payload.price !== null && Number.isNaN(payload.price))
  ) {
    return res
      .status(400)
      .json({ message: 'Stock, reorderPoint, and price must be numbers.' });
  }

  const updates = [];
  const values = [];
  let position = 1;

  Object.entries({
    name: payload.name,
    category: payload.category,
    stock: payload.stock,
    unit: payload.unit,
    reorder_point: payload.reorderPoint,
    price: payload.price,
    image_url: payload.imageUrl,
  }).forEach(([column, value]) => {
    if (value !== null) {
      updates.push(`${column} = $${position}`);
      values.push(value);
      position += 1;
    }
  });

  values.push(id);

  try {
    const { rowCount, rows } = await pool.query(
      `UPDATE products
       SET ${updates.join(', ')},
           updated_at = NOW()
       WHERE id = $${position}
       RETURNING
         id,
         name,
         category,
         stock,
         unit,
         reorder_point AS "reorderPoint",
         price,
         image_url AS "imageUrl"`,
      values
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Failed to update product.' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  if (!ensureDatabase(res)) {
    return;
  }

  const { id } = req.params;

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM products WHERE id = $1',
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Failed to delete product.' });
  }
});

app.get('/customer', (req, res) => {
  res.sendFile(path.join(__dirname, 'customer.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Product management app running on port ${PORT}`);
});

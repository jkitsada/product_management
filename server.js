const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn(
    'JWT_SECRET is not set. Authentication tokens will not be secure until this value is configured.'
  );
}

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

const generateToken = (user) => {
  if (!JWT_SECRET) {
    throw new Error('JWT secret is not configured');
  }

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
};

const authenticate = async (req, res, next) => {
  if (!ensureDatabase(res)) {
    return;
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Missing authorization token.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, email, created_at FROM users WHERE id = $1',
      [decoded.sub]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.post('/api/auth/signup', async (req, res) => {
  if (!ensureDatabase(res)) {
    return;
  }

  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : '';
  const password = req.body.password ? String(req.body.password) : '';

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  if (!email.endsWith('@gmail.com')) {
    return res.status(400).json({
      message: 'ขณะนี้ระบบรองรับเฉพาะอีเมล Gmail เท่านั้น กรุณาใช้ที่อยู่อีเมลที่ลงท้ายด้วย @gmail.com',
    });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: 'Password ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
      email,
    ]);
    if (existing.rows.length > 0) {
      return res
        .status(409)
        .json({ message: 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, created_at`,
      [email, passwordHash]
    );

    const user = rows[0];
    const token = generateToken(user);

    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'ไม่สามารถสร้างบัญชีได้ กรุณาลองใหม่' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  if (!ensureDatabase(res)) {
    return;
  }

  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : '';
  const password = req.body.password ? String(req.body.password) : '';

  if (!email || !password) {
    return res.status(400).json({ message: 'Email และ Password จำเป็นต้องกรอก' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const token = generateToken(user);
    delete user.password_hash;

    res.json({ token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่' });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/products', authenticate, async (req, res) => {
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
      WHERE owner_id = $1
      ORDER BY id ASC`,
      [req.user.id]
    );

    res.json({ fallback: false, products: rows });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to load products' });
  }
});

app.post('/api/products', authenticate, async (req, res) => {
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
        id, name, category, stock, unit, reorder_point, price, image_url, owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING
        id,
        name,
        category,
        stock,
        unit,
        reorder_point AS "reorderPoint",
        price,
        image_url AS "ImageUrl"`,
      [
        payload.id,
        payload.name,
        payload.category,
        payload.stock,
        payload.unit,
        payload.reorderPoint,
        payload.price,
        payload.imageUrl,
        req.user.id,
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

app.get('/api/public/products', async (req, res) => {
  if (!pool) {
    return res.status(200).json({ fallback: true, products: [] });
  }

  const ownerId = req.query.owner ? Number(req.query.owner) : null;
  if (!ownerId) {
    return res
      .status(400)
      .json({ message: 'ต้องระบุ owner parameter เช่น /api/public/products?owner=3' });
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
      WHERE owner_id = $1
      ORDER BY name ASC`,
      [ownerId]
    );

    res.json({ fallback: false, products: rows });
  } catch (error) {
    console.error('Error fetching public products:', error);
    res.status(500).json({ message: 'Failed to load products' });
  }
});

app.put('/api/products/:id', authenticate, async (req, res) => {
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

  values.push(req.user.id);
  values.push(id);

  try {
    const { rowCount, rows } = await pool.query(
      `UPDATE products
       SET ${updates.join(', ')},
           updated_at = NOW()
       WHERE owner_id = $${position}
         AND id = $${position + 1}
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

app.delete('/api/products/:id', authenticate, async (req, res) => {
  if (!ensureDatabase(res)) {
    return;
  }

  const { id } = req.params;

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM products WHERE owner_id = $1 AND id = $2',
      [req.user.id, id]
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

app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Product management app running on port ${PORT}`);
});

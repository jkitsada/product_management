-- สร้างตาราง users สำหรับระบบเข้าสู่ระบบ
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- เพิ่มคอลัมน์ image_url ให้สินค้า หากยังไม่มี
ALTER TABLE products
ADD COLUMN IF NOT EXISTS image_url TEXT;

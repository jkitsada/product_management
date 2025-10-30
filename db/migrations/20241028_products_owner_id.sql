-- เพิ่ม owner_id ให้สินค้าและตั้งค่า default owner เป็น user id 3
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id);

UPDATE products
SET owner_id = 3
WHERE owner_id IS NULL;

ALTER TABLE products
  ALTER COLUMN owner_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_owner_id ON products(owner_id);

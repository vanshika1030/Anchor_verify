import Database from 'better-sqlite3'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const dbDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

const dbPath = path.join(dbDir, 'anchor.db')
let db = null

export function initDB() {
  db = new Database(dbPath)

  db.exec(`
    CREATE TABLE IF NOT EXISTS sellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      business_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      style_code TEXT,
      brand_name TEXT,
      article_type TEXT,
      category TEXT,
      title TEXT,
      description TEXT,
      mrp REAL,
      selling_price REAL,
      attributes JSON,
      size_chart JSON,
      verification_status TEXT DEFAULT 'unverified',
      verification_score REAL,
      anchor_image_url TEXT,
      catalog_images JSON,
      ai_model_images JSON,
      tags JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seller_id) REFERENCES sellers(id)
    );
  `)

  // Keep existing demo databases forward-compatible without deleting seller data.
  const productColumns = new Set(
    db.prepare('PRAGMA table_info(products)').all().map(column => column.name)
  )
  const productMigrations = {
    seller_metadata: 'JSON',
    verification_report: 'JSON',
    suggestions: 'JSON',
    published_at: 'DATETIME',
  }
  for (const [column, definition] of Object.entries(productMigrations)) {
    if (!productColumns.has(column)) {
      db.exec(`ALTER TABLE products ADD COLUMN ${column} ${definition}`)
    }
  }

  // Insert demo sellers if they don't exist
  const insertSeller = db.prepare('INSERT OR IGNORE INTO sellers (email, password_hash, business_name) VALUES (?, ?, ?)')
  const hashPwd = (pwd) => crypto.createHash('sha256').update(pwd).digest('hex')
  
  insertSeller.run('seller@myntra.com', hashPwd('demo123'), 'Myntra Demo Seller')
  insertSeller.run('admin@anchor.com', hashPwd('admin123'), 'Anchor Admin')

  // Seed demo products
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM products WHERE seller_id = 1')
  const count = countStmt.get().count

  // Ensure products table is empty on fresh start for demo purposes
  // if (count > 0) {
  //   db.prepare('DELETE FROM products WHERE seller_id = 1 AND id <= 4').run();
  // }

  console.log('[DATABASE] SQLite initialized at data/anchor.db')
}

export function getDB() {
  if (!db) initDB()
  return db
}

export function createProduct(productData) {
  const db = getDB()
  const insert = db.prepare(`
    INSERT INTO products (
      seller_id, style_code, brand_name, article_type, category, title, description,
      mrp, selling_price, attributes, size_chart, verification_status, verification_score,
      anchor_image_url, catalog_images, ai_model_images, tags, seller_metadata,
      verification_report, suggestions, published_at
    ) VALUES (
      @seller_id, @style_code, @brand_name, @article_type, @category, @title, @description,
      @mrp, @selling_price, @attributes, @size_chart, @verification_status, @verification_score,
      @anchor_image_url, @catalog_images, @ai_model_images, @tags, @seller_metadata,
      @verification_report, @suggestions, @published_at
    )
  `)

  const result = insert.run({
    seller_id: productData.seller_id,
    style_code: productData.style_code || null,
    brand_name: productData.brand_name || null,
    article_type: productData.article_type || null,
    category: productData.category || null,
    title: productData.title || null,
    description: productData.description || null,
    mrp: productData.mrp || null,
    selling_price: productData.selling_price || null,
    attributes: productData.attributes ? JSON.stringify(productData.attributes) : null,
    size_chart: productData.size_chart ? JSON.stringify(productData.size_chart) : null,
    verification_status: productData.verification_status || 'unverified',
    verification_score: productData.verification_score || null,
    anchor_image_url: productData.anchor_image_url || null,
    catalog_images: productData.catalog_images ? JSON.stringify(productData.catalog_images) : null,
    ai_model_images: productData.ai_model_images ? JSON.stringify(productData.ai_model_images) : null,
    tags: productData.tags ? JSON.stringify(productData.tags) : null,
    seller_metadata: productData.seller_metadata ? JSON.stringify(productData.seller_metadata) : null,
    verification_report: productData.verification_report ? JSON.stringify(productData.verification_report) : null,
    suggestions: productData.suggestions ? JSON.stringify(productData.suggestions) : null,
    published_at: productData.published_at || (
      productData.verification_status === 'published' ? new Date().toISOString() : null
    ),
  })

  return getProductById(result.lastInsertRowid)
}

export function getProducts(sellerId = null) {
  const db = getDB()
  let products
  if (sellerId) {
    products = db.prepare('SELECT * FROM products WHERE seller_id = ? ORDER BY created_at DESC').all(sellerId)
  } else {
    products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all()
  }

  // Parse JSON fields
  return products.map(p => ({
    ...p,
    attributes: p.attributes ? JSON.parse(p.attributes) : null,
    size_chart: p.size_chart ? JSON.parse(p.size_chart) : null,
    catalog_images: p.catalog_images ? JSON.parse(p.catalog_images) : null,
    ai_model_images: p.ai_model_images ? JSON.parse(p.ai_model_images) : null,
    tags: p.tags ? JSON.parse(p.tags) : null,
    seller_metadata: p.seller_metadata ? JSON.parse(p.seller_metadata) : null,
    verification_report: p.verification_report ? JSON.parse(p.verification_report) : null,
    suggestions: p.suggestions ? JSON.parse(p.suggestions) : null,
  }))
}

export function getProductById(id) {
  const db = getDB()
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  if (!p) return null
  
  return {
    ...p,
    attributes: p.attributes ? JSON.parse(p.attributes) : null,
    size_chart: p.size_chart ? JSON.parse(p.size_chart) : null,
    catalog_images: p.catalog_images ? JSON.parse(p.catalog_images) : null,
    ai_model_images: p.ai_model_images ? JSON.parse(p.ai_model_images) : null,
    tags: p.tags ? JSON.parse(p.tags) : null,
    seller_metadata: p.seller_metadata ? JSON.parse(p.seller_metadata) : null,
    verification_report: p.verification_report ? JSON.parse(p.verification_report) : null,
    suggestions: p.suggestions ? JSON.parse(p.suggestions) : null,
  }
}

export function deleteProduct(id, sellerId) {
  const db = getDB()
  const numericId = Number(id)
  const numericSellerId = Number(sellerId)
  if (!Number.isInteger(numericId) || !Number.isInteger(numericSellerId)) {
    return null
  }

  const product = db
    .prepare('SELECT id, seller_id, title FROM products WHERE id = ? AND seller_id = ?')
    .get(numericId, numericSellerId)
  if (!product) return null

  const result = db
    .prepare('DELETE FROM products WHERE id = ? AND seller_id = ?')
    .run(numericId, numericSellerId)

  return result.changes === 1 ? product : null
}

export function getSellerByEmail(email) {
  const db = getDB()
  return db.prepare('SELECT * FROM sellers WHERE email = ?').get(email)
}

export function getAllProducts() {
  return getProducts(null);
}

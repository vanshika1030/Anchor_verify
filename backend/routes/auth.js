import express from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { getDB, getSellerByEmail } from '../services/database.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'anchor-demo-secret-key'

const hashPwd = (pwd) => crypto.createHash('sha256').update(pwd).digest('hex')

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const seller = getSellerByEmail(email)
  if (!seller) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  if (seller.password_hash !== hashPwd(password)) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const token = jwt.sign(
    { id: seller.id, email: seller.email, business_name: seller.business_name },
    JWT_SECRET,
    { expiresIn: '24h' }
  )

  res.json({ token, seller: { id: seller.id, email: seller.email, business_name: seller.business_name } })
})

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { email, password, business_name } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const existing = getSellerByEmail(email)
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' })
  }

  try {
    const db = getDB()
    const insert = db.prepare('INSERT INTO sellers (email, password_hash, business_name) VALUES (?, ?, ?)')
    const result = insert.run(email, hashPwd(password), business_name || null)
    
    const token = jwt.sign(
      { id: result.lastInsertRowid, email, business_name },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.json({
      token,
      seller: { id: result.lastInsertRowid, email, business_name }
    })
  } catch (error) {
    res.status(500).json({ error: 'Database error during registration' })
  }
})

// GET /api/auth/me
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' })
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const seller = getSellerByEmail(decoded.email)
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' })
    }
    res.json({ seller: { id: seller.id, email: seller.email, business_name: seller.business_name } })
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' })
  }
})

export default router

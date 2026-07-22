import express from 'express'
import jwt from 'jsonwebtoken'
import { getProducts, getProductById, createProduct, getAllProducts } from '../services/database.js'
import { getDemoProduct } from '../demo_registry.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'anchor-demo-secret-key'

// Middleware to extract seller from JWT (optional — doesn't block if no token)
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.seller = jwt.verify(authHeader.split(' ')[1], JWT_SECRET)
    } catch {}
  }
  next()
}

// Required auth
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  try {
    req.seller = jwt.verify(authHeader.split(' ')[1], JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// GET /api/products — list products for the authenticated seller
router.get('/', optionalAuth, (req, res) => {
  try {
    const sellerId = req.seller?.id || null
    const products = getProducts(sellerId)
    res.json(products)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/products/all — list all products across all sellers (public)
router.get('/all', (req, res) => {
  try {
    const products = getAllProducts()
    res.json(products)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/products/:id — get a single product (public, for customer view)
router.get('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const product = getProductById(id)
    if (!product) return res.status(404).json({ error: 'Product not found' })
    res.json(product)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/products — publish a new product
router.post('/', optionalAuth, (req, res) => {
  try {
    const product = createProduct({
      seller_id: req.seller?.id || 1, // Default to demo seller 1 if no auth
      ...req.body
    })
    res.json(product)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router

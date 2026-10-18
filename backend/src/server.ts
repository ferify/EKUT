import crypto from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { db } from './db'
import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import type { RequestHandler } from 'express'
import { v2 as cloudinary } from 'cloudinary'
import type { UploadApiResponse } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 3000
class ImageUploadError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
  }
}

function extractPublicIdFromUrl(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/)
  return match ? match[1] : null
}

async function saveImageDataUrl(
  dataUrl: string,
  filenamePrefix: string,
): Promise<{ url: string; filePath: string | null; publicId: string | null }> {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl)
  if (!match) {
    throw new ImageUploadError('Format foto tidak valid. Gunakan JPG, PNG, atau WEBP.', 400)
  }

  const mimeType = match[1]
  const imageBuffer = Buffer.from(match[2], 'base64')
  if (imageBuffer.length > 1.5 * 1024 * 1024) {
    throw new ImageUploadError('Ukuran foto maksimal 1,5 MB.', 413)
  }

  const isPng = imageBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const isJpeg = imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 && imageBuffer[2] === 0xff
  const isWebp =
    imageBuffer.toString('ascii', 0, 4) === 'RIFF' &&
    imageBuffer.toString('ascii', 8, 12) === 'WEBP'
  if (
    (mimeType === 'png' && !isPng) ||
    (mimeType === 'jpeg' && !isJpeg) ||
    (mimeType === 'webp' && !isWebp)
  ) {
    throw new ImageUploadError('Isi file tidak sesuai dengan format foto yang dipilih.', 400)
  }

  if (process.env.VERCEL) {
    try {
      const result: UploadApiResponse = await cloudinary.uploader.upload(dataUrl, {
        folder: 'ekut',
        public_id: `${filenamePrefix}-${Date.now()}`,
        resource_type: 'image',
        overwrite: false,
      })

      return {
        url: result.secure_url,
        filePath: null,
        publicId: result.public_id,
      }
    } catch (error) {
      console.error('Cloudinary upload failed:', error)
      throw new ImageUploadError('Gagal mengunggah foto.', 500)
    }
  }
  else {
    const extension = mimeType === 'jpeg' ? 'jpg' : mimeType
    const filename = `${filenamePrefix}-${crypto.randomBytes(12).toString('hex')}.${extension}`
    const uploadDirectory = path.join(process.cwd(), 'uploads')
    const filePath = path.join(uploadDirectory, filename)
    await mkdir(uploadDirectory, { recursive: true })
    await writeFile(filePath, imageBuffer)
    return {
      url: `/uploads/${filename}`,
      filePath,
      publicId: null,
    }
  }
}

const REVIEW_TAGS = [
  'Porsi cukup',
  'Enak',
  'Harga murah',
  'Cepat disajikan',
  'Higienis',
  'Penyajian menarik',
] as const

// Simulasi OTP
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Jakarta'
const MIN_SCHEDULE_LEAD_MINUTES = 5
const OTP_TTL_MINUTES = 5
const OTP_RESEND_SECONDS = 30
const OTP_MAX_ATTEMPTS = 5
const OTP_DEMO_MODE = process.env.OTP_DEMO_MODE !== 'false'

const PHONE_PATTERN = /^\+?\d{8,15}$/

function normalizePhone(value: string): string {
  return value.replace(/[\s\-().]/g, '')
}

// Compare Phone Number.
const phoneSql = (column: string) =>
  `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${column}, ' ', ''), '-', ''), '.', ''), '(', ''), ')', '')`

function normalizeMenuCategory(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, 50)
  return trimmed || null
}

function queryString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Pelanggan'
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`
}

function parseTags(value: unknown): string[] {
  if (typeof value !== 'string' || !value) return []
  return value.split(',').filter(Boolean)
}

function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET
  return secret && secret.length >= 32 ? secret : null
}

// APP Time Zone
function nowInAppTimezone(): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const pick = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '00'
  return {
    date: `${pick('year')}-${pick('month')}-${pick('day')}`,
    hour: Number(pick('hour')),
    minute: Number(pick('minute')),
  }
}

// Order Schedule

function resolveScheduledFor(input: unknown): string | null {
  if (input === undefined || input === null || input === '' || input === 'now') {
    return null
  }
  if (typeof input !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input)) {
    throw new Error('Waktu pemesanan tidak valid.')
  }
  const now = nowInAppTimezone()
  const requested = Number(input.slice(0, 2)) * 60 + Number(input.slice(3, 5))
  const earliest = now.hour * 60 + now.minute + MIN_SCHEDULE_LEAD_MINUTES
  if (requested < earliest) {
    throw new Error(
      `Waktu pemesanan tidak valid. Pilih waktu hari ini minimal ${MIN_SCHEDULE_LEAD_MINUTES} menit dari sekarang.`,
    )
  }
  return `${now.date} ${input}:00`
}

// Verify checkout

async function ensureCustomer(
  connection: PoolConnection,
  name: string,
  phone: string,
): Promise<number> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT c.customer_id
     FROM customers c
     WHERE ${phoneSql('c.phone')} = ?
     ORDER BY c.customer_id ASC
     LIMIT 1`,
    [phone],
  )
  if (rows[0]) {
    const customerId = Number(rows[0].customer_id)
    await connection.execute(
      'UPDATE customers SET name = ? WHERE customer_id = ?',
      [name, customerId],
    )
    return customerId
  }
  const [result] = await connection.execute(
    'INSERT INTO customers (name, phone) VALUES (?, ?)',
    [name, phone],
  )
  return (result as { insertId: number }).insertId
}

async function assertTenantsOpen(
  connection: PoolConnection,
  tenantIds: number[],
): Promise<void> {
  for (const tenantId of tenantIds) {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT tenant_name, is_open, status FROM tenants WHERE tenant_id = ?',
      [tenantId],
    )
    const tenant = rows[0]
    if (!tenant) {
      throw new Error('Tenant tidak ditemukan.')
    }
    if (String(tenant.status).toLowerCase() !== 'active') {
      throw new Error(`${tenant.tenant_name} tidak tersedia.`)
    }
    if (Number(tenant.is_open) !== 1) {
      throw new Error(
        `${tenant.tenant_name} sedang tutup. Pesanan tidak dapat dibuat.`,
      )
    }
  }
}

function derivePrefix(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const initials = words
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
  return initials || 'T'
}

async function ensureTenantQueuePrefix(
  connection: PoolConnection,
  tenantId: number,
): Promise<string> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT tenant_name, queue_prefix FROM tenants WHERE tenant_id = ? FOR UPDATE',
    [tenantId],
  )
  const tenant = rows[0]
  if (!tenant) {
    throw new Error('Tenant tidak ditemukan.')
  }
  if (tenant.queue_prefix) {
    return String(tenant.queue_prefix)
  }
  const base = derivePrefix(String(tenant.tenant_name))
  let candidate = base
  for (let attempt = 0; attempt < 9; attempt += 1) {
    const [duplicates] = await connection.execute<RowDataPacket[]>(
      'SELECT tenant_id FROM tenants WHERE queue_prefix = ? AND tenant_id <> ? LIMIT 1',
      [candidate, tenantId],
    )
    if (duplicates.length === 0) break
    candidate = attempt === 8 ? `T${tenantId}` : `${base}${attempt + 2}`
  }
  await connection.execute(
    'UPDATE tenants SET queue_prefix = ? WHERE tenant_id = ?',
    [candidate, tenantId],
  )
  return candidate
}

// Queue Numbers
async function assignQueueNumbers(
  connection: PoolConnection,
  orderIds: number[],
): Promise<Record<number, string>> {
  const result: Record<number, string> = {}
  const today = nowInAppTimezone().date
  for (const orderId of orderIds) {
    const [orderRows] = await connection.execute<RowDataPacket[]>(
      'SELECT order_id, tenant_id, queue_number FROM orders WHERE order_id = ? FOR UPDATE',
      [orderId],
    )
    const order = orderRows[0]
    if (!order) continue
    if (order.queue_number) {
      result[orderId] = String(order.queue_number)
      continue
    }
    const tenantId = Number(order.tenant_id)
    const prefix = await ensureTenantQueuePrefix(connection, tenantId)
    await connection.execute(
      `INSERT INTO tenant_queue_counters (tenant_id, queue_date, last_number)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE last_number = last_number + 1`,
      [tenantId, today],
    )
    const [counterRows] = await connection.execute<RowDataPacket[]>(
      'SELECT last_number FROM tenant_queue_counters WHERE tenant_id = ? AND queue_date = ?',
      [tenantId, today],
    )
    const sequence = Number(counterRows[0].last_number)
    const queueNumber = `${prefix}-${sequence}`
    await connection.execute(
      'UPDATE orders SET queue_number = ?, queue_seq = ?, queue_date = ? WHERE order_id = ?',
      [queueNumber, sequence, today, orderId],
    )
    result[orderId] = queueNumber
  }
  return result
}

// Rating Query

const MENU_RATING_JOIN = `
  LEFT JOIN (
    SELECT menu_id, AVG(rating) AS rating_avg, COUNT(*) AS rating_count
    FROM reviews
    GROUP BY menu_id
  ) rv ON rv.menu_id = m.menu_id`

const MENU_ORDER_COUNT_JOIN = `
  LEFT JOIN (
    SELECT oi.menu_id, SUM(oi.quantity) AS order_count
    FROM order_items oi
    INNER JOIN orders o ON o.order_id = oi.order_id
    INNER JOIN payments p ON p.order_id = o.order_id
      AND p.payment_status = 'paid'
    GROUP BY oi.menu_id
  ) oc ON oc.menu_id = m.menu_id`

const MENU_STATS_COLUMNS = `
  COALESCE(rv.rating_avg, 0) AS rating_avg,
  COALESCE(rv.rating_count, 0) AS rating_count,
  COALESCE(oc.order_count, 0) AS order_count`

function mapReview(row: RowDataPacket) {
  return {
    reviewId: Number(row.review_id),
    menuId: row.menu_id !== undefined ? Number(row.menu_id) : undefined,
    menuName: row.menu_name !== undefined ? String(row.menu_name) : undefined,
    rating: Number(row.rating),
    tags: parseTags(row.tags),
    comment: row.comment ? String(row.comment) : '',
    reviewerName: maskName(String(row.customer_name ?? '')),
    createdAt: row.created_at_text ? String(row.created_at_text) : null,
  }
}

function sendError(
  res: Parameters<RequestHandler>[1],
  statusCode: number,
  message: string,
) {
  res.status(statusCode).json({ status: 'error', message })
}

function hashOtp(phone: string, code: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex')
}

const requireAdmin: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : ''
  if (!token) {
    res.status(401).json({
      status: 'error',
      message: 'Token autentikasi diperlukan.',
    })
    return
  }

  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    res.status(500).json({
      status: 'error',
      message: 'Konfigurasi autentikasi belum siap.',
    })
    return
  }

  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload
    if (decoded.role !== 'admin') {
      res.status(403).json({
        status: 'error',
        message: 'Akses hanya untuk admin.',
      })
      return
    }

    next()
  } catch {
    res.status(401).json({
      status: 'error',
      message: 'Token tidak valid atau sudah kedaluwarsa.',
    })
  }
}

const requireTenant: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : ''

  if (!token) {
    res.status(401).json({
      status: 'error',
      message: 'Token autentikasi diperlukan.',
    })
    return
  }

  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    res.status(500).json({
      status: 'error',
      message: 'Konfigurasi autentikasi belum siap.',
    })
    return
  }

  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload
    if (
      decoded.role !== 'tenant' ||
      !Number.isSafeInteger(decoded.userId) ||
      !Number.isSafeInteger(decoded.tenantId) ||
      decoded.userId < 1 ||
      decoded.tenantId < 1
    ) {
      res.status(403).json({
        status: 'error',
        message: 'Akses hanya untuk akun tenant yang valid.',
      })
      return
    }

    res.locals.tenant = {
      userId: decoded.userId as number,
      tenantId: decoded.tenantId as number,
    }
    next()
  } catch {
    res.status(401).json({
      status: 'error',
      message: 'Token tidak valid atau sudah kedaluwarsa.',
    })
  }
}

// Auth customer (login via OTP)
const requireCustomer: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    sendError(res, 401, 'Silakan masuk dengan nomor telepon terlebih dahulu.')
    return
  }
  const secret = getJwtSecret()
  if (!secret) {
    sendError(res, 500, 'Konfigurasi autentikasi belum siap.')
    return
  }
  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload
    if (decoded.role !== 'customer' || typeof decoded.phone !== 'string') {
      sendError(res, 403, 'Akses hanya untuk customer yang sudah masuk.')
      return
    }
    res.locals.customer = {
      phone: decoded.phone,
      name: typeof decoded.name === 'string' ? decoded.name : '',
    }
    next()
  } catch {
    sendError(res, 401, 'Sesi customer tidak valid atau sudah kedaluwarsa.')
  }
}

app.use(cors())
app.use(express.json({ limit: '3mb' }))
if (!process.env.VERCEL) {
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))
}

type CheckoutItem = {
  menuId: number
  quantity: number
}
type CheckoutRequest = {
  customer: {
    name: string
    phone: string
  }
  items: CheckoutItem[]
  scheduledTime?: string | null
}

app.get('/', (_req, res) => {
  res.json({
    message: 'EKUT Backend API is running',
    status: 'success',
  })
})

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'EKUT API',
  })
})

app.get('/api/health/db', async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 AS connected')
    res.json({
      status: 'success',
      database: 'connected',
      result: rows,
    })
 } catch (error) {
  console.error('Login failed:', error)
  if (error instanceof Error) {
    console.error(error.stack)
  }

    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      message:
        error instanceof Error
          ? error.message
          : 'Unknown database error',
    })
  }
})

// Get active tenants
app.get('/api/admin/tenants', requireAdmin, async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        t.tenant_id,
        t.tenant_name,
        t.phone,
        t.profile_photo,
        t.status,
        t.is_open,
        t.category,
        t.queue_prefix,
        u.username
      FROM tenants t
      LEFT JOIN users u ON u.user_id = t.user_id
      ORDER BY t.tenant_id ASC
    `)
    res.json({
      status: 'success',
      data: rows,
    })
  } catch (error) {
    console.error('Failed to fetch admin tenants:', error)
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data tenant.',
    })
  }
})

app.patch(
  '/api/admin/tenants/:tenantId/status',
  requireAdmin,
  async (req, res) => {
    const tenantId = Number(req.params.tenantId)
    const status: unknown = req.body?.status
    if (!Number.isSafeInteger(tenantId) || tenantId < 1) {
      res.status(400).json({
        status: 'error',
        message: 'ID tenant tidak valid.',
      })
      return
    }

    if (status !== 'active' && status !== 'inactive') {
      res.status(400).json({
        status: 'error',
        message: 'Status harus active atau inactive.',
      })
      return
    }

    let connection
    try {
      connection = await db.getConnection()
      await connection.beginTransaction()
      const [tenantRows] = await connection.execute(
        `SELECT tenant_id, user_id
         FROM tenants
         WHERE tenant_id = ?
         FOR UPDATE`,
        [tenantId],
      )
      const tenants = tenantRows as Array<{
        tenant_id: number
        user_id: number | null
      }>
      const tenant = tenants[0]
      if (!tenant) {
        await connection.rollback()
        res.status(404).json({
          status: 'error',
          message: 'Tenant tidak ditemukan.',
        })
        return
      }
      await connection.execute(
        `UPDATE tenants
         SET status = ?
         WHERE tenant_id = ?`,
        [status, tenantId],
      )
      if (tenant.user_id != null) {
        await connection.execute(
          `UPDATE users
           SET status = ?
           WHERE user_id = ? AND role = 'tenant'`,
          [status, tenant.user_id],
        )
      }
      await connection.commit()
      res.json({
        status: 'success',
        message:
          status === 'active'
            ? 'Tenant berhasil diaktifkan.'
            : 'Tenant berhasil dinonaktifkan.',
        data: {
          tenantId,
          status,
        },
      })
    } catch (error) {
      if (connection) {
        await connection.rollback()
      }
      console.error('Failed to update tenant status:', error)
      res.status(500).json({
        status: 'error',
        message: 'Gagal mengubah status tenant.',
      })
    } finally {
      connection?.release()
    }
  },
)

// Checkout: one customer, potentially multiple tenant orders
app.post('/api/checkout', async (req, res) => {
  const body = req.body as CheckoutRequest
  const name =
    typeof body?.customer?.name === 'string'
      ? body.customer.name.trim()
      : ''
  const phone = normalizePhone(
    typeof body?.customer?.phone === 'string'
      ? body.customer.phone.trim()
      : '',
  )
  if (!name || !phone) {
    res.status(400).json({
      status: 'error',
      message: 'Nama dan nomor telepon wajib diisi.',
    })
    return
  }
  if (name.length > 100 || phone.length > 20) {
    res.status(400).json({
      status: 'error',
      message: 'Nama atau nomor telepon terlalu panjang.',
    })
    return
  }
  if (!PHONE_PATTERN.test(phone)) {
    res.status(400).json({
      status: 'error',
      message: 'Nomor telepon tidak valid. Gunakan 8-15 digit angka.',
    })
    return
  }
  let scheduledFor: string | null
  try {
    scheduledFor = resolveScheduledFor(body.scheduledTime)
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message:
        error instanceof Error ? error.message : 'Waktu pemesanan tidak valid.',
    })
    return
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({
      status: 'error',
      message: 'Keranjang masih kosong.',
    })
    return
  }

  // Combine repeated menu IDs and validate quantities
  const quantities = new Map<number, number>()
  for (const item of body.items) {
    if (
      !Number.isInteger(item?.menuId) ||
      item.menuId < 1 ||
      !Number.isInteger(item?.quantity) ||
      item.quantity < 1
    ) {
      res.status(400).json({
        status: 'error',
        message: 'Data menu atau jumlah pesanan tidak valid.',
      })
      return
    }
    const nextQuantity =
      (quantities.get(item.menuId) ?? 0) + item.quantity
    if (!Number.isSafeInteger(nextQuantity)) {
      res.status(400).json({
        status: 'error',
        message: 'Jumlah pesanan terlalu besar.',
      })
      return
    }
    quantities.set(item.menuId, nextQuantity)
  }
  if (quantities.size > 100) {
    res.status(400).json({
      status: 'error',
      message: 'Terlalu banyak jenis menu dalam satu checkout.',
    })
    return
  }
  let connection
  try {
    connection = await db.getConnection()
    await connection.beginTransaction()

    // Lock menu rows while checking prices and stock
    const validatedItems: Array<{
      menuId: number
      tenantId: number
      menuName: string
      price: number
      quantity: number
    }> = []
    for (const [menuId, quantity] of quantities) {
      const [rows] = await connection.query(
        `
          SELECT
            menu_id,
            tenant_id,
            menu_name,
            price,
            quantity,
            status
          FROM menus
          WHERE menu_id = ?
          FOR UPDATE
        `,
        [menuId],
      )
      const menuRows = rows as Array<{
        menu_id: number
        tenant_id: number
        menu_name: string
        price: number | string
        quantity: number
        status: string
      }>
      const menu = menuRows[0]
      if (!menu) {
        throw new Error(`Menu dengan ID ${menuId} tidak ditemukan.`)
      }
      if (menu.status !== 'available') {
        throw new Error(`${menu.menu_name} sedang tidak tersedia.`)
      }
      if (Number(menu.quantity) < quantity) {
        throw new Error(
          `Stok ${menu.menu_name} tidak mencukupi.`,
        )
      }
      const price = Number(menu.price)
      if (!Number.isFinite(price) || price < 0) {
        throw new Error(`Harga ${menu.menu_name} tidak valid.`)
      }
      validatedItems.push({
        menuId: Number(menu.menu_id),
        tenantId: Number(menu.tenant_id),
        menuName: menu.menu_name,
        price,
        quantity,
      })
    }

    // Group validated items by tenant
    const tenantGroups = new Map<
      number,
      typeof validatedItems
    >()
    for (const item of validatedItems) {
      const group = tenantGroups.get(item.tenantId) ?? []
      group.push(item)
      tenantGroups.set(item.tenantId, group)
    }
    // Tenant yang sedang tutup tidak boleh menerima pesanan baru
    await assertTenantsOpen(connection, Array.from(tenantGroups.keys()))
    // Calculate the total from database prices, not frontend prices
    const checkoutTotal = validatedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    )
    if (
      !Number.isSafeInteger(checkoutTotal) ||
      checkoutTotal < 1
    ) {
      throw new Error('Total pembayaran tidak valid.')
    }
    // Pelanggan dicocokkan berdasarkan nomor telepon (dibuat jika belum ada)
    const customerId = await ensureCustomer(connection, name, phone)
    const createdOrders: Array<{
      orderId: number
      orderNumber: string
      tenantId: number
      totalAmount: number
      paymentStatus: string
      scheduledTime: string | null
      queueNumber: string | null
    }> = []

    // Create one order and one pending payment per tenant
    for (const [tenantId, items] of tenantGroups) {
      const tenantTotal = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      )
      const orderNumber =
        `EKUT${Date.now()}${String(tenantId).padStart(2, '0')}`
      const [orderResult] = await connection.execute(
        `
          INSERT INTO orders (
            order_number,
            customer_id,
            tenant_id,
            total_amount,
            order_status,
            scheduled_for
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          orderNumber,
          customerId,
          tenantId,
          tenantTotal,
          'pending',
          scheduledFor,
        ],
      )
      const orderId = (
        orderResult as { insertId: number }
      ).insertId
      for (const item of items) {
        const subtotal = item.price * item.quantity
        await connection.execute(
          `
            INSERT INTO order_items (
              order_id,
              menu_id,
              quantity,
              price,
              subtotal
            )
            VALUES (?, ?, ?, ?, ?)
          `,
          [
            orderId,
            item.menuId,
            item.quantity,
            item.price,
            subtotal,
          ],
        )
        const [stockResult] = await connection.execute(
          `
            UPDATE menus
            SET quantity = quantity - ?
            WHERE menu_id = ?
              AND quantity >= ?
              AND status = 'available'
          `,
          [item.quantity, item.menuId, item.quantity],
        )
        if (
          (stockResult as { affectedRows: number }).affectedRows !== 1
        ) {
          throw new Error(
            `Stok ${item.menuName} berubah. Silakan coba lagi.`,
          )
        }
      }
      await connection.execute(
        `
          INSERT INTO payments (
            order_id,
            payment_method,
            amount,
            payment_status
          )
          VALUES (?, ?, ?, ?)
        `,
        [orderId, 'QRIS', tenantTotal, 'pending'],
      )
      createdOrders.push({
        orderId,
        orderNumber,
        tenantId,
        totalAmount: tenantTotal,
        paymentStatus: 'pending',
        scheduledTime: scheduledFor ? scheduledFor.slice(11, 16) : null,
        queueNumber: null,
      })
    }
    await connection.commit()
    res.status(201).json({
      status: 'success',
      message:
        'Pesanan berhasil dibuat. Pembayaran belum dikonfirmasi.',
      data: {
        customerId,
        customerName: name,
        customerPhone: phone,
        totalAmount: checkoutTotal,
        orderCount: createdOrders.length,
        paymentStatus: 'pending',
        orders: createdOrders,
      },
    })
  } catch (error) {
    if (connection) {
      await connection.rollback()
    }
    console.error('Checkout failed:', error)
    const message =
      error instanceof Error
        ? error.message
        : 'Checkout gagal diproses.'
    const isValidationError =
      /tidak ditemukan|tidak tersedia|tidak mencukupi|tidak valid|berubah|sedang tutup/i.test(
        message,
      )
    res.status(isValidationError ? 400 : 500).json({
      status: 'error',
      message,
    })
  } finally {
    connection?.release()
  }
})
type SimulatePaymentRequest = {
  orderIds: number[]
}

// DEMO ONLY: simulate a successful payment.
app.post('/api/payments/simulate-success', async (req, res) => {
  const orderIds: unknown = req.body?.orderIds
  if (
    !Array.isArray(orderIds) ||
    orderIds.length === 0 ||
    orderIds.length > 100 ||
    !orderIds.every(
      (id) => Number.isSafeInteger(id) && id > 0,
    ) ||
    new Set(orderIds).size !== orderIds.length
  ) {
    res.status(400).json({
      status: 'error',
      message: 'Daftar order ID tidak valid.',
    })
    return
  }
  let connection
  try {
    connection = await db.getConnection()
    await connection.beginTransaction()
    const placeholders = orderIds.map(() => '?').join(', ')
    const [rows] = await connection.query(
      `
        SELECT order_id, payment_status
        FROM payments
        WHERE order_id IN (${placeholders})
        FOR UPDATE
      `,
      orderIds,
    )
    const payments = rows as Array<{
      order_id: number
      payment_status: string
    }>
    if (
      payments.length !== orderIds.length ||
      !orderIds.every((id) =>
        payments.some((payment) => payment.order_id === id),
      )
    ) {
      throw new Error(
        'Sebagian data pembayaran tidak ditemukan.',
      )
    }
    if (
      payments.some(
        (payment) => payment.payment_status !== 'pending',
      )
    ) {
      throw new Error(
        'Pembayaran sudah diproses atau bukan berstatus pending.',
      )
    }
    const referencePrefix = `SIM-${Date.now()}`
    for (const orderId of orderIds) {
      await connection.execute(
        `
          UPDATE payments
          SET
            payment_status = 'paid',
            payment_date = NOW(),
            payment_reference = ?
          WHERE order_id = ?
            AND payment_status = 'pending'
        `,
        [`${referencePrefix}-${orderId}`, orderId],
      )
    }
    // Nomor antrian per tenant diberikan setelah pembayaran berhasil
    const queueNumbers = await assignQueueNumbers(connection, orderIds)
    await connection.commit()
    res.json({
      status: 'success',
      simulated: true,
      message: 'Pembayaran simulasi berhasil.',
      data: {
        orderIds,
        paymentStatus: 'paid',
        paymentReference: referencePrefix,
        queueNumbers,
      },
    })
  } catch (error) {
    if (connection) {
      await connection.rollback()
    }
    const message =
      error instanceof Error
        ? error.message
        : 'Pembayaran simulasi gagal.'
    res.status(400).json({
      status: 'error',
      message,
    })
  } finally {
    connection?.release()
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const username =
      typeof req.body?.username === 'string'
        ? req.body.username.trim()
        : ''
    const password =
      typeof req.body?.password === 'string'
        ? req.body.password
        : ''
    if (!username || !password) {
      res.status(400).json({
        status: 'error',
        message: 'Username dan password wajib diisi.',
      })
      return
    }
    const secret = process.env.JWT_SECRET
    console.log('JWT_SECRET loaded:', Boolean(secret))
    console.log('JWT_SECRET length:', secret?.length ?? 0)
    if (!secret || secret.length < 32) {
      res.status(500).json({
        status: 'error',
        message: 'Konfigurasi autentikasi belum siap.',
      })
      return
    }
    const [rows] = await db.execute(
      `SELECT
        u.user_id,
        u.username,
        u.password,
        u.role,
        u.status,
        t.tenant_id,
        t.tenant_name
      FROM users u
      LEFT JOIN tenants t ON t.user_id = u.user_id
      WHERE u.username = ?
      LIMIT 1`,
      [username],
    )

    const users = rows as Array<{
      user_id: number
      username: string
      password: string
      role: string
      status: string
      tenant_id: number | null
      tenant_name: string | null
    }>
    const user = users[0]
    if (
      !user ||
      user.status !== 'active' ||
      !['admin', 'tenant'].includes(user.role)
    ) {
      res.status(401).json({
        status: 'error',
        message: 'Username atau password salah.',
      })
      return
    }
    if (user.role === 'tenant' && user.tenant_id == null) {
      res.status(403).json({
        status: 'error',
        message: 'Akun tenant belum terhubung ke data tenant.',
      })
      return
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password,
    )
    if (!passwordMatches) {
      res.status(401).json({
        status: 'error',
        message: 'Username atau password salah.',
      })
      return
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        role: user.role,
        ...(user.tenant_id != null
          ? { tenantId: user.tenant_id }
          : {}),
      },
      secret,
      { expiresIn: '2h' },
    )
    res.json({
      status: 'success',
      message: 'Login berhasil.',
      data: {
        token,
        user: {
          userId: user.user_id,
          username: user.username,
          role: user.role,
          ...(user.tenant_id != null
            ? {
                tenantId: user.tenant_id,
                tenantName: user.tenant_name,
              }
            : {}),
        },
      },
    })
 } catch (error) {
  console.error('Login failed:', error)
  if (error instanceof Error) {
    console.error(error.stack)
  }
    res.status(500).json({
      status: 'error',
      message: 'Login gagal diproses.',
    })
  }
})

app.get('/api/admin/transactions', requireAdmin, async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        o.order_id,
        o.order_number,
        o.order_date,
        o.order_status,
        o.total_amount,
        c.name AS customer_name,
        c.phone AS customer_phone,
        t.tenant_name,
        p.payment_method,
        p.payment_status,
        p.payment_date,
        p.payment_reference,
        p.amount AS payment_amount
      FROM orders o
      INNER JOIN customers c
        ON c.customer_id = o.customer_id
      INNER JOIN tenants t
        ON t.tenant_id = o.tenant_id
      LEFT JOIN payments p
        ON p.order_id = o.order_id
      ORDER BY o.order_date DESC, o.order_id DESC
    `)
    res.json({
      status: 'success',
      data: rows,
    })
  } catch (error) {
    console.error('Failed to fetch admin transactions:', error)
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data transaksi.',
    })
  }
})

app.get('/api/admin/tenant-income', requireAdmin, async (req, res) => {
  try {
    const startDate = req.query.startDate
    const endDate = req.query.endDate
    const validDate = (value: unknown): value is string =>
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
    if (
      (startDate !== undefined && !validDate(startDate)) ||
      (endDate !== undefined && !validDate(endDate))
    ) {
      res.status(400).json({
        status: 'error',
        message: 'Format tanggal harus YYYY-MM-DD.',
      })
      return
    }
    if (
      typeof startDate === 'string' &&
      typeof endDate === 'string' &&
      startDate > endDate
    ) {
      res.status(400).json({
        status: 'error',
        message: 'Tanggal awal tidak boleh setelah tanggal akhir.',
      })
      return
    }
    const incomeDateConditions: string[] = []
    const transferDateConditions: string[] = []
    const params: string[] = []
    if (typeof startDate === 'string') {
      incomeDateConditions.push('p.payment_date >= ?')
      params.push(startDate)
    }
    if (typeof endDate === 'string') {
      incomeDateConditions.push('p.payment_date < DATE_ADD(?, INTERVAL 1 DAY)')
      params.push(endDate)
    }
    if (typeof startDate === 'string') {
      transferDateConditions.push('transfer_date >= ?')
      params.push(startDate)
    }
    if (typeof endDate === 'string') {
      transferDateConditions.push('transfer_date < DATE_ADD(?, INTERVAL 1 DAY)')
      params.push(endDate)
    }
    const incomeDateFilter = incomeDateConditions.length
      ? `AND ${incomeDateConditions.join(' AND ')}`
      : ''
    const transferDateFilter = transferDateConditions.length
      ? `AND ${transferDateConditions.join(' AND ')}`
      : ''

    const [rows] = await db.execute(`
      SELECT
        t.tenant_id,
        t.tenant_name,
        t.bank_name,
        t.bank_account,
        COALESCE(income.total_income, 0) AS total_income,
        COALESCE(income.paid_orders, 0) AS paid_orders,
        COALESCE(transfers.total_transferred, 0) AS total_transferred,
        GREATEST(
          0,
          COALESCE(lifetime_income.total_income, 0) -
          COALESCE(lifetime_transfers.total_transferred, 0)
        ) AS outstanding_balance
      FROM tenants t
      LEFT JOIN (
        SELECT
          o.tenant_id,
          SUM(p.amount) AS total_income,
          COUNT(DISTINCT o.order_id) AS paid_orders
        FROM orders o
        INNER JOIN payments p ON p.order_id = o.order_id
        WHERE p.payment_status = 'paid'
          ${incomeDateFilter}
        GROUP BY o.tenant_id
      ) income ON income.tenant_id = t.tenant_id
      LEFT JOIN (
        SELECT
          tenant_id,
          SUM(amount) AS total_transferred
        FROM transfers
        WHERE status = 'completed'
          ${transferDateFilter}
        GROUP BY tenant_id
      ) transfers ON transfers.tenant_id = t.tenant_id
      LEFT JOIN (
        SELECT
          o.tenant_id,
          SUM(p.amount) AS total_income
        FROM orders o
        INNER JOIN payments p ON p.order_id = o.order_id
        WHERE p.payment_status = 'paid'
        GROUP BY o.tenant_id
      ) lifetime_income ON lifetime_income.tenant_id = t.tenant_id
      LEFT JOIN (
        SELECT
          tenant_id,
          SUM(amount) AS total_transferred
        FROM transfers
        WHERE status = 'completed'
        GROUP BY tenant_id
      ) lifetime_transfers ON lifetime_transfers.tenant_id = t.tenant_id
      ORDER BY t.tenant_name ASC, t.tenant_id ASC
    `, params)

    const tenantRows = rows as Array<{
      tenant_id: number | string
      tenant_name: string
      bank_name: string | null
      bank_account: string | null
      total_income: number | string
      paid_orders: number | string
      total_transferred: number | string
      outstanding_balance: number | string
    }>

    res.json({
      status: 'success',
      data: tenantRows.map((row) => ({
        ...row,
        tenant_id: Number(row.tenant_id),
        total_income: Number(row.total_income),
        paid_orders: Number(row.paid_orders),
        total_transferred: Number(row.total_transferred),
        outstanding_balance: Number(row.outstanding_balance),
      })),
    })
  } catch (error) {
    console.error('Failed to fetch admin tenant income:', error)
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil rekap pendapatan tenant.',
    })
  }
})

app.get('/api/admin/dashboard/stats', requireAdmin, async (_req, res) => {
  try {
    const [salesRows] = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END), 0) AS totalSales,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END), 0) AS paidPayments
      FROM payments
    `)

    const [transactionRows] = await db.query(`
      SELECT COUNT(*) AS totalTransactions
      FROM orders o
      INNER JOIN payments p ON p.order_id = o.order_id
      WHERE p.payment_status = 'paid'
    `)
    const [tenantRows] = await db.query(`
      SELECT
        COUNT(*) AS totalTenants,
        SUM(
          CASE WHEN status = 'active' THEN 1 ELSE 0 END
        ) AS activeTenants
      FROM tenants
    `)
    const [rentalRows] = await db.query(`
      SELECT COUNT(*) AS rentalPayments
      FROM rental_payments
    `)
    const sales = (salesRows as Array<{
      totalSales: number | string
      paidPayments: number | string
    }>)[0]
    const transactions = (transactionRows as Array<{
      totalTransactions: number | string
    }>)[0]
    const tenantStats = (tenantRows as Array<{
      totalTenants: number | string
      activeTenants: number | string | null
    }>)[0]
    const rentals = (rentalRows as Array<{
      rentalPayments: number | string
    }>)[0]
    res.json({
      status: 'success',
      data: {
        totalSales: Number(sales.totalSales),
        paidPayments: Number(sales.paidPayments),
        totalTransactions: Number(transactions.totalTransactions),
        totalTenants: Number(tenantStats.totalTenants),
        activeTenants: Number(tenantStats.activeTenants ?? 0),
        rentalPayments: Number(rentals.rentalPayments),
      },
    })
  } catch (error) {
    console.error('Failed to fetch admin dashboard stats:', error)
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil statistik dashboard.',
    })
  }
})

app.get('/api/admin/dashboard-stats', requireAdmin, async (_req, res) => {
  try {
    const [salesRows] = await db.query(`
      SELECT
        COALESCE(SUM(amount), 0) AS totalSales,
        COUNT(*) AS paidPayments
      FROM payments
      WHERE payment_status = 'paid'
    `)
    const [transactionRows] = await db.query(`
      SELECT COUNT(*) AS totalTransactions
      FROM orders o
      INNER JOIN payments p ON p.order_id = o.order_id
      WHERE p.payment_status = 'paid'
    `)
    const [tenantRows] = await db.query(`
      SELECT
        COUNT(*) AS totalTenants,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)
          AS activeTenants
      FROM tenants
    `)
    const [rentalRows] = await db.query(`
      SELECT COUNT(*) AS rentalPayments
      FROM rental_payments
    `)
    const sales = (salesRows as Array<{
      totalSales: number | string
      paidPayments: number | string
    }>)[0]
    const transactions = (transactionRows as Array<{
      totalTransactions: number | string
    }>)[0]
    const tenantStats = (tenantRows as Array<{
      totalTenants: number | string
      activeTenants: number | string | null
    }>)[0]
    const rentals = (rentalRows as Array<{
      rentalPayments: number | string
    }>)[0]
    res.json({
      status: 'success',
      data: {
        totalSales: Number(sales.totalSales),
        paidPayments: Number(sales.paidPayments),
        totalTransactions: Number(transactions.totalTransactions),
        totalTenants: Number(tenantStats.totalTenants),
        activeTenants: Number(tenantStats.activeTenants ?? 0),
        rentalPayments: Number(rentals.rentalPayments),
      },
    })
  } catch (error) {
    console.error('Failed to fetch admin dashboard stats:', error)
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil statistik dashboard.',
    })
  }
})

app.get('/api/tenant/income', requireTenant, async (req, res) => {
  try {
    const tenantId = res.locals.tenant.tenantId
    const startDate = req.query.startDate
    const endDate = req.query.endDate

    const validDate = (value: unknown): value is string =>
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

    if (
      (startDate !== undefined && !validDate(startDate)) ||
      (endDate !== undefined && !validDate(endDate))
    ) {
      res.status(400).json({
        status: 'error',
        message: 'Format tanggal harus YYYY-MM-DD.',
      })
      return
    }

    if (
      typeof startDate === 'string' &&
      typeof endDate === 'string' &&
      startDate > endDate
    ) {
      res.status(400).json({
        status: 'error',
        message: 'Tanggal awal tidak boleh setelah tanggal akhir.',
      })
      return
    }

    const incomeConditions = [
      'o.tenant_id = ?',
      "p.payment_status = 'paid'",
    ]
    const incomeParams: (string | number)[] = [tenantId]

    if (typeof startDate === 'string') {
      incomeConditions.push('p.payment_date >= ?')
      incomeParams.push(startDate)
    }

    if (typeof endDate === 'string') {
      incomeConditions.push(
        'p.payment_date < DATE_ADD(?, INTERVAL 1 DAY)',
      )
      incomeParams.push(endDate)
    }

    const [incomeRows] = await db.execute(
      `SELECT
        COALESCE(SUM(p.amount), 0) AS total_income,
        COUNT(DISTINCT o.order_id) AS paid_orders
       FROM orders o
       INNER JOIN payments p ON p.order_id = o.order_id
       WHERE ${incomeConditions.join(' AND ')}`,
      incomeParams,
    )

    const transferConditions = ['tenant_id = ?']
    const transferParams: (string | number)[] = [tenantId]

    if (typeof startDate === 'string') {
      transferConditions.push('transfer_date >= ?')
      transferParams.push(startDate)
    }

    if (typeof endDate === 'string') {
      transferConditions.push(
        'transfer_date < DATE_ADD(?, INTERVAL 1 DAY)',
      )
      transferParams.push(endDate)
    }

    const [transferRows] = await db.execute(
      `SELECT COALESCE(SUM(
        CASE WHEN status = 'completed' THEN amount ELSE 0 END
      ), 0) AS total_transferred
       FROM transfers
       WHERE ${transferConditions.join(' AND ')}`,
      transferParams,
    )

    const [historyRows] = await db.execute(
      `SELECT transfer_date, amount, bank_name, bank_account,
              status, reference_number
       FROM transfers
       WHERE ${transferConditions.join(' AND ')}
       ORDER BY transfer_date DESC`,
      transferParams,
    )

    const income = (
      incomeRows as Array<{
        total_income: number | string
        paid_orders: number | string
      }>
    )[0]

    const transfer = (
      transferRows as Array<{
        total_transferred: number | string
      }>
    )[0]

    const totalIncome = Number(income.total_income)
    const totalTransferred = Number(transfer.total_transferred)

    res.json({
      status: 'success',
      data: {
        startDate: typeof startDate === 'string' ? startDate : null,
        endDate: typeof endDate === 'string' ? endDate : null,
        totalIncome,
        paidOrders: Number(income.paid_orders),
        totalTransferred,
        outstandingBalance: Math.max(
          0,
          totalIncome - totalTransferred,
        ),
        transfers: historyRows,
      },
    })
  } catch (error) {
    console.error('Failed to fetch tenant income:', error)
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data pendapatan tenant.',
    })
  }
})

app.post('/api/admin/transfers', requireAdmin, async (req, res) => {
  const tenantId = Number(req.body?.tenantId)
  const amount = Number(req.body?.amount)
  const referenceNumber =
    typeof req.body?.referenceNumber === 'string'
      ? req.body.referenceNumber.trim()
      : null
  if (!Number.isSafeInteger(tenantId) || tenantId < 1) {
    res.status(400).json({
      status: 'error',
      message: 'ID tenant tidak valid.',
    })
    return
  }
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
    res.status(400).json({
      status: 'error',
      message: 'Nominal transfer harus lebih dari nol dan maksimal dua angka desimal.',
    })
    return
  }
if (!referenceNumber || referenceNumber.length > 100) {
  res.status(400).json({
    status: 'error',
    message: 'Nomor referensi transfer wajib diisi, maksimal 100 karakter.',
  })
  return
}
  if (referenceNumber && referenceNumber.length > 100) {
    res.status(400).json({
      status: 'error',
      message: 'Nomor referensi maksimal 100 karakter.',
    })
    return
  }
  let connection
  try {
    connection = await db.getConnection()
    await connection.beginTransaction()
    const [tenantRows] = await connection.execute(
      `SELECT tenant_id, tenant_name, bank_name, bank_account
       FROM tenants
       WHERE tenant_id = ?
       FOR UPDATE`,
      [tenantId],
    )
    const tenant = (
      tenantRows as Array<{
        tenant_id: number
        tenant_name: string
        bank_name: string | null
        bank_account: string | null
      }>
    )[0]
    if (!tenant) {
      await connection.rollback()
      res.status(404).json({
        status: 'error',
        message: 'Tenant tidak ditemukan.',
      })
      return
    }
    if (!tenant.bank_name || !tenant.bank_account) {
      await connection.rollback()
      res.status(400).json({
        status: 'error',
        message: 'Data rekening tenant belum lengkap.',
      })
      return
    }
    const [balanceRows] = await connection.execute(
      `SELECT
         COALESCE((
           SELECT SUM(p.amount)
           FROM orders o
           INNER JOIN payments p ON p.order_id = o.order_id
           WHERE o.tenant_id = ?
             AND p.payment_status = 'paid'
         ), 0) -
         COALESCE((
           SELECT SUM(amount)
           FROM transfers
           WHERE tenant_id = ?
             AND status = 'completed'
         ), 0) AS outstanding_balance`,
      [tenantId, tenantId],
    )
    const balance = Number(
      (balanceRows as Array<{ outstanding_balance: number | string }>)[0]
        ?.outstanding_balance ?? 0,
    )
    if (amount > balance) {
      await connection.rollback()
      res.status(400).json({
        status: 'error',
        message: `Nominal melebihi saldo terutang ${tenant.tenant_name}: Rp ${balance.toLocaleString('id-ID')}.`,
        data: { outstandingBalance: balance },
      })
      return
    }
    const [insertResult] = await connection.execute(
      `INSERT INTO transfers
        (tenant_id, transfer_date, amount, bank_name, bank_account, status, reference_number)
       VALUES (?, NOW(), ?, ?, ?, 'completed', ?)`,
      [
        tenantId,
        amount,
        tenant.bank_name,
        tenant.bank_account,
        referenceNumber || null,
      ],
    )
    const transferId = (
      insertResult as { insertId: number }
    ).insertId
    await connection.commit()
    res.status(201).json({
      status: 'success',
      message: 'Transfer berhasil dicatat.',
      data: {
        transferId,
        tenantId,
        amount,
        status: 'completed',
      },
    })
  } catch (error) {
    if (connection) {
      await connection.rollback()
    }
    console.error('Failed to record tenant transfer:', error)
    res.status(500).json({
      status: 'error',
      message: 'Gagal mencatat transfer tenant.',
    })
  } finally {
    connection?.release()
  }
})

app.get('/api/admin/reports', requireAdmin, async (req, res) => {
  const startDate =
    typeof req.query.startDate === 'string'
      ? req.query.startDate
      : ''
  const endDate =
    typeof req.query.endDate === 'string'
      ? req.query.endDate
      : ''
  const isValidDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  if (
    !isValidDate(startDate) ||
    !isValidDate(endDate) ||
    startDate > endDate
  ) {
    res.status(400).json({
      status: 'error',
      message: 'Rentang tanggal laporan tidak valid.',
    })
    return
  }
  try {
    const [rows] = await db.query(
      `
      SELECT
        t.tenant_id,
        t.tenant_name,
        COALESCE(period_income.period_income, 0)
          AS period_income,
        COALESCE(period_income.paid_orders, 0)
          AS paid_orders,
        COALESCE(all_income.total_income, 0)
          AS total_income,
        COALESCE(transfers.total_transferred, 0)
          AS total_transferred,
        GREATEST(
          COALESCE(all_income.total_income, 0) -
          COALESCE(transfers.total_transferred, 0),
          0
        ) AS outstanding_balance
      FROM tenants t
      LEFT JOIN (
        SELECT
          o.tenant_id,
          SUM(p.amount) AS period_income,
          COUNT(DISTINCT o.order_id) AS paid_orders
        FROM orders o
        INNER JOIN payments p ON p.order_id = o.order_id
        WHERE p.payment_status = 'paid'
          AND p.payment_date >= ?
          AND p.payment_date < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY o.tenant_id
      ) period_income ON period_income.tenant_id = t.tenant_id
      LEFT JOIN (
        SELECT
          o.tenant_id,
          SUM(p.amount) AS total_income
        FROM orders o
        INNER JOIN payments p ON p.order_id = o.order_id
        WHERE p.payment_status = 'paid'
        GROUP BY o.tenant_id
      ) all_income ON all_income.tenant_id = t.tenant_id
      LEFT JOIN (
        SELECT tenant_id, SUM(amount) AS total_transferred
        FROM transfers
        WHERE status = 'completed'
        GROUP BY tenant_id
      ) transfers ON transfers.tenant_id = t.tenant_id
      ORDER BY t.tenant_id ASC
      `,
      [startDate, endDate],
    )
    const data = (rows as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      period_income: Number(row.period_income),
      paid_orders: Number(row.paid_orders),
      total_income: Number(row.total_income),
      total_transferred: Number(row.total_transferred),
      outstanding_balance: Number(row.outstanding_balance),
    }))
    res.json({
      status: 'success',
      data: {
        startDate,
        endDate,
        tenants: data,
        summary: {
          periodIncome: data.reduce((sum, row) => sum + row.period_income, 0),
          paidOrders: data.reduce((sum, row) => sum + row.paid_orders, 0),
          totalIncome: data.reduce((sum, row) => sum + row.total_income, 0),
          totalTransferred: data.reduce((sum, row) => sum + row.total_transferred, 0),
          outstandingBalance: data.reduce((sum, row) => sum + row.outstanding_balance, 0),
        },
      },
    })
  } catch (error) {
    console.error('Failed to fetch admin reports:', error)
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil laporan pendapatan.',
    })
  }
})

app.get('/api/admin/rental-payments', requireAdmin, async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        rp.rental_id,
        rp.tenant_id,
        t.tenant_name,
        rp.rental_period,
        rp.due_date,
        rp.amount,
        rp.payment_date,
        rp.payment_proof,
        CASE
          WHEN rp.status IS NULL OR rp.status = '' THEN 'pending'
          ELSE LOWER(rp.status)
        END AS status
      FROM rental_payments rp
      INNER JOIN tenants t ON t.tenant_id = rp.tenant_id
      ORDER BY rp.due_date DESC, rp.rental_id DESC
    `);
    res.json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching rental payments:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data pembayaran sewa.'
    });
  }
});

app.patch('/api/admin/rental-payments/:rentalId/verify', requireAdmin, async (req, res) => {
  const rentalId = Number(req.params.rentalId)
  if (!Number.isSafeInteger(rentalId) || rentalId < 1) {
    res.status(400).json({
      status: 'error',
      message: 'ID pembayaran sewa tidak valid.',
    })
    return
  }

  try {
    const [result] = await db.execute(
      `UPDATE rental_payments
       SET status = 'paid', payment_date = CURRENT_TIMESTAMP
       WHERE rental_id = ?
         AND payment_proof IS NOT NULL
         AND LOWER(status) IN ('pending', 'overdue')`,
      [rentalId],
    )
    if ((result as { affectedRows: number }).affectedRows === 0) {
      res.status(409).json({
        status: 'error',
        message: 'Pembayaran tidak dapat dikonfirmasi. Pastikan bukti tersedia dan pembayaran belum lunas.',
      })
      return
    }

    res.json({
      status: 'success',
      message: 'Bukti pembayaran diterima dan status pembayaran telah diperbarui.',
    })
  } catch (error) {
    console.error('Failed to verify rental payment:', error)
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengonfirmasi pembayaran sewa.',
    })
  }
})

app.post(
  '/api/admin/tenants/:tenantId/reset-password',
  requireAdmin,
  async (req, res) => {
    const tenantId = Number(req.params.tenantId)
    if (!Number.isSafeInteger(tenantId) || tenantId < 1) {
      res.status(400).json({
        status: 'error',
        message: 'ID tenant tidak valid.',
      })
      return
    }
    try {
      const [rows] = await db.execute(
        `SELECT
          t.tenant_id,
          t.user_id,
          t.tenant_name,
          u.username
        FROM tenants t
        INNER JOIN users u ON u.user_id = t.user_id
        WHERE t.tenant_id = ?
          AND u.role = 'tenant'
        LIMIT 1`,
        [tenantId],
      )
      const tenants = rows as Array<{
        tenant_id: number
        user_id: number
        tenant_name: string
        username: string
      }>
      const tenant = tenants[0]
      if (!tenant) {
        res.status(404).json({
          status: 'error',
          message: 'Akun tenant tidak ditemukan.',
        })
        return
      }
      const temporaryPassword =
        `Ekut-${crypto.randomBytes(12).toString('base64url')}!`
      const passwordHash = await bcrypt.hash(
        temporaryPassword,
        12,
      )
      await db.execute(
        `UPDATE users
         SET password = ?
         WHERE user_id = ?
           AND role = 'tenant'`,
        [passwordHash, tenant.user_id],
      )
      res.json({
        status: 'success',
        message: 'Password tenant berhasil direset.',
        data: {
          tenantId: tenant.tenant_id,
          tenantName: tenant.tenant_name,
          username: tenant.username,
          temporaryPassword,
        },
      })
    } catch (error) {
      console.error('Failed to reset tenant password:', error)
      res.status(500).json({
        status: 'error',
        message: 'Gagal mereset password tenant.',
      })
    }
  },
)

app.get('/api/tenant/profile', requireTenant, async (_req, res) => {
  try {
    const tenantId = res.locals.tenant.tenantId

    const [rows] = await db.execute(
      `SELECT
        t.tenant_id,
        t.tenant_name,
        t.phone,
        t.bank_name,
        t.bank_account,
        t.profile_photo,
        t.status,
        t.is_open,
        t.category,
        t.queue_prefix,
        u.username
      FROM tenants t
      INNER JOIN users u ON u.user_id = t.user_id
      WHERE t.tenant_id = ?
        AND u.role = 'tenant'
        AND u.status = 'active'
      LIMIT 1`,
      [tenantId],
    )

    const tenants = rows as Array<{
      tenant_id: number
      tenant_name: string
      phone: string | null
      bank_name: string | null
      bank_account: string | null
      profile_photo: string | null
      status: string
      username: string
    }>

    if (!tenants[0]) {
      res.status(404).json({
        status: 'error',
        message: 'Profil tenant tidak ditemukan atau akun tidak aktif.',
      })
      return
    }

    res.json({ status: 'success', data: tenants[0] })
  } catch (error) {
    console.error('Failed to fetch tenant profile:', error)
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil profil tenant.',
    })
  }
})

app.patch('/api/tenant/profile', requireTenant, async (req, res) => {
  try {
    const tenantId = res.locals.tenant.tenantId
    const tenantName =
      typeof req.body?.tenant_name === 'string' ? req.body.tenant_name.trim() : ''
    const phone =
      typeof req.body?.phone === 'string' ? req.body.phone.trim() : ''
    const bankName =
      typeof req.body?.bank_name === 'string' ? req.body.bank_name.trim() : ''
    const bankAccount =
      typeof req.body?.bank_account === 'string' ? req.body.bank_account.trim() : ''
    const profilePhoto =
      typeof req.body?.profile_photo === 'string' ? req.body.profile_photo : ''

    if (!tenantName || tenantName.length > 100) {
      res.status(400).json({
        status: 'error',
        message: 'Nama tenant wajib diisi dan maksimal 100 karakter.',
      })
      return
    }
    if (phone.length > 30 || bankName.length > 100 || bankAccount.length > 50) {
      res.status(400).json({
        status: 'error',
        message: 'Kontak atau informasi rekening terlalu panjang.',
      })
      return
    }

    const [rows] = await db.execute(
      `SELECT t.tenant_id, t.user_id, t.profile_photo
       FROM tenants t
       INNER JOIN users u ON u.user_id = t.user_id
       WHERE t.tenant_id = ? AND u.role = 'tenant' AND u.status = 'active'
       LIMIT 1`,
      [tenantId],
    )
    const tenants = rows as Array<{
      tenant_id: number
      user_id: number
      profile_photo: string | null
    }>
    const tenant = tenants[0]

    if (!tenant) {
      res.status(404).json({
        status: 'error',
        message: 'Tenant tidak ditemukan atau akun tidak aktif.',
      })
      return
    }

    let savedPhoto = tenant.profile_photo

    if (profilePhoto.startsWith('data:image/')) {
      const uploaded = await saveImageDataUrl(profilePhoto, `tenant-${tenantId}`)
      savedPhoto = uploaded.url

      if (tenant.profile_photo && tenant.profile_photo.startsWith('https://')) {
        const oldPublicId = extractPublicIdFromUrl(tenant.profile_photo)
        if (oldPublicId) {
          try {
            await cloudinary.uploader.destroy(oldPublicId)
          } catch (err) {
            console.error('Failed to delete old tenant profile photo from Cloudinary:', err)
          }
        }
      } 
      else if (tenant.profile_photo && tenant.profile_photo.startsWith('/uploads/')) {
        const oldFilePath = path.join(process.cwd(), tenant.profile_photo)
        try {
          await unlink(oldFilePath)
        } catch (err) {
        }
      }
    } else if (profilePhoto && profilePhoto !== (tenant.profile_photo || '')) {
      res.status(400).json({
        status: 'error',
        message: 'Foto profil tidak valid. Pilih file gambar dari perangkat.',
      })
      return
    }

    await db.execute(
      `UPDATE tenants
       SET tenant_name = ?, phone = ?, bank_name = ?, bank_account = ?, profile_photo = ?
       WHERE tenant_id = ?`,
      [
        tenantName,
        phone || null,
        bankName || null,
        bankAccount || null,
        savedPhoto,
        tenantId,
      ],
    )

    const [updatedRows] = await db.execute(
      `SELECT
        t.tenant_id,
        t.tenant_name,
        t.phone,
        t.bank_name,
        t.bank_account,
        t.profile_photo,
        t.status,
        u.username
       FROM tenants t
       INNER JOIN users u ON u.user_id = t.user_id
       WHERE t.tenant_id = ? AND u.role = 'tenant' AND u.status = 'active'
       LIMIT 1`,
      [tenantId],
    )

    const updatedTenants = updatedRows as Array<{
      tenant_id: number
      tenant_name: string
      phone: string | null
      bank_name: string | null
      bank_account: string | null
      profile_photo: string | null
      status: string
      username: string
    }>

    res.json({
      status: 'success',
      message: 'Profil tenant berhasil diperbarui.',
      data: updatedTenants[0],
    })
  } catch (error) {
    console.error('Failed to update tenant profile:', error)
    res.status(500).json({
      status: 'error',
      message: 'Gagal menyimpan perubahan profil tenant.',
    })
  }
})

app.get('/api/tenant/menus', requireTenant, async (_req, res) => {
  try {
    const tenantId = res.locals.tenant.tenantId

    const [rows] = await db.execute(
      `SELECT
        menu_id,
        tenant_id,
        menu_name,
        description,
        price,
        quantity,
        status,
        category,
        photo
      FROM menus
      WHERE tenant_id = ?
      ORDER BY menu_id DESC`,
      [tenantId],
    )

    res.json({
      status: 'success',
      data: rows,
    })
  } catch (error) {
    console.error('Failed to fetch tenant menus:', error)

    res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil daftar menu.',
    })
  }
})

app.post('/api/tenant/menus', requireTenant, async (req, res) => {
  try {
    const tenantId = res.locals.tenant.tenantId
    const menuName =
      typeof req.body?.menu_name === 'string'
        ? req.body.menu_name.trim()
        : ''
    const description =
      typeof req.body?.description === 'string'
        ? req.body.description.trim()
        : ''
    const category = normalizeMenuCategory(req.body?.category)
    const price = Number(req.body?.price)
    const quantity = Number(req.body?.quantity)
    const photo =
      typeof req.body?.photo === 'string' ? req.body.photo : ''

    if (!menuName || menuName.length > 150) {
      res.status(400).json({
        status: 'error',
        message: 'Nama menu wajib diisi (maksimal 150 karakter).',
      })
      return
    }

    if (!Number.isFinite(price) || price <= 0) {
      res.status(400).json({
        status: 'error',
        message: 'Harga harus lebih besar dari nol.',
      })
      return
    }

    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      res.status(400).json({
        status: 'error',
        message: 'Stok harus berupa bilangan bulat minimal nol.',
      })
      return
    }

    if (description.length > 1000) {
      res.status(400).json({
        status: 'error',
        message: 'Deskripsi maksimal 1000 karakter.',
      })
      return
    }

    let savedPhoto: string | null = null
    if (photo) {
      const uploaded = await saveImageDataUrl(photo, `menu-${tenantId}`)
      savedPhoto = uploaded.url
    }

    const [result] = await db.execute(
      `INSERT INTO menus
        (tenant_id, menu_name, description, category, price, quantity, status, photo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        menuName,
        description || null,
        category,
        price,
        quantity,
        quantity > 0 ? 'available' : 'unavailable',
        savedPhoto,
      ],
    )

    res.status(201).json({
      status: 'success',
      message: 'Menu berhasil ditambahkan.',
      data: {
        menuId: (result as { insertId: number }).insertId,
        tenantId,
        menuName,
      },
    })
  } catch (error) {
    console.error('Failed to create tenant menu:', error)

    res.status(error instanceof ImageUploadError ? error.statusCode : 500).json({
      status: 'error',
      message: error instanceof ImageUploadError ? error.message : 'Gagal menambahkan menu.',
    })
  }
})

app.put('/api/tenant/menus/:menuId', requireTenant, async (req, res) => {
  let uploadedPhotoPath: string | null = null
  try {
    const tenantId = res.locals.tenant.tenantId
    const menuId = Number(req.params.menuId)

    if (!Number.isSafeInteger(menuId) || menuId < 1) {
      res.status(400).json({
        status: 'error',
        message: 'ID menu tidak valid.',
      })
      return
    }

    const menuName =
      typeof req.body?.menu_name === 'string'
        ? req.body.menu_name.trim()
        : ''
    const description =
      typeof req.body?.description === 'string'
        ? req.body.description.trim()
        : ''
    const category = normalizeMenuCategory(req.body?.category)
    const price = Number(req.body?.price)
    const quantity = Number(req.body?.quantity)
    const photo =
      typeof req.body?.photo === 'string' ? req.body.photo : ''

    if (!menuName || menuName.length > 150) {
      res.status(400).json({
        status: 'error',
        message: 'Nama menu wajib diisi (maksimal 150 karakter).',
      })
      return
    }

    if (!Number.isFinite(price) || price <= 0) {
      res.status(400).json({
        status: 'error',
        message: 'Harga harus lebih besar dari nol.',
      })
      return
    }

    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      res.status(400).json({
        status: 'error',
        message: 'Stok harus berupa bilangan bulat minimal nol.',
      })
      return
    }

    if (description.length > 1000) {
      res.status(400).json({
        status: 'error',
        message: 'Deskripsi maksimal 1000 karakter.',
      })
      return
    }

    const [existingRows] = await db.execute(
      `SELECT photo
       FROM menus
       WHERE menu_id = ? AND tenant_id = ?
       LIMIT 1`,
      [menuId, tenantId],
    )
    const existingMenu = (existingRows as Array<{ photo: string | null }>)[0]
    if (!existingMenu) {
      res.status(404).json({
        status: 'error',
        message: 'Menu tidak ditemukan atau bukan milik tenant ini.',
      })
      return
    }

    let savedPhoto: string | null
    if (!photo) {
      savedPhoto = null
    } else if (photo.startsWith('data:image/')) {
      const uploaded = await saveImageDataUrl(photo, `menu-${tenantId}`)
      savedPhoto = uploaded.url
      uploadedPhotoPath = uploaded.filePath
    } else if (
      photo === existingMenu.photo &&
      (photo.startsWith('/uploads/') || photo.startsWith('https://') || photo.startsWith('http://'))
    ) {
      savedPhoto = existingMenu.photo
    } else {
      throw new ImageUploadError('Pilih foto menu dari perangkat yang valid.', 400)
    }

    await db.execute(
      `UPDATE menus
       SET menu_name = ?,
           description = ?,
           category = ?,
           price = ?,
           quantity = ?,
           status = ?,
           photo = ?
       WHERE menu_id = ? AND tenant_id = ?`,
      [
        menuName,
        description || null,
        category,
        price,
        quantity,
        quantity > 0 ? 'available' : 'unavailable',
        savedPhoto,
        menuId,
        tenantId,
      ],
    )
    uploadedPhotoPath = null

    res.json({
      status: 'success',
      message: 'Menu berhasil diperbarui.',
    })
  } catch (error) {
    console.error('Failed to update tenant menu:', error)
    if (uploadedPhotoPath) {
      try {
        await unlink(uploadedPhotoPath)
      } catch (cleanupError) {
        console.error('Failed to remove incomplete menu photo:', cleanupError)
      }
    }

    res.status(error instanceof ImageUploadError ? error.statusCode : 500).json({
      status: 'error',
      message: error instanceof ImageUploadError ? error.message : 'Gagal memperbarui menu.',
    })
  }
})

app.delete(
  '/api/tenant/menus/:menuId',
  requireTenant,
  async (req, res) => {
    try {
      const tenantId = res.locals.tenant.tenantId
      const menuId = Number(req.params.menuId)

      if (!Number.isSafeInteger(menuId) || menuId < 1) {
        res.status(400).json({
          status: 'error',
          message: 'ID menu tidak valid.',
        })
        return
      }

      const [result] = await db.execute(
        `DELETE FROM menus
         WHERE menu_id = ? AND tenant_id = ?`,
        [menuId, tenantId],
      )

      if ((result as { affectedRows: number }).affectedRows === 0) {
        res.status(404).json({
          status: 'error',
          message: 'Menu tidak ditemukan atau bukan milik tenant ini.',
        })
        return
      }

      res.json({
        status: 'success',
        message: 'Menu berhasil dihapus.',
      })
    } catch (error) {
      console.error('Failed to delete tenant menu:', error)

      res.status(500).json({
        status: 'error',
        message: 'Gagal menghapus menu.',
      })
    }
  },
)

app.get('/api/tenant/orders', requireTenant, async (_req, res) => {
  try {
    const tenantId = res.locals.tenant.tenantId

    const [rows] = await db.execute(
      `SELECT
        o.order_id,
        o.order_number,
        o.order_date,
        o.total_amount,
        o.order_status,
        c.name AS customer_name,
        c.phone AS customer_phone,
        o.queue_number,
        DATE_FORMAT(o.scheduled_for, '%H:%i') AS scheduled_time,
        p.payment_status,
        oi.order_item_id,
        oi.menu_id,
        m.menu_name,
        oi.quantity,
        oi.price,
        oi.subtotal
      FROM orders o
      INNER JOIN customers c
        ON c.customer_id = o.customer_id
      LEFT JOIN payments p
        ON p.order_id = o.order_id
      LEFT JOIN order_items oi
        ON oi.order_id = o.order_id
      LEFT JOIN menus m
        ON m.menu_id = oi.menu_id
      WHERE o.tenant_id = ?
      ORDER BY
        (o.order_status = 'completed') ASC,
        CASE
          WHEN o.order_status = 'completed' THEN 0
          ELSE UNIX_TIMESTAMP(COALESCE(o.scheduled_for, o.order_date))
        END ASC,
        o.order_date DESC,
        o.order_id DESC`,
      [tenantId],
    )

    type OrderRow = {
      order_id: number
      order_number: string
      order_date: string | Date
      total_amount: number | string
      order_status: string
      customer_name: string
      customer_phone: string
      queue_number: string | null
      scheduled_time: string | null
      payment_status: string | null
      order_item_id: number | null
      menu_id: number | null
      menu_name: string | null
      quantity: number | null
      price: number | string | null
      subtotal: number | string | null
    }

    const orderRows = rows as OrderRow[]
    const orderMap = new Map<number, {
      orderId: number
      orderNumber: string
      orderDate: string | Date
      totalAmount: number
      status: string
      queueNumber: string | null
      scheduledTime: string | null
      paymentStatus: string
      customer: {
        name: string
        phone: string
      }
      items: Array<{
        orderItemId: number
        menuId: number
        menuName: string
        quantity: number
        price: number
        subtotal: number
      }>
    }>()

    for (const row of orderRows) {
      if (!orderMap.has(row.order_id)) {
        orderMap.set(row.order_id, {
          orderId: row.order_id,
          orderNumber: row.order_number,
          orderDate: row.order_date,
          totalAmount: Number(row.total_amount),
          status: row.order_status,
          queueNumber: row.queue_number,
          scheduledTime: row.scheduled_time,
          paymentStatus: row.payment_status ?? 'pending',
          customer: {
            name: row.customer_name,
            phone: row.customer_phone,
          },
          items: [],
        })
      }

      if (
        row.order_item_id !== null &&
        row.menu_id !== null &&
        row.menu_name !== null
      ) {
        orderMap.get(row.order_id)!.items.push({
          orderItemId: row.order_item_id,
          menuId: row.menu_id,
          menuName: row.menu_name,
          quantity: Number(row.quantity),
          price: Number(row.price),
          subtotal: Number(row.subtotal),
        })
      }
    }

    res.json({
      status: 'success',
      data: Array.from(orderMap.values()),
    })
  } catch (error) {
    console.error('Failed to load tenant orders:', error)

    res.status(500).json({
      status: 'error',
      message: 'Gagal memuat daftar pesanan.',
    })
  }
})

app.patch(
  '/api/tenant/orders/:orderId/status',
  requireTenant,
  async (req, res) => {
    try {
      const tenantId = res.locals.tenant.tenantId
      const orderId = Number(req.params.orderId)
      const newStatus = req.body?.status

      if (!Number.isSafeInteger(orderId) || orderId < 1) {
        res.status(400).json({
          status: 'error',
          message: 'ID pesanan tidak valid.',
        })
        return
      }

      const allowedStatuses = ['pending', 'preparing', 'completed']

      if (
        typeof newStatus !== 'string' ||
        !allowedStatuses.includes(newStatus)
      ) {
        res.status(400).json({
          status: 'error',
          message: 'Status pesanan tidak valid.',
        })
        return
      }

      const [rows] = await db.execute(
        `SELECT order_status
         FROM orders
         WHERE order_id = ? AND tenant_id = ?
         LIMIT 1`,
        [orderId, tenantId],
      )

      const orders = rows as Array<{ order_status: string }>

      if (orders.length === 0) {
        res.status(404).json({
          status: 'error',
          message: 'Pesanan tidak ditemukan.',
        })
        return
      }

      const currentStatus = orders[0].order_status

      const allowedTransitions: Record<string, string[]> = {
        pending: ['preparing'],
        preparing: ['completed'],
        completed: [],
      }

      if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
        res.status(409).json({
          status: 'error',
          message:
            currentStatus === 'completed'
              ? 'Pesanan yang sudah selesai tidak dapat diubah lagi.'
              : 'Perubahan status pesanan tidak diperbolehkan.',
        })
        return
      }

      await db.execute(
        `UPDATE orders
         SET order_status = ?
         WHERE order_id = ? AND tenant_id = ?`,
        [newStatus, orderId, tenantId],
      )

      res.json({
        status: 'success',
        message: 'Status pesanan berhasil diperbarui.',
        data: {
          orderId,
          previousStatus: currentStatus,
          status: newStatus,
        },
      })
    } catch (error) {
      console.error('Failed to update tenant order status:', error)

      res.status(500).json({
        status: 'error',
        message: 'Gagal memperbarui status pesanan.',
      })
    }
  },
)

app.get('/api/tenant/income', requireTenant, async (_req, res) => {
  try {
    const tenantId = res.locals.tenant.tenantId

    const [incomeRows] = await db.execute(
      `SELECT
        COALESCE(SUM(p.amount), 0) AS total_income,
        COUNT(DISTINCT o.order_id) AS paid_orders
      FROM orders o
      INNER JOIN payments p ON p.order_id = o.order_id
      WHERE o.tenant_id = ?
        AND p.payment_status = 'paid'`,
      [tenantId],
    )

    const [transferRows] = await db.execute(
      `SELECT
        COALESCE(SUM(amount), 0) AS total_transferred
      FROM transfers
      WHERE tenant_id = ?
        AND status = 'completed'`,
      [tenantId],
    )

    const [historyRows] = await db.execute(
      `SELECT
        transfer_date,
        amount,
        bank_name,
        bank_account,
        status,
        reference_number
      FROM transfers
      WHERE tenant_id = ?
      ORDER BY transfer_date DESC`,
      [tenantId],
    )

    const income = (
      incomeRows as Array<{
        total_income: number | string
        paid_orders: number | string
      }>
    )[0]

    const transfer = (
      transferRows as Array<{
        total_transferred: number | string
      }>
    )[0]

    const totalIncome = Number(income.total_income)
    const paidOrders = Number(income.paid_orders)
    const totalTransferred = Number(transfer.total_transferred)

    const outstandingBalance = Math.max(
      0,
      totalIncome - totalTransferred,
    )

    res.json({
      status: 'success',
      data: {
        totalIncome,
        paidOrders,
        totalTransferred,
        outstandingBalance,
        transfers: historyRows,
      },
    })
  } catch (error) {
    console.error('Failed to fetch tenant income:', error)

    res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data pendapatan tenant.',
    })
  }
})

app.get(
  '/api/tenant/rental-payments',
  requireTenant,
  async (_req, res) => {
    try {
      const tenantId = res.locals.tenant.tenantId

      const [rows] = await db.execute(
        `SELECT
          rental_id,
          tenant_id,
          rental_period,
          due_date,
          amount,
          payment_date,
          payment_proof,
          status
        FROM rental_payments
        WHERE tenant_id = ?
        ORDER BY rental_period DESC, rental_id DESC`,
        [tenantId],
      )

      res.json({
        status: 'success',
        data: rows,
      })
    } catch (error) {
      console.error(
        'Failed to fetch tenant rental payments:',
        error,
      )

      res.status(500).json({
        status: 'error',
        message: 'Gagal mengambil riwayat pembayaran sewa.',
      })
    }
  },
)

app.post(
  '/api/tenant/rental-payments/:rentalId/proof',
  requireTenant,
  async (req, res) => {
    let uploadedFilePath: string | null = null
    let uploadedPublicId: string | null = null

    try {
      const rentalId = Number(req.params.rentalId)
      if (!Number.isSafeInteger(rentalId) || rentalId < 1) {
        res.status(400).json({
          status: 'error',
          message: 'ID pembayaran sewa tidak valid.',
        })
        return
      }

      const proofDataUrl =
        typeof req.body?.payment_proof === 'string' ? req.body.payment_proof : ''

      const tenantId = res.locals.tenant.tenantId
      const [rows] = await db.execute(
        `SELECT status
         FROM rental_payments
         WHERE rental_id = ? AND tenant_id = ?
         LIMIT 1`,
        [rentalId, tenantId],
      )
      const payment = (rows as Array<{ status: string | null }>)[0]
      if (!payment) {
        res.status(404).json({
          status: 'error',
          message: 'Tagihan sewa tidak ditemukan.',
        })
        return
      }
      if (payment.status?.toLowerCase() === 'paid') {
        res.status(409).json({
          status: 'error',
          message: 'Bukti tidak dapat diubah karena pembayaran sudah dikonfirmasi.',
        })
        return
      }
      if (!['pending', 'overdue'].includes((payment.status || '').toLowerCase())) {
        res.status(409).json({
          status: 'error',
          message: 'Bukti hanya dapat dikirim untuk tagihan pending atau terlambat.',
        })
        return
      }

      const uploaded = await saveImageDataUrl(
        proofDataUrl,
        `rental-proof-${tenantId}-${rentalId}`,
      )
      uploadedFilePath = uploaded.filePath
      uploadedPublicId = uploaded.publicId

      const [updateResult] = await db.execute(
        `UPDATE rental_payments
         SET payment_proof = ?
         WHERE rental_id = ?
           AND tenant_id = ?
           AND LOWER(status) IN ('pending', 'overdue')`,
        [uploaded.url, rentalId, tenantId],
      )
      if ((updateResult as { affectedRows: number }).affectedRows === 0) {
        if (uploadedFilePath) {
          try { await unlink(uploadedFilePath) } catch {}
        }
        if (uploadedPublicId) {
          try { await cloudinary.uploader.destroy(uploadedPublicId) } catch {}
        }

        res.status(409).json({
          status: 'error',
          message: 'Bukti tidak tersimpan karena tagihan telah berubah. Muat ulang data dan coba lagi.',
        })
        return
      }

      res.json({
        status: 'success',
        message: 'Bukti pembayaran berhasil dikirim kepada admin.',
        data: { payment_proof: uploaded.url },
      })
    } catch (error) {
      console.error('Failed to upload tenant rental payment proof:', error)
      if (uploadedFilePath) {
        try { await unlink(uploadedFilePath) } catch {}
      }
      if (uploadedPublicId) {
        try { await cloudinary.uploader.destroy(uploadedPublicId) } catch {}
      }
      if (error instanceof ImageUploadError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        })
        return
      }
      res.status(500).json({
        status: 'error',
        message: 'Bukti pembayaran gagal diunggah.',
      })
    }
  },
)

// DEMO ONLY: this public endpoint resets a password without proving account ownership.
app.post('/api/auth/reset-password-demo', async (req, res) => {
  const username =
    typeof req.body?.username === 'string' ? req.body.username.trim() : ''
  const newPassword =
    typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''

  if (!username || username.length > 100) {
    res.status(400).json({
      status: 'error',
      message: 'Username wajib diisi dan maksimal 100 karakter.',
    })
    return
  }
  if (newPassword.length < 8 || newPassword.length > 72) {
    res.status(400).json({
      status: 'error',
      message: 'Sandi baru harus terdiri dari 8 sampai 72 karakter.',
    })
    return
  }

  try {
    const [rows] = await db.execute(
      `SELECT user_id
       FROM users
       WHERE username = ?
         AND status = 'active'
         AND role IN ('admin', 'tenant')
       LIMIT 1`,
      [username],
    )
    const user = (rows as Array<{ user_id: number }>)[0]
    if (!user) {
      res.status(404).json({
        status: 'error',
        message: 'Akun aktif dengan username tersebut tidak ditemukan.',
      })
      return
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await db.execute(
      `UPDATE users
       SET password = ?
       WHERE user_id = ?`,
      [passwordHash, user.user_id],
    )

    res.json({
      status: 'success',
      message: 'Sandi berhasil dibuat ulang.',
    })
  } catch (error) {
    console.error('Demo password reset failed:', error)
    res.status(500).json({
      status: 'error',
      message: 'Sandi gagal diperbarui. Silakan coba lagi.',
    })
  }
})

// Filter rating, status, search, etc
app.get('/api/tenants', async (req, res) => {
  try {
    const q = queryString(req.query.q, 100)
    const category = queryString(req.query.category, 50)
    const sort = queryString(req.query.sort, 20)
    const openOnly = req.query.openOnly === '1' || req.query.openOnly === 'true'
    const minRating = Number(req.query.minRating)

    const where: string[] = ["LOWER(t.status) = 'active'"]
    const params: Array<string | number> = []

    if (q) {
      const like = `%${escapeLike(q)}%`
      where.push(`(
        t.tenant_name LIKE ?
        OR COALESCE(t.category, '') LIKE ?
        OR EXISTS (
          SELECT 1 FROM menus mq
          WHERE mq.tenant_id = t.tenant_id
            AND mq.status = 'available'
            AND (mq.menu_name LIKE ? OR COALESCE(mq.description, '') LIKE ?)
        )
      )`)
      params.push(like, like, like, like)
    }
    if (category) {
      where.push(`(
        t.category = ?
        OR EXISTS (
          SELECT 1 FROM menus mc
          WHERE mc.tenant_id = t.tenant_id
            AND mc.status = 'available'
            AND mc.category = ?
        )
      )`)
      params.push(category, category)
    }
    if (openOnly) {
      where.push('t.is_open = 1')
    }
    if (Number.isFinite(minRating) && minRating > 0 && minRating <= 5) {
      where.push('COALESCE(r.rating_avg, 0) >= ?')
      params.push(minRating)
    }

    const orderBy =
      sort === 'rating'
        ? 'COALESCE(r.rating_avg, 0) DESC, COALESCE(r.rating_count, 0) DESC, t.tenant_id ASC'
        : sort === 'name'
          ? 't.tenant_name ASC'
          : 't.tenant_id ASC'

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT
         t.tenant_id,
         t.tenant_name,
         t.phone,
         t.profile_photo,
         t.status,
         t.is_open,
         t.category,
         COALESCE(r.rating_avg, 0) AS rating_avg,
         COALESCE(r.rating_count, 0) AS rating_count
       FROM tenants t
       LEFT JOIN (
         SELECT tenant_id, AVG(rating) AS rating_avg, COUNT(*) AS rating_count
         FROM reviews
         GROUP BY tenant_id
       ) r ON r.tenant_id = t.tenant_id
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}`,
      params,
    )

    res.json({
      status: 'success',
      data: rows.map((row) => ({
        tenant_id: Number(row.tenant_id),
        tenant_name: row.tenant_name,
        phone: row.phone,
        profile_photo: row.profile_photo,
        status: row.status,
        is_open: Number(row.is_open) === 1,
        category: row.category,
        rating_avg: Number(row.rating_avg),
        rating_count: Number(row.rating_count),
      })),
    })
  } catch (error) {
    console.error('Failed to fetch tenants:', error)
    sendError(res, 500, 'Gagal mengambil daftar tenant.')
  }
})

// Filter By Categories
app.get('/api/categories', async (_req, res) => {
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT category FROM (
         SELECT t.category AS category FROM tenants t
         WHERE LOWER(t.status) = 'active' AND t.category IS NOT NULL
         UNION
         SELECT m.category AS category FROM menus m
         INNER JOIN tenants t2 ON t2.tenant_id = m.tenant_id
         WHERE LOWER(t2.status) = 'active' AND m.category IS NOT NULL
       ) c
       ORDER BY category ASC`,
    )
    res.json({
      status: 'success',
      data: rows.map((row) => String(row.category)),
    })
  } catch (error) {
    console.error('Failed to fetch categories:', error)
    sendError(res, 500, 'Gagal mengambil kategori.')
  }
})

// Get Menu
app.get('/api/tenants/:tenantId/menus', async (req, res) => {
  try {
    const tenantId = Number(req.params.tenantId)
    if (!Number.isInteger(tenantId) || tenantId < 1) {
      sendError(res, 400, 'Invalid tenant ID')
      return
    }
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT
         m.menu_id,
         m.tenant_id,
         m.menu_name,
         m.description,
         m.category,
         m.price,
         m.quantity,
         m.status,
         m.photo,
         ${MENU_STATS_COLUMNS}
       FROM menus m
       ${MENU_RATING_JOIN}
       ${MENU_ORDER_COUNT_JOIN}
       WHERE m.tenant_id = ?
         AND m.status = 'available'
         AND m.quantity > 0
       ORDER BY m.menu_id ASC`,
      [tenantId],
    )
    res.json({
      status: 'success',
      data: rows.map((row) => ({
        ...row,
        rating_avg: Number(row.rating_avg),
        rating_count: Number(row.rating_count),
        order_count: Number(row.order_count),
      })),
    })
  } catch (error) {
    console.error('Failed to fetch menus:', error)
    sendError(res, 500, 'Failed to fetch menus')
  }
})

// Get Rating Summary
app.get('/api/tenants/:tenantId/ratings', async (req, res) => {
  try {
    const tenantId = Number(req.params.tenantId)
    if (!Number.isInteger(tenantId) || tenantId < 1) {
      sendError(res, 400, 'ID tenant tidak valid.')
      return
    }
    const [tenantRows] = await db.query<RowDataPacket[]>(
      'SELECT tenant_id, tenant_name FROM tenants WHERE tenant_id = ? AND LOWER(status) = ? LIMIT 1',
      [tenantId, 'active'],
    )
    if (!tenantRows[0]) {
      sendError(res, 404, 'Tenant tidak ditemukan.')
      return
    }
    const [summaryRows] = await db.query<RowDataPacket[]>(
      'SELECT COALESCE(AVG(rating), 0) AS rating_avg, COUNT(*) AS rating_count FROM reviews WHERE tenant_id = ?',
      [tenantId],
    )
    const [menuRows] = await db.query<RowDataPacket[]>(
      `SELECT
         m.menu_id,
         m.menu_name,
         m.category,
         m.status,
         ${MENU_STATS_COLUMNS}
       FROM menus m
       ${MENU_RATING_JOIN}
       ${MENU_ORDER_COUNT_JOIN}
       WHERE m.tenant_id = ?
       ORDER BY COALESCE(oc.order_count, 0) DESC, m.menu_id ASC`,
      [tenantId],
    )
    const [recentRows] = await db.query<RowDataPacket[]>(
      `SELECT
         r.review_id, r.menu_id, m.menu_name, r.rating, r.tags, r.comment,
         r.customer_name,
         DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i') AS created_at_text
       FROM reviews r
       INNER JOIN menus m ON m.menu_id = r.menu_id
       WHERE r.tenant_id = ?
       ORDER BY r.created_at DESC, r.review_id DESC
       LIMIT 20`,
      [tenantId],
    )
    res.json({
      status: 'success',
      data: {
        tenantId,
        tenantName: tenantRows[0].tenant_name,
        ratingAvg: Number(summaryRows[0].rating_avg),
        ratingCount: Number(summaryRows[0].rating_count),
        menus: menuRows.map((row) => ({
          menuId: Number(row.menu_id),
          menuName: row.menu_name,
          category: row.category,
          status: row.status,
          ratingAvg: Number(row.rating_avg),
          ratingCount: Number(row.rating_count),
          orderCount: Number(row.order_count),
        })),
        recentReviews: recentRows.map(mapReview),
      },
    })
  } catch (error) {
    console.error('Failed to fetch tenant ratings:', error)
    sendError(res, 500, 'Gagal mengambil rating tenant.')
  }
})

// Get Rating Each Menu
app.get('/api/menus/:menuId/reviews', async (req, res) => {
  try {
    const menuId = Number(req.params.menuId)
    if (!Number.isInteger(menuId) || menuId < 1) {
      sendError(res, 400, 'ID menu tidak valid.')
      return
    }
    const [menuRows] = await db.query<RowDataPacket[]>(
      `SELECT
         m.menu_id, m.menu_name,
         ${MENU_STATS_COLUMNS}
       FROM menus m
       ${MENU_RATING_JOIN}
       ${MENU_ORDER_COUNT_JOIN}
       WHERE m.menu_id = ?
       LIMIT 1`,
      [menuId],
    )
    const menu = menuRows[0]
    if (!menu) {
      sendError(res, 404, 'Menu tidak ditemukan.')
      return
    }
    const [reviewRows] = await db.query<RowDataPacket[]>(
      `SELECT
         r.review_id, r.rating, r.tags, r.comment, r.customer_name,
         DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i') AS created_at_text
       FROM reviews r
       WHERE r.menu_id = ?
       ORDER BY r.created_at DESC, r.review_id DESC
       LIMIT 50`,
      [menuId],
    )
    res.json({
      status: 'success',
      data: {
        menuId: Number(menu.menu_id),
        menuName: menu.menu_name,
        ratingAvg: Number(menu.rating_avg),
        ratingCount: Number(menu.rating_count),
        orderCount: Number(menu.order_count),
        reviews: reviewRows.map(mapReview),
      },
    })
  } catch (error) {
    console.error('Failed to fetch menu reviews:', error)
    sendError(res, 500, 'Gagal mengambil ulasan menu.')
  }
})

// Get OTP
app.post('/api/customer/otp/request', async (req, res) => {
  try {
    const phone = normalizePhone(
      typeof req.body?.phone === 'string' ? req.body.phone : '',
    )
    if (!PHONE_PATTERN.test(phone)) {
      sendError(res, 400, 'Nomor telepon tidak valid. Gunakan 8-15 digit angka.')
      return
    }
    const secret = getJwtSecret()
    if (!secret) {
      sendError(res, 500, 'Konfigurasi autentikasi belum siap.')
      return
    }
    const [known] = await db.query<RowDataPacket[]>(
      `SELECT c.customer_id FROM customers c WHERE ${phoneSql('c.phone')} = ? LIMIT 1`,
      [phone],
    )
    if (known.length === 0) {
      sendError(res, 404, 'Nomor telepon ini belum pernah digunakan untuk memesan.')
      return
    }
    const [recent] = await db.query<RowDataPacket[]>(
      'SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age FROM customer_otps WHERE phone = ?',
      [phone],
    )
    if (recent[0] && Number(recent[0].age) < OTP_RESEND_SECONDS) {
      const wait = OTP_RESEND_SECONDS - Number(recent[0].age)
      sendError(res, 429, `Tunggu ${wait} detik sebelum meminta kode baru.`)
      return
    }
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
    await db.execute(
      `INSERT INTO customer_otps (phone, code_hash, expires_at, attempts, created_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ${OTP_TTL_MINUTES} MINUTE), 0, NOW())
       ON DUPLICATE KEY UPDATE
         code_hash = VALUES(code_hash),
         expires_at = VALUES(expires_at),
         attempts = 0,
         created_at = VALUES(created_at)`,
      [phone, hashOtp(phone, code, secret)],
    )
    res.json({
      status: 'success',
      message: 'Kode OTP simulasi dibuat.',
      data: {
        simulated: true,
        expiresInSeconds: OTP_TTL_MINUTES * 60,
        ...(OTP_DEMO_MODE ? { demoCode: code } : {}),
      },
    })
  } catch (error) {
    console.error('OTP request failed:', error)
    sendError(res, 500, 'Kode OTP gagal dibuat. Silakan coba lagi.')
  }
})

// Verify OTP
app.post('/api/customer/otp/verify', async (req, res) => {
  try {
    const phone = normalizePhone(
      typeof req.body?.phone === 'string' ? req.body.phone : '',
    )
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
    if (!PHONE_PATTERN.test(phone) || !/^\d{6}$/.test(code)) {
      sendError(res, 400, 'Nomor telepon atau kode OTP tidak valid.')
      return
    }
    const secret = getJwtSecret()
    if (!secret) {
      sendError(res, 500, 'Konfigurasi autentikasi belum siap.')
      return
    }
    const [otpRows] = await db.query<RowDataPacket[]>(
      'SELECT code_hash, attempts, (expires_at > NOW()) AS still_valid FROM customer_otps WHERE phone = ?',
      [phone],
    )
    const otp = otpRows[0]
    if (!otp || Number(otp.still_valid) !== 1) {
      sendError(res, 400, 'Kode OTP sudah kedaluwarsa. Minta kode baru.')
      return
    }
    if (Number(otp.attempts) >= OTP_MAX_ATTEMPTS) {
      sendError(res, 429, 'Terlalu banyak percobaan. Minta kode baru.')
      return
    }
    const expected = Buffer.from(String(otp.code_hash), 'hex')
    const actual = Buffer.from(hashOtp(phone, code, secret), 'hex')
    const matches =
      expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
    if (!matches) {
      await db.execute(
        'UPDATE customer_otps SET attempts = attempts + 1 WHERE phone = ?',
        [phone],
      )
      sendError(res, 400, 'Kode OTP salah.')
      return
    }
    await db.execute('DELETE FROM customer_otps WHERE phone = ?', [phone])
    const [customerRows] = await db.query<RowDataPacket[]>(
      `SELECT c.name FROM customers c
       WHERE ${phoneSql('c.phone')} = ?
       ORDER BY c.customer_id DESC
       LIMIT 1`,
      [phone],
    )
    const name = customerRows[0] ? String(customerRows[0].name) : ''
    const token = jwt.sign({ role: 'customer', phone, name }, secret, {
      expiresIn: '2h',
    })
    res.json({
      status: 'success',
      message: 'Berhasil masuk.',
      data: { token, customer: { name, phone } },
    })
  } catch (error) {
    console.error('OTP verify failed:', error)
    sendError(res, 500, 'Verifikasi OTP gagal. Silakan coba lagi.')
  }
})

// Get Order History
app.get('/api/customer/orders', requireCustomer, async (_req, res) => {
  try {
    const phone = String(res.locals.customer.phone)
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT
         o.order_id,
         o.order_number,
         o.queue_number,
         DATE_FORMAT(o.order_date, '%Y-%m-%d %H:%i') AS order_date_text,
         DATE_FORMAT(o.scheduled_for, '%H:%i') AS scheduled_time,
         o.total_amount,
         o.order_status,
         t.tenant_id,
         t.tenant_name,
         p.payment_status,
         oi.order_item_id,
         oi.menu_id,
         m.menu_name,
         oi.quantity,
         oi.price,
         oi.subtotal,
         r.review_id,
         r.rating,
         r.tags,
         r.comment
       FROM orders o
       INNER JOIN customers c ON c.customer_id = o.customer_id
       INNER JOIN tenants t ON t.tenant_id = o.tenant_id
       LEFT JOIN payments p ON p.order_id = o.order_id
       LEFT JOIN order_items oi ON oi.order_id = o.order_id
       LEFT JOIN menus m ON m.menu_id = oi.menu_id
       LEFT JOIN reviews r ON r.order_item_id = oi.order_item_id
       WHERE ${phoneSql('c.phone')} = ?
       ORDER BY o.order_date DESC, o.order_id DESC, oi.order_item_id ASC
       LIMIT 500`,
      [phone],
    )

    type HistoryOrder = {
      orderId: number
      orderNumber: string
      queueNumber: string | null
      orderDate: string
      scheduledTime: string | null
      totalAmount: number
      status: string
      paymentStatus: string
      tenantId: number
      tenantName: string
      items: Array<{
        orderItemId: number
        menuId: number
        menuName: string
        quantity: number
        price: number
        subtotal: number
        canReview: boolean
        review: { rating: number; tags: string[]; comment: string } | null
      }>
    }
    const orderMap = new Map<number, HistoryOrder>()
    for (const row of rows) {
      const orderId = Number(row.order_id)
      let order = orderMap.get(orderId)
      if (!order) {
        order = {
          orderId,
          orderNumber: String(row.order_number),
          queueNumber: row.queue_number ? String(row.queue_number) : null,
          orderDate: String(row.order_date_text),
          scheduledTime: row.scheduled_time ? String(row.scheduled_time) : null,
          totalAmount: Number(row.total_amount),
          status: String(row.order_status),
          paymentStatus: row.payment_status ? String(row.payment_status) : 'pending',
          tenantId: Number(row.tenant_id),
          tenantName: String(row.tenant_name),
          items: [],
        }
        orderMap.set(orderId, order)
      }
      if (row.order_item_id !== null && row.menu_id !== null) {
        const reviewed = row.review_id !== null
        order.items.push({
          orderItemId: Number(row.order_item_id),
          menuId: Number(row.menu_id),
          menuName: String(row.menu_name),
          quantity: Number(row.quantity),
          price: Number(row.price),
          subtotal: Number(row.subtotal),
          canReview:
            !reviewed &&
            order.status.toLowerCase() === 'completed' &&
            order.paymentStatus.toLowerCase() === 'paid',
          review: reviewed
            ? {
                rating: Number(row.rating),
                tags: parseTags(row.tags),
                comment: row.comment ? String(row.comment) : '',
              }
            : null,
        })
      }
    }
    res.json({ status: 'success', data: Array.from(orderMap.values()) })
  } catch (error) {
    console.error('Failed to load customer orders:', error)
    sendError(res, 500, 'Gagal memuat riwayat pesanan.')
  }
})

// Reviews
app.post('/api/customer/reviews', requireCustomer, async (req, res) => {
  try {
    const phone = String(res.locals.customer.phone)
    const orderItemId = Number(req.body?.orderItemId)
    const rating = Number(req.body?.rating)
    const comment =
      typeof req.body?.comment === 'string' ? req.body.comment.trim() : ''
    const rawTags: unknown = req.body?.tags

    if (!Number.isSafeInteger(orderItemId) || orderItemId < 1) {
      sendError(res, 400, 'Item pesanan tidak valid.')
      return
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      sendError(res, 400, 'Rating harus bilangan bulat 1 sampai 5.')
      return
    }
    if (comment.length > 500) {
      sendError(res, 400, 'Ulasan maksimal 500 karakter.')
      return
    }
    let tags: string[] = []
    if (rawTags !== undefined && rawTags !== null) {
      const allowed: readonly string[] = REVIEW_TAGS
      if (
        !Array.isArray(rawTags) ||
        rawTags.length > REVIEW_TAGS.length ||
        !rawTags.every((tag) => typeof tag === 'string' && allowed.includes(tag))
      ) {
        sendError(res, 400, 'Pilihan tag ulasan tidak valid.')
        return
      }
      tags = Array.from(new Set(rawTags as string[]))
    }

    const [itemRows] = await db.query<RowDataPacket[]>(
      `SELECT
         oi.order_item_id, oi.menu_id,
         o.order_id, o.tenant_id, o.order_status,
         p.payment_status,
         c.name, c.phone
       FROM order_items oi
       INNER JOIN orders o ON o.order_id = oi.order_id
       INNER JOIN customers c ON c.customer_id = o.customer_id
       LEFT JOIN payments p ON p.order_id = o.order_id
       WHERE oi.order_item_id = ?
       LIMIT 1`,
      [orderItemId],
    )
    const item = itemRows[0]
    if (!item || normalizePhone(String(item.phone)) !== phone) {
      sendError(res, 404, 'Item pesanan tidak ditemukan.')
      return
    }
    if (
      String(item.order_status).toLowerCase() !== 'completed' ||
      String(item.payment_status).toLowerCase() !== 'paid'
    ) {
      sendError(res, 409, 'Ulasan hanya dapat diberikan setelah pesanan selesai.')
      return
    }
    try {
      await db.execute(
        `INSERT INTO reviews
           (order_item_id, order_id, menu_id, tenant_id, customer_name,
            customer_phone, rating, tags, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderItemId,
          Number(item.order_id),
          Number(item.menu_id),
          Number(item.tenant_id),
          String(item.name).slice(0, 100),
          phone,
          rating,
          tags.length > 0 ? tags.join(',') : null,
          comment || null,
        ],
      )
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        sendError(res, 409, 'Menu pada pesanan ini sudah diulas.')
        return
      }
      throw error
    }
    res.status(201).json({
      status: 'success',
      message: 'Terima kasih, ulasan kamu tersimpan.',
    })
  } catch (error) {
    console.error('Failed to save review:', error)
    sendError(res, 500, 'Ulasan gagal disimpan.')
  }
})

// Open / Close Tenant Status
app.get('/api/tenant/open-status', requireTenant, async (_req, res) => {
  try {
    const tenantId = res.locals.tenant.tenantId
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT is_open, queue_prefix FROM tenants WHERE tenant_id = ? LIMIT 1',
      [tenantId],
    )
    if (!rows[0]) {
      sendError(res, 404, 'Tenant tidak ditemukan.')
      return
    }
    res.json({
      status: 'success',
      data: {
        isOpen: Number(rows[0].is_open) === 1,
        queuePrefix: rows[0].queue_prefix ?? null,
      },
    })
  } catch (error) {
    console.error('Failed to read open status:', error)
    sendError(res, 500, 'Gagal memuat status buka/tutup.')
  }
})

app.patch('/api/tenant/open-status', requireTenant, async (req, res) => {
  try {
    const tenantId = res.locals.tenant.tenantId
    if (typeof req.body?.isOpen !== 'boolean') {
      sendError(res, 400, 'Nilai isOpen harus true atau false.')
      return
    }
    const isOpen: boolean = req.body.isOpen
    await db.execute('UPDATE tenants SET is_open = ? WHERE tenant_id = ?', [
      isOpen ? 1 : 0,
      tenantId,
    ])
    res.json({
      status: 'success',
      message: isOpen ? 'Usaha dibuka.' : 'Usaha ditutup.',
      data: { isOpen },
    })
  } catch (error) {
    console.error('Failed to update open status:', error)
    sendError(res, 500, 'Gagal memperbarui status buka/tutup.')
  }
})

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`EKUT API running at http://localhost:${PORT}`)
  })
}

export default app;
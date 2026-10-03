import crypto from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import bcrypt from 'bcryptjs'

import jwt from 'jsonwebtoken'

import express from 'express'

import cors from 'cors'

import dotenv from 'dotenv'

import { db } from './db'

import type { RequestHandler } from 'express'



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

async function saveImageDataUrl(
  dataUrl: string,
  filenamePrefix: string,
): Promise<{ url: string; filePath: string }> {
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

  const extension = mimeType === 'jpeg' ? 'jpg' : mimeType
  const filename = `${filenamePrefix}-${crypto.randomBytes(12).toString('hex')}.${extension}`
  const uploadDirectory = path.join(process.cwd(), 'uploads')
  const filePath = path.join(uploadDirectory, filename)
  await mkdir(uploadDirectory, { recursive: true })
  await writeFile(filePath, imageBuffer)
  return { url: `/uploads/${filename}`, filePath }
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

app.use(cors())

app.use(express.json({ limit: '3mb' }))
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))



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



// Get available menus for a tenant

app.get('/api/tenants/:tenantId/menus', async (req, res) => {

  try {

    const tenantId = Number(req.params.tenantId)



    if (!Number.isInteger(tenantId) || tenantId < 1) {

      res.status(400).json({

        status: 'error',

        message: 'Invalid tenant ID',

      })

      return

    }



    const [rows] = await db.query(

      `

        SELECT

          menu_id,

          tenant_id,

          menu_name,
          description,
          price,
          quantity,
          status,
          photo

        FROM menus

        WHERE tenant_id = ?

          AND status = 'available'

          AND quantity > 0

        ORDER BY menu_id ASC

      `,

      [tenantId],

    )



    res.json({

      status: 'success',

      data: rows,

    })

  } catch (error) {

    console.error('Failed to fetch menus:', error)



    res.status(500).json({

      status: 'error',

      message: 'Failed to fetch menus',

    })

  }

})



// Checkout: one customer, potentially multiple tenant orders

app.post('/api/checkout', async (req, res) => {

  const body = req.body as CheckoutRequest



  const name =

    typeof body?.customer?.name === 'string'

      ? body.customer.name.trim()

      : ''



  const phone =

    typeof body?.customer?.phone === 'string'

      ? body.customer.phone.trim()

      : ''



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



    // Create customer record

    const [customerResult] = await connection.execute(

      `

        INSERT INTO customers (name, phone)

        VALUES (?, ?)

      `,

      [name, phone],

    )



    const customerId = (

      customerResult as { insertId: number }

    ).insertId



    const createdOrders: Array<{

      orderId: number

      orderNumber: string

      tenantId: number

      totalAmount: number

      paymentStatus: string

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

            order_status

          )

          VALUES (?, ?, ?, ?, ?)

        `,

        [

          orderNumber,

          customerId,

          tenantId,

          tenantTotal,

          'pending',

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

      /tidak ditemukan|tidak tersedia|tidak mencukupi|tidak valid|berubah/i.test(

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

// Do not expose this endpoint in a production deployment.

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



    await connection.commit()



    res.json({

      status: 'success',

      simulated: true,

      message: 'Pembayaran simulasi berhasil.',

      data: {

        orderIds,

        paymentStatus: 'paid',

        paymentReference: referencePrefix,

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





app.get('/api/tenants', async (_req, res) => {

  try {

    const [rows] = await db.query(`

      SELECT

        tenant_id,

        tenant_name,

        phone,

        profile_photo,

        status

      FROM tenants

      WHERE LOWER(status) = 'active'

      ORDER BY tenant_id ASC

    `);



    res.json({

      status: 'success',

      data: rows

    });

  } catch (error) {

    console.error('Error fetching customer tenants:', error);

    res.status(500).json({

      status: 'error',

      message: 'Gagal mengambil data tenant.'

    });

  }

});





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
  let uploadedFilePath: string | null = null

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
      const photoPattern = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/
      const match = photoPattern.exec(profilePhoto)
      if (!match) {
        res.status(400).json({
          status: 'error',
          message: 'Format foto tidak valid. Gunakan JPG, PNG, atau WEBP.',
        })
        return
      }

      const mimeType = match[1]
      const imageBuffer = Buffer.from(match[2], 'base64')
      if (imageBuffer.length > 1.5 * 1024 * 1024) {
        res.status(413).json({
          status: 'error',
          message: 'Ukuran foto maksimal 1,5 MB.',
        })
        return
      }

      const extension = mimeType === 'jpeg' ? 'jpg' : mimeType
      const uploadDirectory = path.join(process.cwd(), 'uploads')
      await mkdir(uploadDirectory, { recursive: true })
      const filename = `tenant-${tenantId}-${Date.now()}.${extension}`
      uploadedFilePath = path.join(uploadDirectory, filename)
      await writeFile(uploadedFilePath, imageBuffer)
      savedPhoto = `/uploads/${filename}`
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
  let uploadedPhotoPath: string | null = null
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
      uploadedPhotoPath = uploaded.filePath
    }

    const [result] = await db.execute(
      `INSERT INTO menus
        (tenant_id, menu_name, description, price, quantity, status, photo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        menuName,
        description || null,
        price,
        quantity,
        quantity > 0 ? 'available' : 'unavailable',
        savedPhoto,
      ],
    )
    uploadedPhotoPath = null

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
    if (uploadedPhotoPath) {
      try {
        await unlink(uploadedPhotoPath)
      } catch (cleanupError) {
        console.error('Failed to remove incomplete menu photo:', cleanupError)
      }
    }

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
    } else if (photo === existingMenu.photo && photo.startsWith('/uploads/')) {
      savedPhoto = existingMenu.photo
    } else {
      throw new ImageUploadError('Pilih foto menu dari perangkat yang valid.', 400)
    }

    await db.execute(
      `UPDATE menus
       SET menu_name = ?,
           description = ?,
           price = ?,
           quantity = ?,
           status = ?,
           photo = ?
       WHERE menu_id = ? AND tenant_id = ?`,
      [
        menuName,
        description || null,
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
        oi.order_item_id,
        oi.menu_id,
        m.menu_name,
        oi.quantity,
        oi.price,
        oi.subtotal
      FROM orders o
      INNER JOIN customers c
        ON c.customer_id = o.customer_id
      LEFT JOIN order_items oi
        ON oi.order_id = o.order_id
      LEFT JOIN menus m
        ON m.menu_id = oi.menu_id
      WHERE o.tenant_id = ?
      ORDER BY o.order_date DESC, o.order_id DESC`,
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
      const proofPattern = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/
      const match = proofPattern.exec(proofDataUrl)
      if (!match) {
        res.status(400).json({
          status: 'error',
          message: 'Format foto tidak valid. Gunakan JPG, PNG, atau WEBP.',
        })
        return
      }

      const mimeType = match[1]
      const imageBuffer = Buffer.from(match[2], 'base64')
      if (imageBuffer.length > 1.5 * 1024 * 1024) {
        res.status(413).json({
          status: 'error',
          message: 'Ukuran foto maksimal 1,5 MB.',
        })
        return
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
        res.status(400).json({
          status: 'error',
          message: 'Isi file tidak sesuai dengan format foto yang dipilih.',
        })
        return
      }

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

      const extension = mimeType === 'jpeg' ? 'jpg' : mimeType
      const filename = `rental-proof-${tenantId}-${rentalId}-${crypto.randomBytes(12).toString('hex')}.${extension}`
      const uploadDirectory = path.join(process.cwd(), 'uploads')
      await mkdir(uploadDirectory, { recursive: true })
      uploadedFilePath = path.join(uploadDirectory, filename)
      await writeFile(uploadedFilePath, imageBuffer)

      const [updateResult] = await db.execute(
        `UPDATE rental_payments
         SET payment_proof = ?
         WHERE rental_id = ?
           AND tenant_id = ?
           AND LOWER(status) IN ('pending', 'overdue')`,
        [`/uploads/${filename}`, rentalId, tenantId],
      )
      if ((updateResult as { affectedRows: number }).affectedRows === 0) {
        await unlink(uploadedFilePath)
        uploadedFilePath = null
        res.status(409).json({
          status: 'error',
          message: 'Bukti tidak tersimpan karena tagihan telah berubah. Muat ulang data dan coba lagi.',
        })
        return
      }
      uploadedFilePath = null

      res.json({
        status: 'success',
        message: 'Bukti pembayaran berhasil dikirim kepada admin.',
        data: { payment_proof: `/uploads/${filename}` },
      })
    } catch (error) {
      console.error('Failed to upload tenant rental payment proof:', error)
      if (uploadedFilePath) {
        try {
          await unlink(uploadedFilePath)
        } catch (cleanupError) {
          console.error('Failed to remove incomplete rental payment proof:', cleanupError)
        }
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

app.listen(PORT, () => {

  console.log(`EKUT API running at http://localhost:${PORT}`)

})

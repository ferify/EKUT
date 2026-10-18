import { createPool } from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const host = process.env.DB_HOST || 'localhost'
export const db = createPool({
  host,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ekut_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ...(['localhost', '127.0.0.1'].includes(host) ? {} :
    {
      ssl:
        { rejectUnauthorized: false }
    })
})

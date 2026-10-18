import AdminDashboard from '../pages/AdminDashboard'
import LoginPage from './LoginPage'
import { QRCodeSVG } from 'qrcode.react'
import { jsPDF } from 'jspdf'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import logo from './assets/ekutlogo.png'
import mascot from './assets/maskotgreetings.png'
import './App.css'
import TenantDashboard from '../pages/TenantDashboard'

type Tenant = {
  tenant_id: number
  tenant_name: string
  profile_photo: string | null
  category: string
  emoji: string
  is_open: boolean
  rating_avg: number
  rating_count: number
}

type MenuItem = {
  menu_id: number
  tenant_id: number
  menu_name: string
  description: string
  price: number
  quantity: number
  status: string
  photo: string | null
  emoji: string
  category: string
  rating_avg: number
  rating_count: number
  order_count: number
}

type CartItem = MenuItem & { orderQuantity: number }

type CheckoutOrder = {
  orderId: number
  orderNumber: string
  tenantId: number
  totalAmount: number
  paymentStatus: string
  scheduledTime?: string | null
  queueNumber?: string | null
}

type CheckoutResult = {
  totalAmount: number
  orders: CheckoutOrder[]
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const tenantPresentation: Record<number, { category: string; emoji: string }> = {
  1: { category: 'Makanan', emoji: '🍗' },
  2: { category: 'Minuman', emoji: '🥤' },
  3: { category: 'Dessert', emoji: '🍰' },
  4: { category: 'Makanan', emoji: '🍜' },
  5: { category: 'Pasta & Coffee', emoji: '🍝' },
  6: { category: 'Kue & Jajanan', emoji: '🧁' },
}

const menuPresentation: Record<number, string> = {
  1: '🍗', 2: '🧀', 3: '🥤', 4: '🥑', 5: '🥭', 6: '🍹',
  7: '🍫', 8: '🍰', 9: '🍮', 10: '🍜', 11: '🍲', 12: '🍜',
  13: '🍝', 14: '🍝', 15: '☕', 16: '🍰', 17: '🟢', 18: '🥟',
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}

type CustomerAuth = { token: string; name: string; phone: string }

const AUTH_KEY = 'ekut_customer'

function loadCustomerAuth(): CustomerAuth | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CustomerAuth>
    if (typeof parsed.token === 'string' && typeof parsed.phone === 'string') {
      return {
        token: parsed.token,
        phone: parsed.phone,
        name: typeof parsed.name === 'string' ? parsed.name : '',
      }
    }
  } catch {
    sessionStorage.removeItem(AUTH_KEY)
  }
  return null
}

function saveCustomerAuth(auth: CustomerAuth) {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth))
}

function clearCustomerAuth() {
  sessionStorage.removeItem(AUTH_KEY)
}

const REVIEW_TAGS = [
  'Porsi cukup',
  'Enak',
  'Harga murah',
  'Cepat disajikan',
  'Higienis',
  'Penyajian menarik',
]

function orderStatusLabel(status: string, paymentStatus: string) {
  if (paymentStatus.toLowerCase() !== 'paid') return 'Menunggu pembayaran'
  const value = status.toLowerCase()
  if (value === 'pending') return 'Menunggu diproses'
  if (value === 'preparing') return 'Sedang diproses'
  if (value === 'completed') return 'Selesai'
  return status
}

async function readJson(response: Response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

// Star & Rating Summary

function StarDisplay({ value, size = 16 }: { value: number; size?: number }) {
  const percent = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <span
      className="cx-stars"
      style={{ fontSize: size }}
      role="img"
      aria-label={`Rating ${value.toFixed(1)} dari 5`}
    >
      <span className="cx-stars-bg" aria-hidden="true">★★★★★</span>
      <span className="cx-stars-fg" aria-hidden="true" style={{ width: `${percent}%` }}>★★★★★</span>
    </span>
  )
}

function RatingSummary({
  average,
  count,
  onClick,
}: {
  average: number
  count: number
  onClick?: () => void
}) {
  const content =
    count > 0 ? (
      <>
        <StarDisplay value={average} />
        <strong>{average.toFixed(1)}/5</strong>
        <span className="cx-rating-count">({count} ulasan)</span>
      </>
    ) : (
      <>
        <StarDisplay value={0} />
        <span className="cx-rating-count">Belum ada rating</span>
      </>
    )
  if (onClick) {
    return (
      <button
        type="button"
        className="cx-rating cx-rating-button"
        onClick={onClick}
        aria-label="Lihat rating setiap menu"
      >
        {content}
      </button>
    )
  }
  return <span className="cx-rating">{content}</span>
}

function StarInput({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="cx-star-input" role="radiogroup" aria-label="Rating bintang">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} bintang`}
          className={star <= value ? 'is-on' : ''}
          onClick={() => onChange(star)}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <div className="cx-tag-list">
      {tags.map((tag) => (
        <span className="cx-tag" key={tag}>{tag}</span>
      ))}
    </div>
  )
}

// Rating per tenant / Menu

type RatingMenu = {
  menuId: number
  menuName: string
  category: string | null
  status: string
  ratingAvg: number
  ratingCount: number
  orderCount: number
}

type Review = {
  reviewId: number
  menuId?: number
  menuName?: string
  rating: number
  tags: string[]
  comment: string
  reviewerName: string
  createdAt: string | null
}

type TenantRatings = {
  tenantId: number
  tenantName: string
  ratingAvg: number
  ratingCount: number
  menus: RatingMenu[]
  recentReviews: Review[]
}

type MenuReviews = {
  menuId: number
  menuName: string
  ratingAvg: number
  ratingCount: number
  orderCount: number
  reviews: Review[]
}

function ReviewItem({ review }: { review: Review }) {
  return (
    <article className="cx-review">
      <div className="cx-review-top">
        <StarDisplay value={review.rating} size={14} />
        <strong>{review.reviewerName}</strong>
        {review.createdAt && <small>{review.createdAt}</small>}
      </div>
      {review.menuName && <small className="cx-review-menu">{review.menuName}</small>}
      <TagList tags={review.tags} />
      {review.comment && <p>{review.comment}</p>}
    </article>
  )
}

export function RatingsView({
  apiUrl,
  tenantId,
  initialMenuId,
}: {
  apiUrl: string
  tenantId: number
  initialMenuId?: number
}) {
  const [data, setData] = useState<TenantRatings | null>(null)
  const [error, setError] = useState('')
  const [openMenuId, setOpenMenuId] = useState<number | null>(initialMenuId ?? null)
  const [menuReviews, setMenuReviews] = useState<Record<number, MenuReviews | 'loading' | 'error'>>({})

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(`${apiUrl}/api/tenants/${tenantId}/ratings`, {
          signal: controller.signal,
        })
        const result = await readJson(response)
        if (!response.ok || result.status !== 'success') {
          throw new Error(result.message || 'Rating gagal dimuat.')
        }
        setData(result.data as TenantRatings)
        setError('')
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Rating gagal dimuat.')
      }
    }
    void load()
    return () => controller.abort()
  }, [apiUrl, tenantId])

  const loadMenuReviews = useCallback(
    async (menuId: number) => {
      setMenuReviews((current) => ({ ...current, [menuId]: 'loading' }))
      try {
        const response = await fetch(`${apiUrl}/api/menus/${menuId}/reviews`)
        const result = await readJson(response)
        if (!response.ok || result.status !== 'success') throw new Error('gagal')
        setMenuReviews((current) => ({ ...current, [menuId]: result.data as MenuReviews }))
      } catch {
        setMenuReviews((current) => ({ ...current, [menuId]: 'error' }))
      }
    },
    [apiUrl],
  )

  useEffect(() => {
    if (initialMenuId) void loadMenuReviews(initialMenuId)
  }, [initialMenuId, loadMenuReviews])

  function toggleMenu(menuId: number) {
    if (openMenuId === menuId) {
      setOpenMenuId(null)
      return
    }
    setOpenMenuId(menuId)
    if (!menuReviews[menuId]) void loadMenuReviews(menuId)
  }

  if (error) return <p role="alert" className="cx-error">{error}</p>
  if (!data) return <p role="status">Memuat rating...</p>

  return (
    <div className="cx-ratings">
      <div className="cx-ratings-summary">
        <RatingSummary average={data.ratingAvg} count={data.ratingCount} />
        <small>Rata-rata dari seluruh ulasan menu di {data.tenantName}</small>
      </div>
      <h3 className="cx-section-title">Rating per menu</h3>
      {data.menus.length === 0 && <p>Belum ada menu.</p>}
      <ul className="cx-menu-rating-list">
        {data.menus.map((menu) => {
          const reviews = menuReviews[menu.menuId]
          const isOpen = openMenuId === menu.menuId
          return (
            <li key={menu.menuId}>
              <button
                type="button"
                className="cx-menu-rating-row"
                aria-expanded={isOpen}
                onClick={() => toggleMenu(menu.menuId)}
              >
                <span className="cx-menu-rating-name">
                  <strong>{menu.menuName}</strong>
                  <small>Dipesan {menu.orderCount} kali</small>
                </span>
                <span className="cx-menu-rating-score">
                  {menu.ratingCount > 0 ? (
                    <>
                      <StarDisplay value={menu.ratingAvg} size={14} />
                      <strong>{menu.ratingAvg.toFixed(1)}/5</strong>
                      <small>({menu.ratingCount})</small>
                    </>
                  ) : (
                    <small>Belum ada rating</small>
                  )}
                </span>
              </button>
              {isOpen && (
                <div className="cx-menu-review-panel">
                  {reviews === 'loading' || reviews === undefined ? (
                    <p role="status">Memuat ulasan...</p>
                  ) : reviews === 'error' ? (
                    <p role="alert" className="cx-error">Ulasan gagal dimuat.</p>
                  ) : reviews.reviews.length === 0 ? (
                    <p>Belum ada ulasan untuk menu ini.</p>
                  ) : (
                    reviews.reviews.map((review) => (
                      <ReviewItem review={review} key={review.reviewId} />
                    ))
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {data.recentReviews.length > 0 && (
        <>
          <h3 className="cx-section-title">Ulasan terbaru</h3>
          {data.recentReviews.map((review) => (
            <ReviewItem review={review} key={review.reviewId} />
          ))}
        </>
      )}
    </div>
  )
}

function RatingsDialog({
  apiUrl,
  tenantId,
  tenantName,
  initialMenuId,
  onClose,
}: {
  apiUrl: string
  tenantId: number
  tenantName: string
  initialMenuId?: number
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="dialog cx-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ratings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="close-button" type="button" onClick={onClose} aria-label="Tutup">×</button>
        <span className="eyebrow">RATING & ULASAN</span>
        <h2 id="ratings-title">{tenantName}</h2>
        <RatingsView apiUrl={apiUrl} tenantId={tenantId} initialMenuId={initialMenuId} />
      </section>
    </div>
  )
}

// Login OTP simulasi

function OtpLoginDialog({
  apiUrl,
  onClose,
  onLoggedIn,
}: {
  apiUrl: string
  onClose: () => void
  onLoggedIn: (auth: CustomerAuth) => void
}) {
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [demoCode, setDemoCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function requestOtp(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${apiUrl}/api/customer/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const result = await readJson(response)
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Kode OTP gagal dibuat.')
      }
      setDemoCode(typeof result.data?.demoCode === 'string' ? result.data.demoCode : '')
      setCode('')
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kode OTP gagal dibuat.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${apiUrl}/api/customer/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      const result = await readJson(response)
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Verifikasi gagal.')
      }
      onLoggedIn({
        token: result.data.token as string,
        name: (result.data.customer?.name as string) ?? '',
        phone: (result.data.customer?.phone as string) ?? phone,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verifikasi gagal.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => { if (!loading) onClose() }}>
      <section
        className="dialog cx-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="otp-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="close-button" type="button" onClick={onClose} aria-label="Tutup">×</button>
        <span className="eyebrow">MASUK KEMBALI</span>
        <h2 id="otp-title">Masuk dengan nomor telepon</h2>
        {step === 'phone' ? (
          <form onSubmit={(event) => void requestOtp(event)}>
            <p className="dialog-description">
              Gunakan nomor telepon yang pernah kamu pakai untuk memesan. Kami akan membuat kode OTP simulasi.
            </p>
            <div className="checkout-form-fields">
              <label htmlFor="otp-phone">Nomor telepon</label>
              <input
                id="otp-phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                maxLength={20}
                required
                value={phone}
                disabled={loading}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            {error && <p role="alert" className="form-error">{error}</p>}
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Memproses...' : 'Kirim kode OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={(event) => void verifyOtp(event)}>
            <p className="dialog-description">Masukkan 6 digit kode OTP untuk {phone}.</p>
            {demoCode && (
              <div className="cx-demo-otp" role="note">
                <span>Kode OTP simulasi (tidak ada SMS yang dikirim):</span>
                <strong>{demoCode}</strong>
                <button type="button" className="cx-link-button" onClick={() => setCode(demoCode)}>Isi otomatis</button>
              </div>
            )}
            <div className="checkout-form-fields">
              <label htmlFor="otp-code">Kode OTP</label>
              <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                value={code}
                disabled={loading}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              />
            </div>
            {error && <p role="alert" className="form-error">{error}</p>}
            <button className="primary-button" type="submit" disabled={loading || code.length !== 6}>
              {loading ? 'Memverifikasi...' : 'Masuk'}
            </button>
            <button
              className="cx-link-button cx-center"
              type="button"
              disabled={loading}
              onClick={() => { setStep('phone'); setError('') }}
            >
              Ganti nomor / kirim ulang kode
            </button>
          </form>
        )}
      </section>
    </div>
  )
}

// Form Review

function ReviewForm({
  apiUrl,
  auth,
  orderItemId,
  onSaved,
  onCancel,
  onSessionExpired,
}: {
  apiUrl: string
  auth: CustomerAuth
  orderItemId: number
  onSaved: () => void
  onCancel: () => void
  onSessionExpired: () => void
}) {
  const [rating, setRating] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    if (rating < 1) {
      setError('Pilih rating bintang terlebih dahulu.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${apiUrl}/api/customer/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ orderItemId, rating, tags, comment: comment.trim() }),
      })
      const result = await readJson(response)
      if (response.status === 401 || response.status === 403) {
        onSessionExpired()
        return
      }
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Ulasan gagal disimpan.')
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ulasan gagal disimpan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="cx-review-form" onSubmit={(event) => void submit(event)}>
      <StarInput value={rating} onChange={setRating} />
      <div className="cx-chips" role="group" aria-label="Pilih yang sesuai">
        {REVIEW_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={tags.includes(tag)}
            className={`cx-chip ${tags.includes(tag) ? 'is-active' : ''}`}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
      <label className="cx-label" htmlFor={`review-comment-${orderItemId}`}>Ulasan (opsional)</label>
      <textarea
        id={`review-comment-${orderItemId}`}
        className="cx-textarea"
        rows={3}
        maxLength={500}
        placeholder="Ceritakan pengalamanmu..."
        value={comment}
        onChange={(event) => setComment(event.target.value)}
      />
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="cx-form-actions">
        <button type="button" className="cx-secondary-button" onClick={onCancel} disabled={saving}>Batal</button>
        <button type="submit" className="cx-primary-button" disabled={saving}>
          {saving ? 'Menyimpan...' : 'Kirim ulasan'}
        </button>
      </div>
    </form>
  )
}

// Order History

type HistoryItem = {
  orderItemId: number
  menuId: number
  menuName: string
  quantity: number
  price: number
  subtotal: number
  canReview: boolean
  review: { rating: number; tags: string[]; comment: string } | null
}

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
  items: HistoryItem[]
}

function OrderHistoryDialog({
  apiUrl,
  auth,
  onClose,
  onSessionExpired,
}: {
  apiUrl: string
  auth: CustomerAuth
  onClose: () => void
  onSessionExpired: () => void
}) {
  const [orders, setOrders] = useState<HistoryOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewingItemId, setReviewingItemId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${apiUrl}/api/customer/orders`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      const result = await readJson(response)
      if (response.status === 401 || response.status === 403) {
        onSessionExpired()
        return
      }
      if (!response.ok || result.status !== 'success' || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Riwayat gagal dimuat.')
      }
      setOrders(result.data as HistoryOrder[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Riwayat gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }, [apiUrl, auth.token, onSessionExpired])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="dialog cx-dialog cx-dialog-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="close-button" type="button" onClick={onClose} aria-label="Tutup">×</button>
        <span className="eyebrow">{auth.name || auth.phone}</span>
        <h2 id="history-title">Riwayat order</h2>
        <p className="dialog-description">
          Nomor riwayat adalah identitas pembelian. Nomor antrian dipakai untuk memanggil pesanan di tenant.
        </p>
        {loading && <p role="status">Memuat riwayat...</p>}
        {error && <p role="alert" className="form-error">{error}</p>}
        {!loading && !error && orders.length === 0 && <p>Belum ada pesanan.</p>}
        <div className="cx-history">
          {orders.map((order) => (
            <article className="cx-history-order" key={order.orderId}>
              <div className="cx-history-top">
                <div>
                  <strong>{order.tenantName}</strong>
                  <small>{order.orderDate}</small>
                </div>
                <span className="cx-status">{orderStatusLabel(order.status, order.paymentStatus)}</span>
              </div>
              <div className="cx-history-numbers">
                <span>
                  Nomor antrian:{' '}
                  {order.queueNumber ? (
                    <b className="cx-queue-badge">{order.queueNumber}</b>
                  ) : (
                    <em>belum ada (menunggu pembayaran)</em>
                  )}
                </span>
                <span>No. riwayat: <b>{order.orderNumber}</b></span>
                <span>Waktu pesan: <b>{order.scheduledTime ? `Pukul ${order.scheduledTime}` : 'Saat ini'}</b></span>
              </div>
              <ul className="cx-history-items">
                {order.items.map((item) => (
                  <li key={item.orderItemId}>
                    <div className="cx-history-item-row">
                      <span>{item.menuName} <small>× {item.quantity}</small></span>
                      <strong>{formatRupiah(item.subtotal)}</strong>
                    </div>
                    {item.review && (
                      <div className="cx-my-review">
                        <StarDisplay value={item.review.rating} size={14} />
                        <TagList tags={item.review.tags} />
                        {item.review.comment && <p>{item.review.comment}</p>}
                      </div>
                    )}
                    {item.canReview && reviewingItemId !== item.orderItemId && (
                      <button
                        type="button"
                        className="cx-secondary-button"
                        onClick={() => setReviewingItemId(item.orderItemId)}
                      >
                        Beri ulasan
                      </button>
                    )}
                    {reviewingItemId === item.orderItemId && (
                      <ReviewForm
                        apiUrl={apiUrl}
                        auth={auth}
                        orderItemId={item.orderItemId}
                        onCancel={() => setReviewingItemId(null)}
                        onSessionExpired={onSessionExpired}
                        onSaved={() => {
                          setReviewingItemId(null)
                          void load()
                        }}
                      />
                    )}
                  </li>
                ))}
              </ul>
              <div className="cx-history-total">
                <span>Total</span>
                <strong>{formatRupiah(order.totalAmount)}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

// Schedule Order

type ScheduleValue = { mode: 'now' | 'later'; time: string }

function earliestScheduleTime(leadMinutes = 5): string {
  const target = new Date(Date.now() + leadMinutes * 60000)
  const hours = String(target.getHours()).padStart(2, '0')
  const minutes = String(target.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function ScheduleField({
  value,
  onChange,
  disabled,
}: {
  value: ScheduleValue
  onChange: (value: ScheduleValue) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="cx-schedule" disabled={disabled}>
      <legend>Waktu pesan</legend>
      <label className="cx-radio">
        <input
          type="radio"
          name="schedule-mode"
          checked={value.mode === 'now'}
          onChange={() => onChange({ mode: 'now', time: '' })}
        />
        Saat ini
      </label>
      <label className="cx-radio">
        <input
          type="radio"
          name="schedule-mode"
          checked={value.mode === 'later'}
          onChange={() => onChange({ mode: 'later', time: value.time || earliestScheduleTime(15) })}
        />
        Pilih jam hari ini
      </label>
      {value.mode === 'later' && (
        <div className="cx-schedule-time">
          <input
            type="time"
            aria-label="Jam pengambilan hari ini"
            required
            min={earliestScheduleTime()}
            value={value.time}
            onChange={(event) => onChange({ mode: 'later', time: event.target.value })}
          />
          <small>Minimal 5 menit dari sekarang, hanya untuk hari ini.</small>
        </div>
      )}
    </fieldset>
  )
}

function CustomerApp() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantLoading, setTenantLoading] = useState(true)
  const [tenantError, setTenantError] = useState('')

  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [menuError, setMenuError] = useState('')

  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [slideValue, setSlideValue] = useState(0)
  const [message, setMessage] = useState('')

  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null)

  const [paymentCompleted, setPaymentCompleted] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [openOnly, setOpenOnly] = useState(false)
  const [sortBy, setSortBy] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [menuSearch, setMenuSearch] = useState('')
  const [menuCategory, setMenuCategory] = useState('')
  const [customerAuth, setCustomerAuth] = useState<CustomerAuth | null>(() => loadCustomerAuth())
  const [loginOpen, setLoginOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [ratingsDialog, setRatingsDialog] = useState<{
    tenantId: number
    tenantName: string
    menuId?: number
  } | null>(null)
  const [schedule, setSchedule] = useState<ScheduleValue>({ mode: 'now', time: '' })
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])
  const tenantQuery = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('q', debouncedSearch)
    if (categoryFilter) params.set('category', categoryFilter)
    if (openOnly) params.set('openOnly', '1')
    if (sortBy) params.set('sort', sortBy)
    const query = params.toString()
    return query ? `?${query}` : ''
  }, [debouncedSearch, categoryFilter, openOnly, sortBy])
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch(`${API_URL}/api/categories`)
        const result = await response.json()
        if (response.ok && result.status === 'success' && Array.isArray(result.data)) {
          setCategories(result.data as string[])
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      }
    }
    void fetchCategories()
  }, [])
  useEffect(() => {
    const controller = new AbortController()

    async function fetchTenants() {
      try {
        const response = await fetch(`${API_URL}/api/tenants${tenantQuery}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Gagal mengambil data tenant.')
        const result = await response.json()
        if (result.status !== 'success' || !Array.isArray(result.data)) {
          throw new Error('Format data tenant tidak valid.')
        }

        setTenants(result.data.map((tenant: {
          tenant_id: number | string
          tenant_name: string
          profile_photo: string | null
          category?: string | null
          is_open?: boolean
          rating_avg?: number | string
          rating_count?: number | string
        }) => {
          const tenantId = Number(tenant.tenant_id)
          const presentation = tenantPresentation[tenantId] ?? { category: 'Kantin', emoji: '🍽️' }
          return {
            tenant_id: tenantId,
            tenant_name: tenant.tenant_name,
            profile_photo: tenant.profile_photo,
            category: tenant.category || presentation.category,
            emoji: presentation.emoji,
            is_open: tenant.is_open !== false,
            rating_avg: Number(tenant.rating_avg ?? 0),
            rating_count: Number(tenant.rating_count ?? 0),
          }
        }))
        setTenantError('')
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Failed to fetch tenants:', error)
        setTenantError('Data tenant gagal dimuat. Periksa koneksi backend.')
      } finally {
        if (!controller.signal.aborted) setTenantLoading(false)
      }
    }

    void fetchTenants()
    return () => controller.abort()
  }, [tenantQuery])
  useEffect(() => {
    if (!selectedTenant) {
      setMenus([])
      setMenuError('')
      setMenuLoading(false)
      return
    }

    const controller = new AbortController()
    const tenantId = selectedTenant.tenant_id

    async function fetchMenus() {
      setMenuLoading(true)
      setMenuError('')
      setMenus([])
      try {
        const response = await fetch(`${API_URL}/api/tenants/${tenantId}/menus`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Gagal mengambil data menu.')
        const result = await response.json()
        if (result.status !== 'success' || !Array.isArray(result.data)) {
          throw new Error('Format data menu tidak valid.')
        }

        setMenus(result.data.map((menu: {
          menu_id: number | string
          tenant_id: number | string
          menu_name: string
          description: string | null
          price: number | string
          quantity: number | string
          status: string
          photo: string | null
          category?: string | null
          rating_avg?: number | string
          rating_count?: number | string
          order_count?: number | string
        }) => ({
          menu_id: Number(menu.menu_id),
          tenant_id: Number(menu.tenant_id),
          menu_name: menu.menu_name,
          description: menu.description ?? '',
          price: Number(menu.price),
          quantity: Number(menu.quantity),
          status: menu.status,
          photo: menu.photo,
          emoji: menuPresentation[Number(menu.menu_id)] ?? '🍽️',
          category: menu.category ?? '',
          rating_avg: Number(menu.rating_avg ?? 0),
          rating_count: Number(menu.rating_count ?? 0),
          order_count: Number(menu.order_count ?? 0),
        })))
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Failed to fetch menus:', error)
        setMenuError('Menu gagal dimuat. Periksa koneksi backend dan coba lagi.')
      } finally {
        if (!controller.signal.aborted) setMenuLoading(false)
      }
    }

    void fetchMenus()
    return () => controller.abort()
  }, [selectedTenant?.tenant_id])

  function uploadedImageUrl(value: string | null | undefined) {
    if (!value) return ''
    if (value.startsWith('/')) return `${API_URL}${value}`
    return value
  }

  const totalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.orderQuantity, 0),
    [cart],
  )
  const totalPrice = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.orderQuantity, 0),
    [cart],
  )
  const menuCategories = useMemo(
    () => Array.from(new Set(menus.map((menu) => menu.category).filter(Boolean))),
    [menus],
  )
  const normalizedMenuSearch = menuSearch.trim().toLowerCase()
  function logoutCustomer() {
    clearCustomerAuth()
    setCustomerAuth(null)
    setHistoryOpen(false)
    setMessage('Kamu sudah keluar.')
  }
  function addToCart(menu: MenuItem) {
    const owner = selectedTenant?.tenant_id === menu.tenant_id
      ? selectedTenant
      : tenants.find((tenant) => tenant.tenant_id === menu.tenant_id)
    if (owner && !owner.is_open) {
      setMessage(`${owner.tenant_name} sedang tutup. Menu belum bisa dipesan.`)
      return
    }
    if (menu.quantity < 1) {
      setMessage('Menu sedang habis.')
      return
    }
    const existing = cart.find((item) => item.menu_id === menu.menu_id)
    if (existing && existing.orderQuantity >= menu.quantity) {
      setMessage('Jumlah pesanan sudah mencapai batas stok.')
      return
    }

    setCart((current) => {
      const currentItem = current.find((item) => item.menu_id === menu.menu_id)
      if (!currentItem) return [...current, { ...menu, orderQuantity: 1 }]
      if (currentItem.orderQuantity >= currentItem.quantity) return current
      return current.map((item) => item.menu_id === menu.menu_id
        ? { ...item, orderQuantity: item.orderQuantity + 1 }
        : item)
    })
    setMessage(`${menu.menu_name} ditambahkan ke keranjang.`)
  }

  function changeQuantity(menuId: number, change: number) {
    setCart((current) => current
      .map((item) => {
        if (item.menu_id !== menuId) return item
        return { ...item, orderQuantity: Math.min(item.quantity, item.orderQuantity + change) }
      })
      .filter((item) => item.orderQuantity > 0))
  }

  function handleCheckout(value: number) {
    setSlideValue(value)
    if (value >= 95 && totalItems > 0) {
      setSlideValue(0)
      setCheckoutError('')
      if (customerAuth) {
        setCustomerName(customerAuth.name)
        setCustomerPhone(customerAuth.phone)
      }
      setSchedule({ mode: 'now', time: '' })
      setCheckoutOpen(true)
    }
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (checkoutLoading || cart.length === 0) return
    if (schedule.mode === 'later' && !schedule.time) {
      setCheckoutError('Pilih jam pengambilan untuk pesanan terjadwal.')
      return
    }
    setCheckoutLoading(true)
    setCheckoutError('')
    setPaymentCompleted(false)
    setPaymentError('')

    try {
      const response = await fetch(`${API_URL}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: customerName.trim(),
            phone: customerPhone.trim(),
          },
          items: cart.map((item) => ({
            menuId: item.menu_id,
            quantity: item.orderQuantity,
          })),
          scheduledTime: schedule.mode === 'later' ? schedule.time : null,
        }),
      })

      const result = await response.json()
      if (!response.ok || result.status !== 'success' || !result.data) {
        throw new Error(result.message || 'Checkout gagal diproses.')
      }

      setCheckoutResult(result.data as CheckoutResult)
      setCheckoutOpen(false)
      setCartOpen(false)
      setCart([])
      setCustomerName('')
      setCustomerPhone('')
      setMessage('Pesanan berhasil dibuat. Silakan lanjutkan simulasi pembayaran QRIS.')
    } catch (error) {
      console.error('Checkout failed:', error)
      setCheckoutError(error instanceof Error ? error.message : 'Terjadi kesalahan saat checkout.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  async function simulatePayment() {
    if (!checkoutResult || paymentLoading || paymentCompleted) return

    setPaymentLoading(true)
    setPaymentError('')
    try {
      const response = await fetch(`${API_URL}/api/payments/simulate-success`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: checkoutResult.orders.map((order) => order.orderId),
        }),
      })
      const result = await response.json()
      if (!response.ok || result.status !== 'success' || result.simulated !== true) {
        throw new Error(result.message || 'Pembayaran simulasi gagal.')
      }
      const queueNumbers = (result.data?.queueNumbers ?? {}) as Record<string, string>
      setCheckoutResult((current) => current && {
        ...current,
        orders: current.orders.map((order) => ({
          ...order,
          paymentStatus: 'paid',
          queueNumber: queueNumbers[String(order.orderId)] ?? order.queueNumber ?? null,
        })),
      })
      setPaymentCompleted(true)
    } catch (error) {
      console.error('Payment simulation failed:', error)
      setPaymentError(error instanceof Error ? error.message : 'Terjadi kesalahan saat memproses pembayaran.')
    } finally {
      setPaymentLoading(false)
    }
  }

  function downloadReceipt() {
    if (!checkoutResult || !paymentCompleted) {
      setPaymentError('Selesaikan simulasi pembayaran terlebih dahulu.')
      return
    }

    try {
      const pdf = new jsPDF()
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 18
      let y = 22

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(20)
      pdf.setTextColor(23, 76, 130)
      pdf.text('E-KUT', margin, y)

      y += 8
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(90, 100, 115)
      pdf.text('E-Kantin Universitas Terbuka', margin, y)

      y += 10
      pdf.setDrawColor(220, 228, 238)
      pdf.line(margin, y, pageWidth - margin, y)

      y += 10
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(14)
      pdf.setTextColor(35, 45, 60)
      pdf.text('BUKTI PEMBAYARAN - SIMULASI', margin, y)

      y += 8
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(90, 100, 115)
      pdf.text(`Tanggal: ${new Date().toLocaleString('id-ID')}`, margin, y)

      y += 6
      pdf.text('Metode: QRIS simulasi (demo)', margin, y)
      y += 6
      pdf.text('Status: PAID (SIMULASI)', margin, y)

      y += 8
      pdf.line(margin, y, pageWidth - margin, y)
      y += 9

      checkoutResult.orders.forEach((order) => {
        const tenant = tenants.find(
          (item) => item.tenant_id === order.tenantId,
        )

        const lines = [
          `Nomor antrian: ${order.queueNumber ?? '-'}`,
          `Nomor riwayat pesanan: ${order.orderNumber}`,
          `Tenant: ${tenant?.tenant_name ?? `Tenant ${order.tenantId}`}`,
          `Waktu pesan: ${order.scheduledTime ? `Pukul ${order.scheduledTime}` : 'Saat ini'}`,
          `Total: ${formatRupiah(order.totalAmount)}`,
          'Status pembayaran: paid (simulasi)',
        ]

        const neededHeight = lines.length * 6 + 7
        if (y + neededHeight > pageHeight - 35) {
          pdf.addPage()
          y = 20
        }

        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        pdf.setTextColor(23, 76, 130)
        pdf.text(lines[0], margin, y)
        y += 6

        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(75, 85, 100)
        for (const line of lines.slice(1)) {
          pdf.text(line, margin, y)
          y += 6
        }

        y += 3
        pdf.setDrawColor(230, 235, 241)
        pdf.line(margin, y, pageWidth - margin, y)
        y += 8
      })

      if (y > pageHeight - 30) {
        pdf.addPage()
        y = 20
      }

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.setTextColor(35, 45, 60)
      pdf.text('TOTAL PEMBAYARAN', margin, y)
      pdf.setTextColor(230, 112, 20)
      pdf.text(
        formatRupiah(checkoutResult.totalAmount),
        pageWidth - margin,
        y,
        { align: 'right' },
      )

      y += 10
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(100, 100, 100)
      const disclaimer = pdf.splitTextToSize(
        'Dokumen ini merupakan bukti transaksi simulasi untuk demo EKUT, bukan bukti pembayaran QRIS asli.',
        pageWidth - margin * 2,
      )
      pdf.text(disclaimer, margin, y)

      const dateStamp = new Date().toISOString().slice(0, 10)
      pdf.save(`Struk-EKUT-${dateStamp}.pdf`)
      setPaymentError('')
    } catch (error) {
      console.error('Failed to generate receipt:', error)
      setPaymentError(
        'Struk PDF gagal dibuat. Pastikan library jspdf sudah terpasang.',
      )
    }
  }

  function closePaymentResult() {
    setCheckoutResult(null)
    setPaymentCompleted(false)
    setPaymentError('')
    setMessage('Pembayaran simulasi selesai. Terima kasih sudah memesan di EKUT!')
  }

  function selectTenant(tenant: Tenant) {
    setSelectedTenant(tenant)
    setMenuSearch('')
    setMenuCategory('')
    setMessage('')
  }

  function backToTenants() {
    setSelectedTenant(null)
    setMessage('')
  }

  function getTenantName(tenantId: number) {
    return tenants.find((tenant) => tenant.tenant_id === tenantId)?.tenant_name ?? 'Tenant'
  }

  return (
    <main className="ekut-app">
      <header className="site-header">
        <img className="site-logo" src={logo} alt="E-Kantin Universitas Terbuka" />
        <span className="header-tagline">Your campus food, made easy.</span>
        <div className="cx-header-actions">
          {customerAuth ? (
            <>
              <button type="button" className="cx-link-button" onClick={() => setHistoryOpen(true)}>Riwayat order</button>
              <button type="button" className="cx-link-button" onClick={logoutCustomer}>Keluar ({customerAuth.name || customerAuth.phone})</button>
            </>
          ) : (
            <button type="button" className="cx-link-button" onClick={() => setLoginOpen(true)}>Masuk dengan nomor telepon</button>
          )}
        </div>
      </header>

      {!selectedTenant ? (
        <>
          <section className="welcome-section">
            <div className="welcome-copy">
              <span className="eyebrow">E-KANTIN UNIVERSITAS TERBUKA</span>
              <h1>Welcome to Our Cafetaria!</h1>
              <p>Please choose your order.</p>
              <span className="orange-swoosh" />
            </div>
            <img className="mascot-image" src={mascot} alt="Maskot kucing EKUT" />
          </section>

          <section className="tenant-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">FIND YOUR FAVORITE</span>
                <h2>Explore Our Tenants</h2>
              </div>
              <span className="tenant-count">{tenants.length} tenants</span>
            </div>
            <div className="cx-filter-bar">
              <input
                className="cx-search"
                type="search"
                placeholder="Cari tenant atau menu..."
                aria-label="Cari tenant atau menu"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select className="cx-select" aria-label="Urutkan tenant" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="">Urutan default</option>
                <option value="rating">Rating tertinggi</option>
                <option value="name">Nama A-Z</option>
              </select>
              <label className="cx-check">
                <input type="checkbox" checked={openOnly} onChange={(event) => setOpenOnly(event.target.checked)} />
                Hanya yang buka
              </label>
            </div>
            <div className="cx-chips" role="group" aria-label="Filter kategori">
              <button type="button" aria-pressed={categoryFilter === ''} className={`cx-chip ${categoryFilter === '' ? 'is-active' : ''}`} onClick={() => setCategoryFilter('')}>Semua</button>
              {categories.map((category) => (
                <button type="button" key={category} aria-pressed={categoryFilter === category} className={`cx-chip ${categoryFilter === category ? 'is-active' : ''}`} onClick={() => setCategoryFilter(category)}>{category}</button>
              ))}
            </div>
            {tenantLoading && <p role="status">Memuat daftar tenant...</p>}
            {tenantError && <p role="alert">{tenantError}</p>}
            {!tenantLoading && !tenantError && tenants.length === 0 && <p>{search || categoryFilter || openOnly ? 'Tidak ada tenant yang cocok dengan pencarian atau filter.' : 'Belum ada tenant yang tersedia.'}</p>}
            <div className="tenant-grid">
              {tenants.map((tenant, index) => (
                <div className="cx-tenant-wrap" key={tenant.tenant_id}>
                  <button
                    className={`tenant-card ${index % 2 === 0 ? 'blue' : 'orange'} ${tenant.is_open ? '' : 'is-closed'}`}
                    type="button"
                    onClick={() => selectTenant(tenant)}
                  >
                    <span className="kiosk-illustration" aria-hidden="true">
                      <span className="kiosk-roof"><span /><span /><span /><span /><span /></span>
                      <span className="kiosk-body">
                        <span className="kiosk-shelf" />
                        <span className="kiosk-window">{tenant.emoji}</span>
                        <span className="kiosk-counter" />
                      </span>
                      {tenant.profile_photo
                        ? <span className="food-avatar tenant-profile-food-avatar"><img src={uploadedImageUrl(tenant.profile_photo)} alt="" /></span>
                        : <span className="food-avatar">{tenant.emoji}</span>}
                    </span>
                    <span className="tenant-info">
                      <span className="tenant-category">{tenant.category}</span>
                      <strong>{tenant.tenant_name}</strong>
                      {!tenant.is_open && <span className="cx-closed-badge">TUTUP</span>}
                      <span className="tenant-link">{tenant.is_open ? 'Explore menu →' : 'Lihat menu →'}</span>
                    </span>
                  </button>
                  <RatingSummary
                    average={tenant.rating_avg}
                    count={tenant.rating_count}
                    onClick={() => setRatingsDialog({ tenantId: tenant.tenant_id, tenantName: tenant.tenant_name })}
                  />
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="tenant-section menu-page">
          <button className="back-button" type="button" onClick={backToTenants}>← Back to tenants</button>
          <div className="section-heading">
            <div>
              <span className="eyebrow">{selectedTenant.category}</span>
              {selectedTenant.profile_photo && (
                <img
                  className="selected-tenant-photo"
                  src={uploadedImageUrl(selectedTenant.profile_photo)}
                  alt={`Foto profil ${selectedTenant.tenant_name}`}
                />
              )}
              <h2>{selectedTenant.tenant_name}</h2>
              <p className="menu-intro">Choose your favorite menu.</p>
              <RatingSummary
                average={selectedTenant.rating_avg}
                count={selectedTenant.rating_count}
                onClick={() => setRatingsDialog({ tenantId: selectedTenant.tenant_id, tenantName: selectedTenant.tenant_name })}
              />
              {!selectedTenant.is_open && (
                <p className="cx-closed-banner" role="status">Tenant ini sedang tutup. Kamu masih bisa melihat menu, tetapi belum bisa memesan.</p>
              )}
              {cart.length > 0 && (
                <p>Keranjang kamu berisi {totalItems} item dari {new Set(cart.map((item) => item.tenant_id)).size} tenant.</p>
              )}
            </div>
          </div>
          {menuLoading && <p role="status">Memuat menu...</p>}
          {menuError && <p role="alert">{menuError}</p>}
          {!menuLoading && !menuError && menus.length === 0 && <p>Belum ada menu yang tersedia untuk tenant ini.</p>}
          {menus.length > 0 && (
            <>
              <div className="cx-filter-bar">
                <input
                  className="cx-search"
                  type="search"
                  placeholder="Cari menu di tenant ini..."
                  aria-label="Cari menu"
                  value={menuSearch}
                  onChange={(event) => setMenuSearch(event.target.value)}
                />
              </div>
              {menuCategories.length > 0 && (
                <div className="cx-chips" role="group" aria-label="Kategori menu">
                  <button type="button" aria-pressed={menuCategory === ''} className={`cx-chip ${menuCategory === '' ? 'is-active' : ''}`} onClick={() => setMenuCategory('')}>Semua</button>
                  {menuCategories.map((category) => (
                    <button type="button" key={category} aria-pressed={menuCategory === category} className={`cx-chip ${menuCategory === category ? 'is-active' : ''}`} onClick={() => setMenuCategory(category)}>{category}</button>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="menu-grid">
            {menus
              .filter((menu) => menu.tenant_id === selectedTenant.tenant_id && menu.status === 'available' && menu.quantity > 0)
              .filter((menu) => !menuCategory || menu.category === menuCategory)
              .filter((menu) => !normalizedMenuSearch || `${menu.menu_name} ${menu.description}`.toLowerCase().includes(normalizedMenuSearch))
              .map((menu) => {
                const cartItem = cart.find((item) => item.menu_id === menu.menu_id)
                const remainingStock = menu.quantity - (cartItem?.orderQuantity ?? 0)
                return (
                  <article className="menu-card" key={menu.menu_id}>
                    <div className="menu-picture">{menu.photo
                      ? <img src={uploadedImageUrl(menu.photo)} alt={menu.menu_name} />
                      : menu.emoji}</div>
                    <div className="menu-card-info">
                      <h3>{menu.menu_name}</h3>
                      {menu.category && <span className="cx-menu-category">{menu.category}</span>}
                      <p>{menu.description}</p>
                      <button
                        type="button"
                        className="cx-menu-rating"
                        onClick={() => setRatingsDialog({ tenantId: selectedTenant.tenant_id, tenantName: selectedTenant.tenant_name, menuId: menu.menu_id })}
                      >
                        {menu.rating_count > 0 ? `★ ${menu.rating_avg.toFixed(1)}/5 (${menu.rating_count})` : '☆ Belum ada rating'} · dipesan {menu.order_count}×
                      </button>
                      <strong>{formatRupiah(menu.price)}</strong>
                      <span className="stock-label">Stock: {remainingStock}</span>
                    </div>
                    <button className="add-button" type="button" disabled={remainingStock <= 0 || !selectedTenant.is_open} onClick={() => addToCart(menu)}>{selectedTenant.is_open ? '+ Add' : 'Tutup'}</button>
                  </article>
                )
              })}
          </div>
        </section>
      )}

      <footer className="checkout-bar">
        <button className="cart-button" type="button" onClick={() => setCartOpen(true)} aria-label={`Open cart, ${totalItems} items`}>
          <span className="cart-icon" aria-hidden="true">🛒</span>
          <span className="cart-label">My Cart</span>
          <span className="cart-badge">{totalItems}</span>
        </button>
        <div className="checkout-divider" />
        <div className={`slide-control ${totalItems === 0 ? 'disabled' : ''}`}>
          <input
            type="range"
            min="0"
            max="100"
            value={slideValue}
            disabled={totalItems === 0}
            aria-label="Slide to check out"
            onChange={(event) => handleCheckout(Number(event.target.value))}
          />
          <span className="slide-knob" aria-hidden="true" style={{ left: `calc(${Math.min(slideValue, 100)}% - ${(Math.min(slideValue, 100) / 100) * 40}px)` }}>›</span>
          <span className="slide-text">{totalItems > 0 ? 'Slide to check out' : 'Add items to get started'}</span>
          <span className="slide-arrow" aria-hidden="true">→</span>
        </div>
      </footer>

      {cartOpen && (
        <div className="modal-backdrop" onClick={() => setCartOpen(false)}>
          <section className="dialog cart-dialog" role="dialog" aria-modal="true" aria-labelledby="cart-title" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" type="button" onClick={() => setCartOpen(false)} aria-label="Close cart">×</button>
            <span className="eyebrow">YOUR ORDER</span>
            <h2 id="cart-title">My Cart</h2>
            {cart.length === 0 ? (
              <p className="dialog-description">Your cart is empty. Choose a tenant to get started!</p>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <div className="cart-row" key={item.menu_id}>
                      <span className="menu-emoji">{item.photo
                        ? <img src={uploadedImageUrl(item.photo)} alt="" />
                        : item.emoji}</span>
                      <div className="menu-detail">
                        <strong>{item.menu_name}</strong>
                        <span>{getTenantName(item.tenant_id)}</span>
                        <span>{formatRupiah(item.price * item.orderQuantity)}</span>
                      </div>
                      <div className="quantity-control">
                        <button type="button" onClick={() => changeQuantity(item.menu_id, -1)} aria-label={`Decrease ${item.menu_name}`}>−</button>
                        <span>{item.orderQuantity}</span>
                        <button type="button" disabled={item.orderQuantity >= item.quantity} onClick={() => changeQuantity(item.menu_id, 1)} aria-label={`Increase ${item.menu_name}`}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cart-total"><span>Total</span><strong>{formatRupiah(totalPrice)}</strong></div>
              </>
            )}
            <button className="primary-button" type="button" onClick={() => setCartOpen(false)}>Continue shopping</button>
          </section>
        </div>
      )}

      {checkoutOpen && (
        <div className="modal-backdrop" onClick={() => { if (!checkoutLoading) setCheckoutOpen(false) }}>
          <section className="dialog checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" type="button" disabled={checkoutLoading} onClick={() => setCheckoutOpen(false)} aria-label="Close checkout">×</button>
            <span className="eyebrow">FINAL STEP</span>
            <h2 id="checkout-title">Checkout</h2>
            <p className="dialog-description">Masukkan data pelanggan untuk menyelesaikan pemesanan. NIM tidak diperlukan.</p>
            <form onSubmit={submitCheckout}>
              <div className="checkout-form-fields">
                <label htmlFor="customer-name">Nama pelanggan</label>
                <input id="customer-name" name="customerName" type="text" autoComplete="name" maxLength={100} required value={customerName} disabled={checkoutLoading} onChange={(event) => setCustomerName(event.target.value)} placeholder="Masukkan nama lengkap" />
                <label htmlFor="customer-phone">Nomor telepon</label>
                <input id="customer-phone" name="customerPhone" type="tel" autoComplete="tel" maxLength={20} required value={customerPhone} disabled={checkoutLoading} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Contoh: 081234567890" />
              </div>
              <ScheduleField value={schedule} onChange={setSchedule} disabled={checkoutLoading} />
              <div className="cart-total"><span>Total pesanan</span><strong>{formatRupiah(totalPrice)}</strong></div>
              <p className="dialog-description">Pembayaran QRIS ini hanya simulasi. Pesanan akan dibuat terlebih dahulu dengan status pembayaran pending.</p>
              {checkoutError && <p role="alert" className="form-error">{checkoutError}</p>}
              <button className="primary-button" type="submit" disabled={checkoutLoading || cart.length === 0}>
                {checkoutLoading ? 'Menyimpan pesanan...' : 'Buat Pesanan'}
              </button>
            </form>
          </section>
        </div>
      )}

      {checkoutResult && (
        <div className="modal-backdrop payment-backdrop">
          <section className="dialog payment-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-title">
            {!paymentCompleted ? (
              <>
                <span className="eyebrow">EKUT DEMO PAYMENT</span>
                <h2 id="payment-title">Scan QRIS untuk Membayar</h2>
                <p className="dialog-description">Ini adalah simulasi pembayaran untuk demo EKUT.</p>
                <div className="demo-qr">
                  <QRCodeSVG
                    value={JSON.stringify({
                      type: 'EKUT_DEMO_PAYMENT',
                      orderIds: checkoutResult.orders.map((order) => order.orderId),
                      totalAmount: checkoutResult.totalAmount,
                    })}
                    size={200}
                    level="M"
                    includeMargin
                  />
                </div>
                <p className="demo-warning">DEMO ONLY — bukan QRIS pembayaran asli.</p>
                <div className="cart-total"><span>Total pembayaran</span><strong>{formatRupiah(checkoutResult.totalAmount)}</strong></div>
                <div className="cart-items">
                  {checkoutResult.orders.map((order) => {
                    const tenant = tenants.find((item) => item.tenant_id === order.tenantId)
                    return (
                      <div className="cart-row" key={order.orderId}>
                        <div className="menu-detail">
                          <strong>{order.orderNumber}</strong>
                          <span>{tenant?.tenant_name ?? 'Tenant EKUT'}</span>
                          <span>{formatRupiah(order.totalAmount)}</span>
                          <span>Status pembayaran: {order.paymentStatus}</span>
                          <span>Waktu pesan: {order.scheduledTime ? `Pukul ${order.scheduledTime}` : 'Saat ini'}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {paymentError && <p role="alert" className="form-error">{paymentError}</p>}
                <button className="primary-button" type="button" disabled={paymentLoading} onClick={simulatePayment}>
                  {paymentLoading ? 'Memproses pembayaran...' : 'Simulasikan Scan QRIS'}
                </button>
              </>
            ) : (
              <>
                <span className="dialog-icon" aria-hidden="true">✓</span>
                <span className="eyebrow">PAYMENT SUCCESS</span>
                <h2 id="payment-title">Pembayaran Simulasi Berhasil!</h2>
                <p className="dialog-description">Pembayaran demo telah dikonfirmasi oleh sistem EKUT. Tidak ada transaksi uang sungguhan.</p>
                <div className="cart-total"><span>Total pembayaran (simulasi)</span><strong>{formatRupiah(checkoutResult.totalAmount)}</strong></div>
                <div className="cart-items">
                  {checkoutResult.orders.map((order) => {
                    const tenant = tenants.find((item) => item.tenant_id === order.tenantId)
                    return (
                      <div className="cart-row" key={order.orderId}>
                        <div className="menu-detail">
                          {order.queueNumber && <span className="cx-queue-badge" aria-label={`Nomor antrian ${order.queueNumber}`}>Antrian {order.queueNumber}</span>}
                          <strong>{order.orderNumber}</strong>
                          <span>No. riwayat pesanan</span>
                          <span>{tenant?.tenant_name ?? 'Tenant EKUT'}</span>
                          <span>{formatRupiah(order.totalAmount)}</span>
                          <span>Waktu pesan: {order.scheduledTime ? `Pukul ${order.scheduledTime}` : 'Saat ini'}</span>
                          <span>Status pembayaran: paid (simulasi)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button className="primary-button" type="button" onClick={downloadReceipt}>
                  Download Struk PDF
                </button>
                <button className="primary-button" type="button" onClick={closePaymentResult}>Selesai</button>
              </>
            )}
          </section>
        </div>
      )}
      {loginOpen && (
        <OtpLoginDialog
          apiUrl={API_URL}
          onClose={() => setLoginOpen(false)}
          onLoggedIn={(auth) => {
            saveCustomerAuth(auth)
            setCustomerAuth(auth)
            setLoginOpen(false)
            setMessage(`Halo, ${auth.name || auth.phone}! Kamu sudah masuk.`)
          }}
        />
      )}
      {historyOpen && customerAuth && (
        <OrderHistoryDialog
          apiUrl={API_URL}
          auth={customerAuth}
          onClose={() => setHistoryOpen(false)}
          onSessionExpired={() => {
            clearCustomerAuth()
            setCustomerAuth(null)
            setHistoryOpen(false)
            setLoginOpen(true)
          }}
        />
      )}
      {ratingsDialog && (
        <RatingsDialog
          apiUrl={API_URL}
          tenantId={ratingsDialog.tenantId}
          tenantName={ratingsDialog.tenantName}
          initialMenuId={ratingsDialog.menuId}
          onClose={() => setRatingsDialog(null)}
        />
      )}
      {message && (
        <div className="toast-message" role="status">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} aria-label="Close message">×</button>
        </div>
      )}
    </main>
  )
}

function App() {
  const path = window.location.pathname

  if (path === '/login') {
    return <LoginPage />
  }

  if (path === '/admin') {
    const token = sessionStorage.getItem('ekut_token')
    const storedUser = sessionStorage.getItem('ekut_user')

    if (!token || !storedUser) {
      window.location.replace('/login')
      return null
    }

    try {
      const user = JSON.parse(storedUser)

      if (user.role !== 'admin') {
        window.location.replace('/login')
        return null
      }
    } catch {
      window.location.replace('/login')
      return null
    }

    return <AdminDashboard />
  }

  if (path === '/tenant') {
    const token = sessionStorage.getItem('ekut_token')
    const storedUser = sessionStorage.getItem('ekut_user')

    if (!token || !storedUser) {
      window.location.replace('/login')
      return null
    }

    try {
      const user = JSON.parse(storedUser)

      if (user.role !== 'tenant' || !user.tenantId) {
        window.location.replace('/login')
        return null
      }
    } catch {
      window.location.replace('/login')
      return null
    }

    return <TenantDashboard />
  }

  return <CustomerApp />
}

export default App
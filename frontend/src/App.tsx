import AdminDashboard from '../pages/AdminDashboard'
import LoginPage from './LoginPage'
import { QRCodeSVG } from 'qrcode.react'
import { jsPDF } from 'jspdf'
import { useEffect, useMemo, useState } from 'react'
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
}

type CartItem = MenuItem & { orderQuantity: number }

type CheckoutOrder = {
  orderId: number
  orderNumber: string
  tenantId: number
  totalAmount: number
  paymentStatus: string
}

type CheckoutResult = {
  totalAmount: number
  orders: CheckoutOrder[]
}

const API_URL = 'http://localhost:3000'

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

  useEffect(() => {
    const controller = new AbortController()

    async function fetchTenants() {
      try {
        const response = await fetch(`${API_URL}/api/tenants`, {
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
        }) => {
          const tenantId = Number(tenant.tenant_id)
          return {
            tenant_id: tenantId,
            tenant_name: tenant.tenant_name,
            profile_photo: tenant.profile_photo,
            ...(tenantPresentation[tenantId] ?? { category: 'Kantin', emoji: '🍽️' }),
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
  }, [])

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

  function addToCart(menu: MenuItem) {
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
      setCheckoutOpen(true)
    }
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (checkoutLoading || cart.length === 0) return

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
          `Nomor pesanan: ${order.orderNumber}`,
          `Tenant: ${tenant?.tenant_name ?? `Tenant ${order.tenantId}`}`,
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
            {tenantLoading && <p role="status">Memuat daftar tenant...</p>}
            {tenantError && <p role="alert">{tenantError}</p>}
            {!tenantLoading && !tenantError && tenants.length === 0 && <p>Belum ada tenant yang tersedia.</p>}
            <div className="tenant-grid">
              {tenants.map((tenant, index) => (
                <button
                  className={`tenant-card ${index % 2 === 0 ? 'blue' : 'orange'}`}
                  key={tenant.tenant_id}
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
                    <span className="tenant-link">Explore menu →</span>
                  </span>
                </button>
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
              {cart.length > 0 && (
                <p>Keranjang kamu berisi {totalItems} item dari {new Set(cart.map((item) => item.tenant_id)).size} tenant.</p>
              )}
            </div>
          </div>
          {menuLoading && <p role="status">Memuat menu...</p>}
          {menuError && <p role="alert">{menuError}</p>}
          {!menuLoading && !menuError && menus.length === 0 && <p>Belum ada menu yang tersedia untuk tenant ini.</p>}
          <div className="menu-grid">
            {menus
              .filter((menu) => menu.tenant_id === selectedTenant.tenant_id && menu.status === 'available' && menu.quantity > 0)
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
                      <p>{menu.description}</p>
                      <strong>{formatRupiah(menu.price)}</strong>
                      <span className="stock-label">Stock: {remainingStock}</span>
                    </div>
                    <button className="add-button" type="button" disabled={remainingStock <= 0} onClick={() => addToCart(menu)}>+ Add</button>
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
                          <strong>{order.orderNumber}</strong>
                          <span>{tenant?.tenant_name ?? 'Tenant EKUT'}</span>
                          <span>{formatRupiah(order.totalAmount)}</span>
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

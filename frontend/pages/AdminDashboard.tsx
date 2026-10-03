import { useEffect, useMemo, useState } from 'react'

import './AdminDashboard.css'

import proofTenant1 from '../src/assets/proof_tenant_1.png'
import proofTenant2 from '../src/assets/proof_tenant_2.png'
import proofTenant4 from '../src/assets/proof_tenant_4.png'
import proofTenant6 from '../src/assets/proof_tenant_6.png'




const API_URL = 'http://localhost:3000'



type Tenant = {

  tenant_id: number

  tenant_name: string

  phone?: string | null

  profile_photo?: string | null

  status: string

  username?: string | null

  bank_name?: string | null

  bank_account?: string | null

}



type AdminUser = {

  username?: string

  role?: string

}



type DashboardStats = {

  totalSales: number

  paidPayments: number

  totalTransactions: number

  totalTenants: number

  activeTenants: number

  rentalPayments: number

}



type Transaction = {

  order_id: number

  order_number: string

  order_date: string

  order_status: string

  total_amount: number | string

  customer_name: string

  customer_phone: string

  tenant_name: string

  payment_method: string | null

  payment_status: string | null

  payment_date: string | null

  payment_reference: string | null

  payment_amount: number | string | null

}



type TenantIncome = {

  tenant_id: number

  tenant_name: string

  bank_name: string | null

  bank_account: string | null

  total_income: number

  paid_orders: number

  total_transferred: number

  outstanding_balance: number

}



type RentalPayment = {
  rental_id: number
  tenant_id: number
  tenant_name: string
  rental_period: string
  due_date: string
  amount: number | string
  payment_date: string | null
  payment_proof: string | null
  status: string
}

type ReportTenant = {
  tenant_id: number
  tenant_name: string
  period_income: number
  paid_orders: number
  total_income: number
  total_transferred: number
  outstanding_balance: number
}

type ReportData = {
  startDate: string
  endDate: string
  tenants: ReportTenant[]
  summary: {
    periodIncome: number
    paidOrders: number
    totalIncome: number
    totalTransferred: number
    outstandingBalance: number
  }
}

type ApiResponse<T> = {

  status?: string

  data?: T

  message?: string

}



function formatRupiah(value: number): string {

  return `Rp ${value.toLocaleString('id-ID')}`

}



function formatDate(value: string | null | undefined): string {

  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('id-ID', {

    day: '2-digit',

    month: 'short',

    year: 'numeric',

  })

}

const rentalProofImages: Record<string, string> = {
  'proof_tenant_1.jpg': proofTenant1,
  'proof_tenant_1.png': proofTenant1,
  'proof_tenant_2.jpg': proofTenant2,
  'proof_tenant_2.png': proofTenant2,
  'proof_tenant_4.jpg': proofTenant4,
  'proof_tenant_4.png': proofTenant4,
  'proof_tenant_6.jpg': proofTenant6,
  'proof_tenant_6.png': proofTenant6,
}

function AdminDashboard() {

  const [tenants, setTenants] = useState<Tenant[]>([])

  const [loadingTenants, setLoadingTenants] = useState(true)

  const [tenantError, setTenantError] = useState('')

  const [stats, setStats] = useState<DashboardStats | null>(null)

  const [loadingStats, setLoadingStats] = useState(true)

  const [statsError, setStatsError] = useState('')

  const [transactions, setTransactions] = useState<Transaction[]>([])

  const [loadingTransactions, setLoadingTransactions] = useState(true)

  const [transactionError, setTransactionError] = useState('')

  const [incomeRows, setIncomeRows] = useState<TenantIncome[]>([])

  const [loadingIncome, setLoadingIncome] = useState(false)

  const [incomeError, setIncomeError] = useState('')

  const [incomeMessage, setIncomeMessage] = useState('')

  const [incomeTenantFilter, setIncomeTenantFilter] = useState('all')
  const [tenantIncomeStartDate, setTenantIncomeStartDate] = useState('')
  const [tenantIncomeEndDate, setTenantIncomeEndDate] = useState('')

  const [transactionView, setTransactionView] = useState<'transactions' | 'income'>('transactions')

  const [transferTenantId, setTransferTenantId] = useState('')

  const [transferAmount, setTransferAmount] = useState('')

  const [transferReference, setTransferReference] = useState('')

  const [savingTransfer, setSavingTransfer] = useState(false)

  const [activeMenu, setActiveMenu] = useState('Overview')

  const [admin, setAdmin] = useState<AdminUser | null>(null)

  const [updatingTenantId, setUpdatingTenantId] = useState<number | null>(null)

  const [tenantActionMessage, setTenantActionMessage] = useState('')

  const [rentalPayments, setRentalPayments] = useState<RentalPayment[]>([])
  const [loadingRentalPayments, setLoadingRentalPayments] = useState(false)
  const [rentalPaymentError, setRentalPaymentError] = useState('')
  const [verifyingRentalPaymentId, setVerifyingRentalPaymentId] = useState<number | null>(null)
  const [rentalProofModal, setRentalProofModal] = useState<{ src: string; title: string } | null>(null)
  const [rentalStatusFilter, setRentalStatusFilter] = useState('all')
  const [rentalPeriodFilter, setRentalPeriodFilter] = useState('all')
  const [reportStartDate, setReportStartDate] = useState('2026-10-01')
  const [reportEndDate, setReportEndDate] = useState('2026-10-15')
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loadingReports, setLoadingReports] = useState(false)
  const [reportError, setReportError] = useState('')
  const [reportTenantFilter, setReportTenantFilter] = useState('all')




  const filteredIncomeRows = useMemo(

    () => incomeTenantFilter === 'all'

      ? incomeRows

      : incomeRows.filter((row) => String(row.tenant_id) === incomeTenantFilter),

    [incomeRows, incomeTenantFilter],

  )



  const selectedTransferTenant = incomeRows.find(

    (row) => String(row.tenant_id) === transferTenantId,

  ) ?? null



  async function loadTenantIncome(startDate = tenantIncomeStartDate, endDate = tenantIncomeEndDate) {

    setLoadingIncome(true)

    setIncomeError('')

    try {

      const token = sessionStorage.getItem('ekut_token')

      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      const query = params.toString()
      const response = await fetch(`${API_URL}/api/admin/tenant-income${query ? `?${query}` : ''}`, {

        headers: token ? { Authorization: `Bearer ${token}` } : {},

      })

      const result = (await response.json()) as ApiResponse<TenantIncome[]>

      if (!response.ok || result.status !== 'success' || !Array.isArray(result.data)) {

        throw new Error(result.message || 'Gagal mengambil rekap pendapatan tenant.')

      }

      setIncomeRows(result.data)

    } catch (error) {

      setIncomeError(error instanceof Error ? error.message : 'Gagal mengambil rekap pendapatan tenant.')

    } finally {

      setLoadingIncome(false)

    }

  }



  const rentalTotals = useMemo(() => rentalPayments.reduce((totals, row) => {
    const amount = Number(row.amount) || 0
    const status = (row.status || 'pending').toLowerCase()
    totals.total += amount
    if (status === 'paid') totals.paid += amount
    else if (status === 'overdue') totals.overdue += amount
    else totals.pending += amount
    return totals
  }, { total: 0, paid: 0, pending: 0, overdue: 0 }), [rentalPayments])

  const rentalPeriods = useMemo(
    () => Array.from(new Set(rentalPayments.map((row) => row.rental_period))).sort().reverse(),
    [rentalPayments],
  )

  const filteredRentalPayments = useMemo(() => rentalPayments.filter((row) => {
    const status = (row.status || 'pending').toLowerCase()
    const matchesStatus = rentalStatusFilter === 'all' || status === rentalStatusFilter
    const matchesPeriod = rentalPeriodFilter === 'all' || row.rental_period === rentalPeriodFilter
    return matchesStatus && matchesPeriod
  }), [rentalPayments, rentalStatusFilter, rentalPeriodFilter])

  const filteredReportTenants = useMemo(
    () => (reportData?.tenants ?? []).filter((row) => reportTenantFilter === 'all' || String(row.tenant_id) === reportTenantFilter),
    [reportData, reportTenantFilter],
  )

  async function loadRentalPayments() {
    setLoadingRentalPayments(true)
    setRentalPaymentError('')
    try {
      const token = sessionStorage.getItem('ekut_token')
      if (!token) throw new Error('Sesi login tidak ditemukan. Silakan login kembali.')
      const response = await fetch(`${API_URL}/api/admin/rental-payments`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = (await response.json()) as ApiResponse<RentalPayment[]>
      if (!response.ok || result.status !== 'success' || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Gagal mengambil data pembayaran sewa.')
      }
      setRentalPayments(result.data)
    } catch (error) {
      setRentalPaymentError(error instanceof Error ? error.message : 'Gagal mengambil data pembayaran sewa.')
    } finally {
      setLoadingRentalPayments(false)
    }
  }

  async function verifyRentalPayment(rentalId: number) {
    setVerifyingRentalPaymentId(rentalId)
    setRentalPaymentError('')
    try {
      const token = sessionStorage.getItem('ekut_token')
      if (!token) throw new Error('Sesi login tidak ditemukan. Silakan login kembali.')
      const response = await fetch(`${API_URL}/api/admin/rental-payments/${rentalId}/verify`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = (await response.json()) as ApiResponse<unknown>
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Pembayaran sewa gagal dikonfirmasi.')
      }
      await loadRentalPayments()
    } catch (error) {
      setRentalPaymentError(error instanceof Error ? error.message : 'Pembayaran sewa gagal dikonfirmasi.')
    } finally {
      setVerifyingRentalPaymentId(null)
    }
  }

  async function loadReports() {
    setLoadingReports(true)
    setReportError('')
    try {
      const token = sessionStorage.getItem('ekut_token')
      if (!token) throw new Error('Sesi login tidak ditemukan. Silakan login kembali.')
      const params = new URLSearchParams({ startDate: reportStartDate, endDate: reportEndDate })
      const response = await fetch(`${API_URL}/api/admin/reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = (await response.json()) as ApiResponse<ReportData>
      if (!response.ok || result.status !== 'success' || !result.data || !Array.isArray(result.data.tenants)) {
        throw new Error(result.message || 'Gagal mengambil laporan.')
      }
      setReportData(result.data)
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Gagal mengambil laporan.')
      setReportData(null)
    } finally {
      setLoadingReports(false)
    }
  }

  function exportReportCsv() {
    if (!reportData) return
    const rows = [
      ['Tenant ID', 'Tenant', 'Pendapatan periode', 'Pesanan paid', 'Total pendapatan', 'Total ditransfer', 'Saldo terutang'],
      ...filteredReportTenants.map((row) => [
        row.tenant_id,
        row.tenant_name,
        row.period_income,
        row.paid_orders,
        row.total_income,
        row.total_transferred,
        row.outstanding_balance,
      ]),
    ]
    const csv = rows.map((row) => row.map((value) => {
      const text = String(value ?? '')
      return `"${text.replace(/"/g, '""')}"`
    }).join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ekut-report-${reportStartDate}-to-${reportEndDate}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {

    const storedUser = sessionStorage.getItem('ekut_user')

    if (storedUser) {

      try {

        setAdmin(JSON.parse(storedUser) as AdminUser)

      } catch {

        setAdmin(null)

      }

    }

  }, [])



  useEffect(() => {

    let cancelled = false



    async function fetchTenants() {

      setLoadingTenants(true)

      setTenantError('')

      try {

        const token = sessionStorage.getItem('ekut_token')

        const response = await fetch(`${API_URL}/api/admin/tenants`, {

          headers: token ? { Authorization: `Bearer ${token}` } : {},

        })

        const result = (await response.json()) as ApiResponse<Tenant[]>

        if (!response.ok || result.status !== 'success' || !Array.isArray(result.data)) {

          throw new Error(result.message || 'Gagal mengambil data tenant.')

        }

        if (!cancelled) setTenants(result.data)

      } catch (error) {

        if (!cancelled) setTenantError(error instanceof Error ? error.message : 'Terjadi kesalahan saat mengambil data tenant.')

      } finally {

        if (!cancelled) setLoadingTenants(false)

      }

    }



    async function fetchStats() {

      setLoadingStats(true)

      setStatsError('')

      try {

        const token = sessionStorage.getItem('ekut_token')

        const response = await fetch(`${API_URL}/api/admin/dashboard-stats`, {

          headers: token ? { Authorization: `Bearer ${token}` } : {},

        })

        const result = (await response.json()) as ApiResponse<DashboardStats>

        if (!response.ok || result.status !== 'success' || !result.data) {

          throw new Error(result.message || 'Gagal mengambil statistik dashboard.')

        }

        if (!cancelled) setStats(result.data)

      } catch (error) {

        if (!cancelled) setStatsError(error instanceof Error ? error.message : 'Gagal mengambil statistik dashboard.')

      } finally {

        if (!cancelled) setLoadingStats(false)

      }

    }



    async function fetchTransactions() {

      setLoadingTransactions(true)

      setTransactionError('')

      try {

        const token = sessionStorage.getItem('ekut_token')

        const response = await fetch(`${API_URL}/api/admin/transactions`, {

          headers: token ? { Authorization: `Bearer ${token}` } : {},

        })

        const result = (await response.json()) as ApiResponse<Transaction[]>

        if (!response.ok || result.status !== 'success' || !Array.isArray(result.data)) {

          throw new Error(result.message || 'Gagal mengambil data transaksi.')

        }

        if (!cancelled) setTransactions(result.data)

      } catch (error) {

        if (!cancelled) setTransactionError(error instanceof Error ? error.message : 'Terjadi kesalahan saat mengambil transaksi.')

      } finally {

        if (!cancelled) setLoadingTransactions(false)

      }

    }



    void fetchTenants()

    void fetchStats()

    void fetchTransactions()



    return () => {

      cancelled = true

    }

  }, [])



  useEffect(() => {
    if (activeMenu === 'Rental Payments') void loadRentalPayments()
    if (activeMenu === 'Reports' && !reportData) void loadReports()
  }, [activeMenu])

  useEffect(() => {

    if (activeMenu === 'Transactions' && transactionView === 'income') {

      void loadTenantIncome()

    }

  }, [activeMenu, transactionView])



  const activeTenants = tenants.filter((tenant) => tenant.status?.toLowerCase() === 'active').length



  function logout() {

    sessionStorage.removeItem('ekut_token')

    sessionStorage.removeItem('ekut_user')

    window.location.href = '/login'

  }



  async function toggleTenantStatus(tenant: Tenant) {

    const nextStatus = tenant.status.toLowerCase() === 'active' ? 'inactive' : 'active'

    const actionLabel = nextStatus === 'active' ? 'mengaktifkan' : 'menonaktifkan'

    if (!window.confirm(`Apakah kamu yakin ingin ${actionLabel} tenant "${tenant.tenant_name}"?`)) return



    setUpdatingTenantId(tenant.tenant_id)

    setTenantActionMessage('')

    setTenantError('')

    try {

      const token = sessionStorage.getItem('ekut_token')

      if (!token) throw new Error('Sesi login tidak ditemukan. Silakan login kembali.')

      const response = await fetch(`${API_URL}/api/admin/tenants/${tenant.tenant_id}/status`, {

        method: 'PATCH',

        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },

        body: JSON.stringify({ status: nextStatus }),

      })

      const result = (await response.json()) as ApiResponse<{ tenantId: number; status: string }>

      if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Gagal mengubah status tenant.')



      setTenants((current) => current.map((item) => item.tenant_id === tenant.tenant_id ? { ...item, status: nextStatus } : item))

      setTenantActionMessage(`${tenant.tenant_name} berhasil ${nextStatus === 'active' ? 'diaktifkan' : 'dinonaktifkan'}.`)

      setStats((current) => current ? {

        ...current,

        activeTenants: Math.max(0, current.activeTenants + (nextStatus === 'active' ? 1 : -1)),

      } : current)

    } catch (error) {

      setTenantError(error instanceof Error ? error.message : 'Terjadi kesalahan saat mengubah status tenant.')

    } finally {

      setUpdatingTenantId(null)

    }

  }



  async function submitTransfer(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault()

    setIncomeMessage('')

    setIncomeError('')



    if (!selectedTransferTenant) {

      setIncomeError('Pilih tenant terlebih dahulu.')

      return

    }



    const amount = Number(transferAmount)

    if (!Number.isFinite(amount) || amount <= 0) {

      setIncomeError('Masukkan nominal transfer yang valid.')

      return

    }



    if (amount > selectedTransferTenant.outstanding_balance) {

      setIncomeError('Nominal transfer tidak boleh melebihi saldo terutang tenant.')

      return

    }



    if (!window.confirm(`Pastikan transfer Rp ${amount.toLocaleString('id-ID')} kepada ${selectedTransferTenant.tenant_name} sudah benar-benar dilakukan melalui bank. Catat transfer ini sebagai completed?`)) {

      return

    }



    setSavingTransfer(true)

    try {

      const token = sessionStorage.getItem('ekut_token')

      if (!token) throw new Error('Sesi login tidak ditemukan. Silakan login kembali.')

      const response = await fetch(`${API_URL}/api/admin/transfers`, {

        method: 'POST',

        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },

        body: JSON.stringify({

          tenantId: selectedTransferTenant.tenant_id,

          amount,

          referenceNumber: transferReference.trim() || null,

        }),

      })

      const result = (await response.json()) as ApiResponse<{ transferId: number }>

      if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Gagal mencatat transfer.')



      setIncomeMessage('Transfer berhasil dicatat. Rekap saldo diperbarui.')

      setTransferAmount('')

      setTransferReference('')

      await loadTenantIncome()

    } catch (error) {

      setIncomeError(error instanceof Error ? error.message : 'Terjadi kesalahan saat mencatat transfer.')

    } finally {

      setSavingTransfer(false)

    }

  }



  const menuItems = [

    { label: 'Overview', icon: '◫' },

    { label: 'Tenants', icon: '▤' },

    { label: 'Transactions', icon: '↔' },

    { label: 'Rental Payments', icon: '▣' },

    { label: 'Reports', icon: '▥' },

  ]



  return (

    <div className="admin-layout">

      <aside className="admin-sidebar">

        <a className="admin-brand" href="/">

          <span className="admin-brand-icon">E</span>

          <span><strong>E-KUT</strong><small>MANAGEMENT SYSTEM</small></span>

        </a>



        <div className="admin-profile">

          <div className="admin-avatar">A</div>

          <div><strong>{admin?.username || 'Administrator'}</strong><span>System Administrator</span></div>

        </div>



        <p className="admin-nav-label">MAIN MENU</p>

        <nav className="admin-nav">

          {menuItems.map((item) => (

            <button key={item.label} type="button" className={activeMenu === item.label ? 'active' : ''} onClick={() => setActiveMenu(item.label)}>

              <span className="admin-nav-icon">{item.icon}</span>{item.label}

              {activeMenu === item.label && <span className="admin-nav-indicator" />}

            </button>

          ))}

        </nav>



        <div className="admin-sidebar-bottom">

          <div className="admin-help"><span>💙</span><strong>Need assistance?</strong><p>Manage your campus canteen in one place.</p></div>

          <button className="admin-logout" type="button" onClick={logout}><span>↪</span>Logout</button>

        </div>

      </aside>



      <main className="admin-main">

        <header className="admin-topbar">

          <div><p className="admin-breadcrumb">E-KUT / Management</p><h1>{activeMenu}</h1></div>

          
<div className="admin-topbar-right">
  <div className="admin-date">
    <span>◷</span>
    <span>
      {new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}
    </span>
  </div>

  <div className="admin-topbar-avatar">A</div>

  <button
    type="button"
    className="admin-topbar-logout"
    onClick={logout}
    aria-label="Logout dari akun admin"
  >
    <span aria-hidden="true">↪</span>
    <span>Logout</span>
  </button>
</div>
        </header>



        {activeMenu === 'Overview' ? (

          <>

            <section className="admin-welcome">

              <div><p className="admin-eyebrow">ADMINISTRATION</p><h2>Welcome back, {admin?.username || 'Admin'}! 👋</h2><p>Monitor your campus canteen operations from one convenient dashboard.</p></div>

              <div className="admin-welcome-icon">🏪</div>

            </section>

            {statsError && <div className="admin-error" role="alert">Statistik: {statsError}</div>}

            <section className="admin-stat-grid">

              <article className="admin-stat-card"><div className="admin-stat-top"><span>Total Sales</span><span className="stat-icon blue">↗</span></div><strong>{loadingStats ? 'Memuat...' : stats ? formatRupiah(stats.totalSales) : '—'}</strong><p>Paid payments only</p></article>

              <article className="admin-stat-card"><div className="admin-stat-top"><span>Total Transactions</span><span className="stat-icon orange">▤</span></div><strong>{loadingStats ? 'Memuat...' : stats ? stats.totalTransactions.toLocaleString('id-ID') : '—'}</strong><p>Transactions with paid payments</p></article>

              <article className="admin-stat-card"><div className="admin-stat-top"><span>Active Tenants</span><span className="stat-icon green">⌂</span></div><strong>{loadingTenants ? 'Memuat...' : stats ? stats.activeTenants : activeTenants}</strong><p>{stats ? `${stats.totalTenants} registered tenants` : 'Currently active tenants'}</p></article>

              <article className="admin-stat-card"><div className="admin-stat-top"><span>Rental Payment Records</span><span className="stat-icon purple">▣</span></div><strong>{loadingStats ? 'Memuat...' : stats ? stats.rentalPayments.toLocaleString('id-ID') : '—'}</strong><p>Records in rental payments table</p></article>

            </section>

            <section className="admin-content-card">

              <div className="admin-section-heading"><div><h3>Tenant Directory</h3><p>Overview of registered campus tenants</p></div><button type="button" className="admin-outline-button" onClick={() => setActiveMenu('Tenants')}>View all tenants →</button></div>

              {tenantError && <div className="admin-error" role="alert">{tenantError}</div>}

              {loadingTenants ? <div className="admin-empty">Loading tenants...</div> : tenants.length === 0 ? <div className="admin-empty">No tenant data is available.</div> : (

                <div className="admin-table-wrap"><table className="admin-table">

                  <thead><tr><th>Tenant</th><th>Contact</th><th>Status</th></tr></thead>

                  <tbody>{tenants.slice(0, 6).map((tenant) => <tr key={tenant.tenant_id}>

                    <td><div className="tenant-cell">{tenant.profile_photo ? <img src={tenant.profile_photo} alt={`${tenant.tenant_name} profile`} /> : <span className="tenant-placeholder">{tenant.tenant_name.charAt(0).toUpperCase()}</span>}<div><strong>{tenant.tenant_name}</strong><small>Tenant #{tenant.tenant_id}</small></div></div></td>

                    <td>{tenant.phone || '—'}</td><td><span className={`tenant-status ${tenant.status?.toLowerCase() === 'active' ? 'status-active' : 'status-inactive'}`}>{tenant.status || 'Unknown'}</span></td>

                  </tr>)}</tbody>

                </table></div>

              )}

            </section>

            <footer className="admin-footer">E-KUT · E-Kantin Universitas Terbuka</footer>

          </>

        ) : activeMenu === 'Tenants' ? (

          <section className="admin-content-card">

            <div className="admin-section-heading"><div><h3>Tenant Management</h3><p>Manage registered campus tenants and account status.</p></div></div>

            {tenantError && <div className="admin-error" role="alert">{tenantError}</div>}

            {tenantActionMessage && <div role="status" className="admin-success">{tenantActionMessage}</div>}

            {loadingTenants ? <div className="admin-empty">Loading tenants...</div> : tenants.length === 0 ? <div className="admin-empty">No tenant data is available.</div> : (

              <div className="admin-table-wrap"><table className="admin-table">

                <thead><tr><th>Tenant</th><th>Contact</th><th>Username</th><th>Status</th><th>Action</th></tr></thead>

                <tbody>{tenants.map((tenant) => {

                  const isActive = tenant.status?.toLowerCase() === 'active'

                  const isUpdating = updatingTenantId === tenant.tenant_id

                  return <tr key={tenant.tenant_id}>

                    <td><div className="tenant-cell">{tenant.profile_photo ? <img src={tenant.profile_photo} alt={`${tenant.tenant_name} profile`} /> : <span className="tenant-placeholder">{tenant.tenant_name.charAt(0).toUpperCase()}</span>}<div><strong>{tenant.tenant_name}</strong><small>Tenant #{tenant.tenant_id}</small></div></div></td>

                    <td>{tenant.phone || '—'}</td><td>{tenant.username || '—'}</td>

                    <td><span className={`tenant-status ${isActive ? 'status-active' : 'status-inactive'}`}>{tenant.status}</span></td>

                    <td><button type="button" className={isActive ? 'admin-outline-button' : 'admin-primary-button'} disabled={isUpdating} onClick={() => void toggleTenantStatus(tenant)}>{isUpdating ? 'Updating...' : isActive ? 'Deactivate' : 'Activate'}</button></td>

                  </tr>

                })}</tbody>

              </table></div>

            )}

          </section>

        ) : activeMenu === 'Transactions' ? (

          <section className="admin-content-card">

            <div className="admin-section-heading">

              <div><h3>Transaction Management</h3><p>View customer orders, payment statuses, and tenant income.</p></div>

              <span>{transactions.length} records</span>

            </div>

            <div className="admin-view-switch">

              <button type="button" className={transactionView === 'transactions' ? 'admin-primary-button' : 'admin-outline-button'} onClick={() => setTransactionView('transactions')}>Transactions</button>

              <button type="button" className={transactionView === 'income' ? 'admin-primary-button' : 'admin-outline-button'} onClick={() => setTransactionView('income')}>Tenant Income &amp; Transfer</button>

            </div>



            {transactionView === 'transactions' ? (

              <>

                {transactionError && <div className="admin-error" role="alert">{transactionError}</div>}

                {loadingTransactions ? <div className="admin-empty">Loading transactions...</div> : transactions.length === 0 ? <div className="admin-empty">No transaction data is available.</div> : (

                  <div className="admin-table-wrap"><table className="admin-table">

                    <thead><tr><th>Order Number</th><th>Date</th><th>Customer</th><th>Tenant</th><th>Total</th><th>Payment</th><th>Order Status</th></tr></thead>

                    <tbody>{transactions.map((transaction) => <tr key={transaction.order_id}>

                      <td><strong>{transaction.order_number}</strong></td><td>{formatDate(transaction.order_date)}</td>

                      <td><div><strong>{transaction.customer_name}</strong><small>{transaction.customer_phone}</small></div></td>

                      <td>{transaction.tenant_name}</td><td>{formatRupiah(Number(transaction.total_amount))}</td>

                      <td><span className={`tenant-status ${transaction.payment_status?.toLowerCase() === 'paid' ? 'status-active' : 'status-inactive'}`}>{transaction.payment_status || 'No payment'}</span></td>

                      <td>{transaction.order_status || '—'}</td>

                    </tr>)}</tbody>

                  </table></div>

                )}

              </>

            ) : (

              <div className="tenant-income-section">

                <div className="admin-section-heading">

                  <div><h3>Tenant Income &amp; Transfer</h3><p>Pendapatan dan transfer mengikuti rentang tanggal. Saldo terutang menampilkan saldo keseluruhan.</p></div>

                  <button type="button" className="admin-outline-button" onClick={() => void loadTenantIncome()} disabled={loadingIncome}>{loadingIncome ? 'Refreshing...' : 'Refresh data'}</button>

                </div>

                <div className="admin-income-date-filters">
                  <label htmlFor="tenant-income-start-date">Dari tanggal
                    <input
                      id="tenant-income-start-date"
                      type="date"
                      value={tenantIncomeStartDate}
                      max={tenantIncomeEndDate || undefined}
                      onChange={(event) => setTenantIncomeStartDate(event.target.value)}
                    />
                  </label>
                  <label htmlFor="tenant-income-end-date">Sampai tanggal
                    <input
                      id="tenant-income-end-date"
                      type="date"
                      value={tenantIncomeEndDate}
                      min={tenantIncomeStartDate || undefined}
                      onChange={(event) => setTenantIncomeEndDate(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-primary-button"
                    onClick={() => void loadTenantIncome()}
                    disabled={loadingIncome || Boolean(tenantIncomeStartDate && tenantIncomeEndDate && tenantIncomeStartDate > tenantIncomeEndDate)}
                  >
                    {loadingIncome ? 'Memuat...' : 'Terapkan filter'}
                  </button>
                  <button
                    type="button"
                    className="admin-outline-button"
                    onClick={() => {
                      setTenantIncomeStartDate('')
                      setTenantIncomeEndDate('')
                      void loadTenantIncome('', '')
                    }}
                    disabled={loadingIncome || (!tenantIncomeStartDate && !tenantIncomeEndDate)}
                  >
                    Hapus filter
                  </button>
                </div>

                {incomeError && <div className="admin-error" role="alert">{incomeError}</div>}

                {incomeMessage && <div className="admin-success" role="status">{incomeMessage}</div>}



                <div className="admin-stat-grid">

                  <article className="admin-stat-card"><div className="admin-stat-top"><span>Total pendapatan</span><span className="stat-icon blue">↗</span></div><strong>{formatRupiah(incomeRows.reduce((sum, row) => sum + row.total_income, 0))}</strong><p>Pembayaran lunas pada periode terpilih</p></article>

                  <article className="admin-stat-card"><div className="admin-stat-top"><span>Total ditransfer</span><span className="stat-icon green">✓</span></div><strong>{formatRupiah(incomeRows.reduce((sum, row) => sum + row.total_transferred, 0))}</strong><p>Transfer selesai pada periode terpilih</p></article>

                  <article className="admin-stat-card"><div className="admin-stat-top"><span>Saldo terutang</span><span className="stat-icon orange">!</span></div><strong>{formatRupiah(incomeRows.reduce((sum, row) => sum + row.outstanding_balance, 0))}</strong><p>Belum disetorkan ke tenant</p></article>

                </div>



                <div className="admin-income-filter">

                  <label htmlFor="income-tenant-filter">Filter tenant</label>

                  <select id="income-tenant-filter" value={incomeTenantFilter} onChange={(event) => setIncomeTenantFilter(event.target.value)}>

                    <option value="all">Semua tenant</option>

                    {incomeRows.map((row) => <option key={row.tenant_id} value={String(row.tenant_id)}>{row.tenant_name}</option>)}

                  </select>

                </div>



                {loadingIncome ? <div className="admin-empty">Memuat rekap pendapatan...</div> : (

                  <div className="admin-table-wrap"><table className="admin-table">

                    <thead><tr><th>Tenant</th><th>Pesanan paid</th><th>Total pendapatan</th><th>Sudah ditransfer</th><th>Saldo terutang</th><th>Rekening tujuan</th><th>Aksi</th></tr></thead>

                    <tbody>{filteredIncomeRows.map((row) => <tr key={row.tenant_id}>

                      <td><strong>{row.tenant_name}</strong><small>Tenant #{row.tenant_id}</small></td>

                      <td>{row.paid_orders}</td><td>{formatRupiah(row.total_income)}</td><td>{formatRupiah(row.total_transferred)}</td>

                      <td><strong>{formatRupiah(row.outstanding_balance)}</strong></td>

                      <td>{row.bank_name || 'Belum diatur'}<small>{row.bank_account || 'Rekening belum tersedia'}</small></td>

                      <td><button type="button" className="admin-outline-button" disabled={row.outstanding_balance <= 0 || !row.bank_account || !row.bank_name} onClick={() => { setTransferTenantId(String(row.tenant_id)); setTransferAmount(String(row.outstanding_balance)); setIncomeMessage('') }}>Catat transfer</button></td>

                    </tr>)}</tbody>

                  </table></div>

                )}



                <form className="admin-transfer-form" onSubmit={(event) => void submitTransfer(event)}>

                  <div className="admin-section-heading"><div><h3>Catat transfer yang sudah dilakukan</h3><p>Transfer harus dilakukan melalui bank terlebih dahulu sebelum dicatat sebagai completed.</p></div></div>

                  <div className="admin-transfer-fields">

                    <label>Tenant

                      <select required value={transferTenantId} onChange={(event) => setTransferTenantId(event.target.value)}>

                        <option value="">Pilih tenant</option>

                        {incomeRows.map((row) => <option key={row.tenant_id} value={String(row.tenant_id)}>{row.tenant_name}</option>)}

                      </select>

                    </label>

                    <label>Nominal transfer (Rp)

                      <input required type="number" min="1" step="0.01" value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} placeholder="Contoh: 150000" />

                    </label>



                    <label>Nomor referensi transfer

                    <input

                        type="text"

                        required

                        maxLength={100}

                        value={transferReference}

                        onChange={(event) => setTransferReference(event.target.value)}

                        placeholder="Masukkan nomor referensi bank"

                    />

                    </label>



                  </div>

                  {selectedTransferTenant && <p className="admin-transfer-note">Tujuan: {selectedTransferTenant.bank_name || 'Bank belum diatur'} — {selectedTransferTenant.bank_account || 'Rekening belum tersedia'}. Saldo terutang: <strong>{formatRupiah(selectedTransferTenant.outstanding_balance)}</strong>.</p>}

                  <button type="submit" className="admin-primary-button" disabled={savingTransfer || loadingIncome || !selectedTransferTenant || selectedTransferTenant.outstanding_balance <= 0 || !selectedTransferTenant.bank_account || !selectedTransferTenant.bank_name}>{savingTransfer ? 'Menyimpan...' : 'Konfirmasi & catat transfer'}</button>

                </form>

              </div>

            )}

          </section>

                ) : activeMenu === 'Rental Payments' ? (
          <section className="admin-content-card">
            <div className="admin-section-heading">
              <div><h3>Rental Payment Management</h3><p>Monitor monthly tenant rent payments and due dates.</p></div>
              <button type="button" className="admin-outline-button" onClick={() => void loadRentalPayments()} disabled={loadingRentalPayments}>{loadingRentalPayments ? 'Refreshing...' : 'Refresh data'}</button>
            </div>
            {rentalPaymentError && <div className="admin-error" role="alert">{rentalPaymentError}</div>}
            <div className="admin-stat-grid">
              <article className="admin-stat-card"><div className="admin-stat-top"><span>Total tagihan</span><span className="stat-icon blue">Rp</span></div><strong>{formatRupiah(rentalTotals.total)}</strong><p>Semua data sewa</p></article>
              <article className="admin-stat-card"><div className="admin-stat-top"><span>Sudah lunas</span><span className="stat-icon green">✓</span></div><strong>{formatRupiah(rentalTotals.paid)}</strong><p>Pembayaran berstatus paid</p></article>
              <article className="admin-stat-card"><div className="admin-stat-top"><span>Menunggu pembayaran</span><span className="stat-icon purple">◷</span></div><strong>{formatRupiah(rentalTotals.pending)}</strong><p>Pending atau belum ditentukan</p></article>
              <article className="admin-stat-card"><div className="admin-stat-top"><span>Terlambat</span><span className="stat-icon orange">!</span></div><strong>{formatRupiah(rentalTotals.overdue)}</strong><p>Pembayaran berstatus overdue</p></article>
            </div>
            <div className="admin-income-filter">
              <label htmlFor="rental-status-filter">Filter status
                <select id="rental-status-filter" value={rentalStatusFilter} onChange={(event) => setRentalStatusFilter(event.target.value)}>
                  <option value="all">Semua status</option><option value="paid">Lunas</option><option value="pending">Pending</option><option value="overdue">Terlambat</option>
                </select>
              </label>
              <label htmlFor="rental-period-filter">Periode sewa
                <select id="rental-period-filter" value={rentalPeriodFilter} onChange={(event) => setRentalPeriodFilter(event.target.value)}>
                  <option value="all">Semua periode</option>
                  {rentalPeriods.map((period) => <option key={period} value={period}>{period}</option>)}
                </select>
              </label>
            </div>
            {loadingRentalPayments ? <div className="admin-empty">Memuat pembayaran sewa...</div> : filteredRentalPayments.length === 0 ? <div className="admin-empty">Tidak ada data pembayaran sesuai filter.</div> : (
              <div className="admin-table-wrap"><table className="admin-table">
                <thead><tr><th>Tenant</th><th>Periode</th><th>Jatuh tempo</th><th>Nominal</th><th>Tanggal bayar</th><th>Status</th><th>Bukti</th><th>Aksi</th></tr></thead>
                <tbody>{filteredRentalPayments.map((row) => {
                  const status = (row.status || 'pending').toLowerCase()
                  const proofFile = row.payment_proof?.split('/').pop() || ''
                  const proofUrl = row.payment_proof?.startsWith('/uploads/')
                    ? `${API_URL}${row.payment_proof}`
                    : rentalProofImages[proofFile]
                  return <tr key={row.rental_id}>
                    <td><strong>{row.tenant_name}</strong><small>Tenant #{row.tenant_id}</small></td>
                    <td>{row.rental_period}</td><td>{formatDate(row.due_date)}</td><td>{formatRupiah(Number(row.amount) || 0)}</td>
                    <td>{formatDate(row.payment_date)}</td>
                    <td><span className={`tenant-status ${status === 'paid' ? 'status-active' : 'status-inactive'}`}>{status === 'paid' ? 'Lunas' : status === 'overdue' ? 'Terlambat' : status === 'pending' ? 'Pending' : status}</span></td>
                    <td>{proofUrl ? (
                      <button
                        type="button"
                        className="admin-rental-proof-button"
                        onClick={() => setRentalProofModal({ src: proofUrl, title: `Bukti pembayaran ${row.tenant_name} · ${row.rental_period}` })}
                      >
                        Lihat bukti
                      </button>
                    ) : row.payment_proof ? 'Bukti tidak tersedia' : '—'}</td>
                    <td>{row.payment_proof && ['pending', 'overdue'].includes(status) ? (
                      <button
                        type="button"
                        className="admin-primary-button"
                        onClick={() => void verifyRentalPayment(row.rental_id)}
                        disabled={verifyingRentalPaymentId === row.rental_id}
                      >
                        {verifyingRentalPaymentId === row.rental_id ? 'Memproses...' : 'Konfirmasi diterima'}
                      </button>
                    ) : status === 'paid' ? 'Diterima' : '—'}</td>
                  </tr>
                })}</tbody>
              </table></div>
            )}
            <p className="admin-transfer-note">Periksa foto bukti transfer sebelum memilih “Konfirmasi diterima”. Pembayaran yang dikonfirmasi akan berstatus lunas.</p>
          </section>
        ) : activeMenu === 'Reports' ? (
          <section className="admin-content-card">
            <div className="admin-section-heading">
              <div><h3>Operational & Financial Reports</h3><p>Review income, paid orders, transfers, and outstanding balances for a selected date range.</p></div>
              <button type="button" className="admin-outline-button" onClick={exportReportCsv} disabled={!reportData || loadingReports}>Export CSV</button>
            </div>
            <div className="admin-report-filters">
              <label htmlFor="report-start-date">Dari tanggal<input id="report-start-date" type="date" value={reportStartDate} max={reportEndDate} onChange={(event) => setReportStartDate(event.target.value)} /></label>
              <label htmlFor="report-end-date">Sampai tanggal<input id="report-end-date" type="date" value={reportEndDate} min={reportStartDate} onChange={(event) => setReportEndDate(event.target.value)} /></label>
              <label htmlFor="report-tenant-filter">Tenant<select id="report-tenant-filter" value={reportTenantFilter} onChange={(event) => setReportTenantFilter(event.target.value)}><option value="all">Semua tenant</option>{(reportData?.tenants ?? []).map((row) => <option key={row.tenant_id} value={String(row.tenant_id)}>{row.tenant_name}</option>)}</select></label>
              <button type="button" className="admin-primary-button" onClick={() => void loadReports()} disabled={loadingReports || !reportStartDate || !reportEndDate || reportStartDate > reportEndDate}>{loadingReports ? 'Memuat...' : 'Tampilkan laporan'}</button>
            </div>
            {reportError && <div className="admin-error" role="alert">{reportError}</div>}
            {reportData && <>
              <div className="admin-stat-grid">
                <article className="admin-stat-card"><div className="admin-stat-top"><span>Pendapatan periode</span><span className="stat-icon blue">↗</span></div><strong>{formatRupiah(reportData.summary.periodIncome)}</strong><p>{reportData.summary.paidOrders.toLocaleString('id-ID')} pesanan paid</p></article>
                <article className="admin-stat-card"><div className="admin-stat-top"><span>Total pendapatan</span><span className="stat-icon green">Rp</span></div><strong>{formatRupiah(reportData.summary.totalIncome)}</strong><p>Seluruh periode</p></article>
                <article className="admin-stat-card"><div className="admin-stat-top"><span>Total ditransfer</span><span className="stat-icon purple">✓</span></div><strong>{formatRupiah(reportData.summary.totalTransferred)}</strong><p>Transfer completed</p></article>
                <article className="admin-stat-card"><div className="admin-stat-top"><span>Saldo terutang</span><span className="stat-icon orange">!</span></div><strong>{formatRupiah(reportData.summary.outstandingBalance)}</strong><p>Pendapatan belum disetorkan</p></article>
              </div>
              <div className="admin-table-wrap"><table className="admin-table">
                <thead><tr><th>Tenant</th><th>Pendapatan periode</th><th>Pesanan lunas</th><th>Total pendapatan</th><th>Sudah ditransfer</th><th>Saldo terutang</th></tr></thead>
                <tbody>{filteredReportTenants.map((row) => <tr key={row.tenant_id}>
                  <td><strong>{row.tenant_name}</strong><small>Tenant #{row.tenant_id}</small></td>
                  <td>{formatRupiah(row.period_income)}</td><td>{row.paid_orders.toLocaleString('id-ID')}</td><td>{formatRupiah(row.total_income)}</td><td>{formatRupiah(row.total_transferred)}</td><td><strong>{formatRupiah(row.outstanding_balance)}</strong></td>
                </tr>)}</tbody>
              </table></div>
            </>}
            {!reportData && !loadingReports && !reportError && <div className="admin-empty">Pilih rentang tanggal lalu tampilkan laporan.</div>}
          </section>
        ) : (
          <section className="admin-content-card admin-placeholder-page">
            <div className="admin-placeholder-icon">✦</div><h2>{activeMenu}</h2>
            <p>This section is not connected yet.</p>
            <button type="button" className="admin-primary-button" onClick={() => setActiveMenu('Overview')}>Back to Overview</button>
          </section>
        )}

      </main>

      {rentalProofModal && (
        <div
          className="admin-rental-proof-modal"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setRentalProofModal(null)
          }}
        >
          <section className="admin-rental-proof-modal-content" role="dialog" aria-modal="true" aria-label={rentalProofModal.title}>
            <div className="admin-rental-proof-modal-heading">
              <h2>{rentalProofModal.title}</h2>
              <button type="button" onClick={() => setRentalProofModal(null)} aria-label="Tutup bukti pembayaran">Tutup</button>
            </div>
            <img src={rentalProofModal.src} alt={rentalProofModal.title} />
          </section>
        </div>
      )}

    </div>

  )

}



export default AdminDashboard

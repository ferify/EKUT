import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import './TenantDashboard.css'
import './TenantDashboardMenus.css'
import './TenantDashboardOrders.css'
import './TenantDashboardIncome.css'
import './TenantDashboardRental.css'
import { RatingsView } from '../src/App'
import proofTenant1 from '../src/assets/proof_tenant_1.png'
import proofTenant2 from '../src/assets/proof_tenant_2.png'
import proofTenant3 from '../src/assets/proof_tenant_3.png'
import proofTenant4 from '../src/assets/proof_tenant_4.png'
import proofTenant5 from '../src/assets/proof_tenant_5.png'
import proofTenant6 from '../src/assets/proof_tenant_6.png'

type TenantProfile = {
  tenant_id: number
  tenant_name: string
  phone: string | null
  bank_name: string | null
  bank_account: string | null
  profile_photo: string | null
  status: string
  username: string
}

type TenantMenu = {
  menu_id: number
  tenant_id: number
  menu_name: string
  description: string | null
  price: number | string
  quantity: number
  status: string
  photo: string | null
  category?: string | null
}

type TenantOrderItem = {
  orderItemId: number
  menuId: number
  menuName: string
  quantity: number
  price: number
  subtotal: number
}

type TenantOrder = {
  orderId: number
  orderNumber: string
  orderDate: string
  totalAmount: number
  status: string
  customer: { name: string; phone: string }
  items: TenantOrderItem[]
  queueNumber?: string | null
  scheduledTime?: string | null
  paymentStatus?: string
}

type TenantTransfer = {
  transfer_date: string | null
  amount: number | string
  bank_name: string | null
  bank_account: string | null
  status: string
  reference_number: string | null
}

type TenantIncome = {
  totalIncome: number
  paidOrders: number
  totalTransferred: number
  outstandingBalance: number
  transfers: TenantTransfer[]
}

type TenantRentalPayment = {
  rental_id: number
  tenant_id: number
  rental_period: string
  due_date: string
  amount: number | string
  payment_date: string | null
  payment_proof: string | null
  status: string | null
}

type Section = 'overview' | 'orders' | 'menus' | 'reviews' | 'income' | 'rental' | 'profile'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const rentalProofImages: Record<string, string> = {
  'proof_tenant_1.jpg': proofTenant1,
  'proof_tenant_1.png': proofTenant1,
  'proof_tenant_2.jpg': proofTenant2,
  'proof_tenant_2.png': proofTenant2,
  'proof_tenant_3.jpg': proofTenant3,
  'proof_tenant_3.png': proofTenant3,
  'proof_tenant_4.jpg': proofTenant4,
  'proof_tenant_4.png': proofTenant4,
  'proof_tenant_5.jpg': proofTenant5,
  'proof_tenant_5.png': proofTenant5,
  'proof_tenant_6.jpg': proofTenant6,
  'proof_tenant_6.png': proofTenant6,
}

const navItems: Array<{ id: Section; label: string; icon: string }> = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'orders', label: 'Manajemen Pesanan', icon: '⇄' },
  { id: 'menus', label: 'Kelola Menu', icon: '☷' },
  { id: 'reviews', label: 'Rating & Ulasan', icon: '★' },
  { id: 'income', label: 'Pendapatan', icon: '▤' },
  { id: 'rental', label: 'Pembayaran Sewa', icon: '▣' },
  { id: 'profile', label: 'Profil Tenant', icon: '♙' },
]

function TenantDashboard() {
  const [section, setSection] = useState<Section>('overview')
  const [profile, setProfile] = useState<TenantProfile | null>(null)
  const [income, setIncome] = useState<TenantIncome | null>(null)
  const [incomeLoading, setIncomeLoading] = useState(false)
  const [incomeError, setIncomeError] = useState('')
  const [incomeStartDate, setIncomeStartDate] = useState('')
  const [incomeEndDate, setIncomeEndDate] = useState('')
  const [rentalPayments, setRentalPayments] = useState<TenantRentalPayment[]>([])
  const [rentalLoading, setRentalLoading] = useState(false)
  const [rentalError, setRentalError] = useState('')
  const [selectedRentalProofs, setSelectedRentalProofs] = useState<Record<number, string>>({})
  const [uploadingRentalProofId, setUploadingRentalProofId] = useState<number | null>(null)
  const [rentalProofModal, setRentalProofModal] = useState<{ src: string; title: string } | null>(null)
  const [orders, setOrders] = useState<TenantOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [orderMessage, setOrderMessage] = useState('')
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null)
  const [menus, setMenus] = useState<TenantMenu[]>([])
  const [menusLoading, setMenusLoading] = useState(false)
  const [menusError, setMenusError] = useState('')
  const [menuForm, setMenuForm] = useState({
    menu_name: '',
    description: '',
    price: '',
    quantity: '0',
    category: '',
    photo: '',
  })
  const [isOpen, setIsOpen] = useState<boolean | null>(null)
  const [togglingOpen, setTogglingOpen] = useState(false)
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null)
  const [savingMenu, setSavingMenu] = useState(false)
  const [menuMessage, setMenuMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileForm, setProfileForm] = useState({
    tenant_name: '',
    phone: '',
    bank_name: '',
    bank_account: '',
    profile_photo: '',
  })

  const loadProfile = useCallback(async () => {
    const token = sessionStorage.getItem('ekut_token')
    if (!token) {
      window.location.replace('/login')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/tenant/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('ekut_token')
        sessionStorage.removeItem('ekut_user')
        window.location.replace('/login')
        return
      }
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Profil tenant gagal dimuat.')
      }
      setProfile(result.data as TenantProfile)
      setIsOpen(Number((result.data as { is_open?: number | boolean }).is_open) === 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tidak dapat terhubung ke backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const storedUser = sessionStorage.getItem('ekut_user')
    if (!storedUser) {
      window.location.replace('/login')
      return
    }
    try {
      const user = JSON.parse(storedUser)
      if (user.role !== 'tenant') {
        window.location.replace('/login')
        return
      }
    } catch {
      window.location.replace('/login')
      return
    }
    void loadProfile()
  }, [loadProfile])

  function startProfileEdit() {
    if (!profile) return
    setProfileForm({
      tenant_name: profile.tenant_name || '',
      phone: profile.phone || '',
      bank_name: profile.bank_name || '',
      bank_account: profile.bank_account || '',
      profile_photo: profile.profile_photo || '',
    })
    setProfileMessage('')
    setEditingProfile(true)
  }

  async function handleProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setProfileMessage('Gunakan foto JPG, PNG, atau WEBP.')
      event.target.value = ''
      return
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setProfileMessage('Ukuran foto maksimal 1,5 MB.')
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfileForm((current) => ({ ...current, profile_photo: reader.result as string }))
        setProfileMessage('')
      }
    }
    reader.onerror = () => setProfileMessage('Foto gagal dibaca. Coba pilih file lain.')
    reader.readAsDataURL(file)
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const token = sessionStorage.getItem('ekut_token')
    if (!token) {
      window.location.replace('/login')
      return
    }
    if (!profileForm.tenant_name.trim()) {
      setProfileMessage('Nama tenant wajib diisi.')
      return
    }
    setSavingProfile(true)
    setProfileMessage('')
    try {
      const response = await fetch(`${API_URL}/api/tenant/profile`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_name: profileForm.tenant_name.trim(),
          phone: profileForm.phone.trim(),
          bank_name: profileForm.bank_name.trim(),
          bank_account: profileForm.bank_account.trim(),
          profile_photo: profileForm.profile_photo,
        }),
      })
      const result = await response.json()
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('ekut_token')
        sessionStorage.removeItem('ekut_user')
        window.location.replace('/login')
        return
      }
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Profil gagal disimpan.')
      }
      setProfile(result.data as TenantProfile)
      setProfileForm({
        tenant_name: result.data.tenant_name || '',
        phone: result.data.phone || '',
        bank_name: result.data.bank_name || '',
        bank_account: result.data.bank_account || '',
        profile_photo: result.data.profile_photo || '',
      })
      setEditingProfile(false)
      setProfileMessage('Perubahan profil berhasil disimpan.')
    } catch (err) {
      setProfileMessage(err instanceof Error ? err.message : 'Profil gagal disimpan.')
    } finally {
      setSavingProfile(false)
    }
  }

  function profilePhotoUrl(value: string | null | undefined) {
    if (!value) return ''
    if (value.startsWith('data:image/')) return value
    if (value.startsWith('/')) return `${API_URL}${value}`
    return value
  }

  const loadIncome = useCallback(async (rangeStart = incomeStartDate, rangeEnd = incomeEndDate) => {
    const token = sessionStorage.getItem('ekut_token')
    if (!token) {
      window.location.replace('/login')
      return
    }
    setIncomeLoading(true)
    setIncomeError('')
    try {
      if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
        throw new Error('Tanggal awal tidak boleh setelah tanggal akhir.')
      }
      const params = new URLSearchParams()
      if (rangeStart) params.set('startDate', rangeStart)
      if (rangeEnd) params.set('endDate', rangeEnd)
      const query = params.toString()
      const response = await fetch(`${API_URL}/api/tenant/income${query ? `?${query}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('ekut_token')
        sessionStorage.removeItem('ekut_user')
        window.location.replace('/login')
        return
      }
      if (!response.ok || result.status !== 'success' || !result.data) {
        throw new Error(result.message || 'Pendapatan tenant gagal dimuat.')
      }
      setIncome({
        totalIncome: Number(result.data.totalIncome) || 0,
        paidOrders: Number(result.data.paidOrders) || 0,
        totalTransferred: Number(result.data.totalTransferred) || 0,
        outstandingBalance: Number(result.data.outstandingBalance) || 0,
        transfers: Array.isArray(result.data.transfers) ? result.data.transfers : [],
      })
    } catch (err) {
      setIncomeError(err instanceof Error ? err.message : 'Tidak dapat terhubung ke backend.')
    } finally {
      setIncomeLoading(false)
    }
  }, [incomeStartDate, incomeEndDate])

  useEffect(() => {
    if (section === 'income') void loadIncome()
  }, [section, loadIncome])

  const loadRentalPayments = useCallback(async () => {
    const token = sessionStorage.getItem('ekut_token')
    if (!token) {
      window.location.replace('/login')
      return
    }
    setRentalLoading(true)
    setRentalError('')
    try {
      const response = await fetch(`${API_URL}/api/tenant/rental-payments`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('ekut_token')
        sessionStorage.removeItem('ekut_user')
        window.location.replace('/login')
        return
      }
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Riwayat pembayaran sewa gagal dimuat.')
      }
      setRentalPayments(Array.isArray(result.data) ? result.data as TenantRentalPayment[] : [])
    } catch (err) {
      setRentalError(err instanceof Error ? err.message : 'Tidak dapat terhubung ke backend.')
    } finally {
      setRentalLoading(false)
    }
  }, [])

  useEffect(() => {
    if (section === 'rental') void loadRentalPayments()
  }, [section, loadRentalPayments])

  function formatRentalDate(value: string | null | undefined) {
    if (!value) return '—'
    const dateOnly = value.slice(0, 10)
    const date = new Date(`${dateOnly}T00:00:00`)
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  function rentalStatusLabel(value: string | null | undefined) {
    const status = (value || '').toLowerCase()
    if (status === 'paid') return 'Lunas'
    if (status === 'pending') return 'Menunggu'
    if (status === 'overdue') return 'Terlambat'
    return value || 'Belum ditentukan'
  }

  function readImageAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result)
        else reject(new Error('Foto gagal dibaca.'))
      }
      reader.onerror = () => reject(new Error('Foto gagal dibaca.'))
      reader.readAsDataURL(file)
    })
  }

  async function selectRentalProof(rentalId: number, file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setRentalError('Pilih foto berformat JPG, PNG, atau WEBP.')
      return
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setRentalError('Ukuran foto maksimal 1,5 MB.')
      return
    }
    try {
      const dataUrl = await readImageAsDataUrl(file)
      setRentalError('')
      setSelectedRentalProofs((current) => ({ ...current, [rentalId]: dataUrl }))
    } catch (error) {
      setRentalError(error instanceof Error ? error.message : 'Foto gagal dibaca.')
    }
  }

  async function loadSampleRentalProof(rentalId: number) {
    try {
      const response = await fetch(proofTenant1)
      if (!response.ok) throw new Error('Foto contoh gagal dimuat.')
      const sampleFile = new File([await response.blob()], 'proof_tenant_1.png', { type: 'image/png' })
      await selectRentalProof(rentalId, sampleFile)
    } catch (error) {
      setRentalError(error instanceof Error ? error.message : 'Foto contoh gagal dimuat.')
    }
  }

  async function uploadRentalProof(payment: TenantRentalPayment) {
    const proof = selectedRentalProofs[payment.rental_id]
    if (!proof) {
      setRentalError('Pilih foto bukti pembayaran terlebih dahulu.')
      return
    }
    const token = sessionStorage.getItem('ekut_token')
    if (!token) {
      window.location.replace('/login')
      return
    }
    setUploadingRentalProofId(payment.rental_id)
    setRentalError('')
    try {
      const response = await fetch(`${API_URL}/api/tenant/rental-payments/${payment.rental_id}/proof`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payment_proof: proof }),
      })
      const result = await response.json()
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('ekut_token')
        sessionStorage.removeItem('ekut_user')
        window.location.replace('/login')
        return
      }
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Bukti pembayaran gagal diunggah.')
      }
      setSelectedRentalProofs((current) => {
        const next = { ...current }
        delete next[payment.rental_id]
        return next
      })
      await loadRentalPayments()
    } catch (error) {
      setRentalError(error instanceof Error ? error.message : 'Bukti pembayaran gagal diunggah.')
    } finally {
      setUploadingRentalProofId(null)
    }
  }

  const loadOrders = useCallback(async () => {
    const token = sessionStorage.getItem('ekut_token')
    if (!token) {
      window.location.replace('/login')
      return
    }
    setOrdersLoading(true)
    setOrdersError('')
    try {
      const response = await fetch(`${API_URL}/api/tenant/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('ekut_token')
        sessionStorage.removeItem('ekut_user')
        window.location.replace('/login')
        return
      }
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Daftar pesanan gagal dimuat.')
      }
      setOrders(Array.isArray(result.data) ? result.data as TenantOrder[] : [])
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : 'Tidak dapat terhubung ke backend.')
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (section === 'orders') {
      void loadOrders()
    }
  }, [section, loadOrders])

  async function updateOrderStatus(order: TenantOrder) {
    const nextStatus = order.status.toLowerCase() === 'pending'
      ? 'preparing'
      : order.status.toLowerCase() === 'preparing'
        ? 'completed'
        : ''
    if (!nextStatus) return
    const label = nextStatus === 'preparing' ? 'diproses' : 'selesai'
    if (!window.confirm(`Ubah status pesanan ${order.orderNumber} menjadi ${label}?`)) return
    const token = sessionStorage.getItem('ekut_token')
    if (!token) {
      window.location.replace('/login')
      return
    }
    setUpdatingOrderId(order.orderId)
    setOrderMessage('')
    try {
      const response = await fetch(`${API_URL}/api/tenant/orders/${order.orderId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      })
      const result = await response.json()
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('ekut_token')
        sessionStorage.removeItem('ekut_user')
        window.location.replace('/login')
        return
      }
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Status pesanan gagal diperbarui.')
      }
      setOrderMessage(result.message || 'Status pesanan berhasil diperbarui.')
      await loadOrders()
    } catch (err) {
      setOrderMessage(err instanceof Error ? err.message : 'Status pesanan gagal diperbarui.')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  function formatOrderDate(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
  }

  const loadMenus = useCallback(async () => {
    const token = sessionStorage.getItem('ekut_token')
    if (!token) {
      window.location.replace('/login')
      return
    }
    setMenusLoading(true)
    setMenusError('')
    try {
      const response = await fetch(`${API_URL}/api/tenant/menus`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('ekut_token')
        sessionStorage.removeItem('ekut_user')
        window.location.replace('/login')
        return
      }
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Daftar menu gagal dimuat.')
      }
      setMenus(Array.isArray(result.data) ? result.data as TenantMenu[] : [])
    } catch (err) {
      setMenusError(err instanceof Error ? err.message : 'Tidak dapat terhubung ke backend.')
    } finally {
      setMenusLoading(false)
    }
  }, [])

  useEffect(() => {
    if (section === 'menus') void loadMenus()
  }, [section, loadMenus])

  function resetMenuForm() {
    setEditingMenuId(null)
    setMenuForm({ menu_name: '', description: '', price: '', quantity: '0', category: '', photo: '' })
    setMenuMessage('')
  }

  function startMenuEdit(menu: TenantMenu) {
    setEditingMenuId(menu.menu_id)
    setMenuForm({
      menu_name: menu.menu_name,
      description: menu.description || '',
      price: String(menu.price),
      quantity: String(menu.quantity),
      category: menu.category || '',
      photo: menu.photo || '',
    })
    setMenuMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function menuPhotoUrl(value: string | null | undefined) {
    if (!value) return ''
    if (value.startsWith('/')) return `${API_URL}${value}`
    return value
  }

  async function handleMenuPhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMenuMessage('Foto menu harus berformat JPG, PNG, atau WEBP.')
      input.value = ''
      return
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setMenuMessage('Ukuran foto menu maksimal 1,5 MB.')
      input.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMenuForm((current) => ({ ...current, photo: reader.result as string }))
        setMenuMessage('')
      }
    }
    reader.onerror = () => setMenuMessage('Foto menu gagal dibaca. Coba pilih file lain.')
    reader.readAsDataURL(file)
  }

  async function saveMenu(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const token = sessionStorage.getItem('ekut_token')
    if (!token) {
      window.location.replace('/login')
      return
    }
    const price = Number(menuForm.price)
    const quantity = Number(menuForm.quantity)
    if (!menuForm.menu_name.trim()) {
      setMenuMessage('Nama menu wajib diisi.')
      return
    }
    if (!Number.isFinite(price) || price <= 0) {
      setMenuMessage('Harga harus lebih dari Rp0.')
      return
    }
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      setMenuMessage('Stok harus berupa bilangan bulat minimal 0.')
      return
    }
    setSavingMenu(true)
    setMenuMessage('')
    try {
      const isEditing = editingMenuId !== null
      const response = await fetch(
        `${API_URL}/api/tenant/menus${isEditing ? `/${editingMenuId}` : ''}`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            menu_name: menuForm.menu_name.trim(),
            description: menuForm.description.trim(),
            price,
            quantity,
            category: menuForm.category.trim(),
            photo: menuForm.photo,
          }),
        },
      )
      const result = await response.json()
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('ekut_token')
        sessionStorage.removeItem('ekut_user')
        window.location.replace('/login')
        return
      }
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Menu gagal disimpan.')
      }
      setMenuMessage(result.message || (isEditing ? 'Menu berhasil diperbarui.' : 'Menu berhasil ditambahkan.'))
      resetMenuForm()
      await loadMenus()
    } catch (err) {
      setMenuMessage(err instanceof Error ? err.message : 'Menu gagal disimpan.')
    } finally {
      setSavingMenu(false)
    }
  }

  async function deleteMenu(menu: TenantMenu) {
    const confirmed = window.confirm(`Hapus menu "${menu.menu_name}"? Tindakan ini tidak dapat dibatalkan.`)
    if (!confirmed) return
    const token = sessionStorage.getItem('ekut_token')
    if (!token) {
      window.location.replace('/login')
      return
    }
    setMenuMessage('')
    try {
      const response = await fetch(`${API_URL}/api/tenant/menus/${menu.menu_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('ekut_token')
        sessionStorage.removeItem('ekut_user')
        window.location.replace('/login')
        return
      }
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Menu gagal dihapus.')
      }
      setMenuMessage(result.message || 'Menu berhasil dihapus.')
      await loadMenus()
    } catch (err) {
      setMenuMessage(err instanceof Error ? err.message : 'Menu gagal dihapus.')
    }
  }

  function formatRupiah(value: number | string) {
    return Number(value).toLocaleString('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    })
  }

  function logout() {
    sessionStorage.removeItem('ekut_token')
    sessionStorage.removeItem('ekut_user')
    window.location.replace('/login')
  }

  async function toggleOpen() {
    if (isOpen === null || togglingOpen) return
    const next = !isOpen
    const question = next
      ? 'Buka usaha sekarang? Pelanggan akan bisa membuat pesanan.'
      : 'Tutup usaha? Pelanggan tidak bisa membuat pesanan baru sampai kamu membukanya lagi.'
    if (!window.confirm(question)) return
    const token = sessionStorage.getItem('ekut_token')
    if (!token) {
      window.location.replace('/login')
      return
    }
    setTogglingOpen(true)
    try {
      const response = await fetch(`${API_URL}/api/tenant/open-status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isOpen: next }),
      })
      const result = await response.json()
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('ekut_token')
        sessionStorage.removeItem('ekut_user')
        window.location.replace('/login')
        return
      }
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Status usaha gagal diperbarui.')
      }
      setIsOpen(next)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Status usaha gagal diperbarui.')
    } finally {
      setTogglingOpen(false)
    }
  }

  const currentNav = navItems.find((item) => item.id === section)
  return (
    <div className="tenant-dashboard">
      <aside className="tenant-sidebar">
        <div className="tenant-brand">
          <div className="tenant-brand-mark">E</div>
          <div><strong>E-KUT</strong><span>MANAGEMENT SYSTEM</span></div>
        </div>
        <div className="tenant-account-card">
          <div className="tenant-avatar">{profile?.profile_photo ? <img src={profilePhotoUrl(profile.profile_photo)} alt="" /> : (profile?.tenant_name || 'T').charAt(0).toUpperCase()}</div>
          <div className="tenant-account-copy">
            <strong>{loading ? 'Memuat profil...' : profile?.tenant_name || 'Tenant EKUT'}</strong>
            <span>Tenant Portal</span>
          </div>
        </div>
        <p className="tenant-nav-label">MENU UTAMA</p>
        <nav className="tenant-nav" aria-label="Navigasi tenant">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tenant-nav-item ${section === item.id ? 'is-active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              <span className="tenant-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="tenant-sidebar-bottom">
          <div className="tenant-help-card">
            <span className="tenant-help-heart">♥</span>
            <strong>Butuh bantuan?</strong>
            <p>Kelola kantinmu dengan lebih mudah melalui E-KUT.</p>
          </div>
          <button type="button" className="tenant-logout" onClick={logout}><span>↪</span> Logout</button>
        </div>
      </aside>
      <main className="tenant-main">
        <header className="tenant-topbar">
          <div>
            <p className="tenant-breadcrumb">E-KUT / Tenant Portal</p>
            <h1>{currentNav?.label || 'Overview'}</h1>
          </div>
          <div className="tenant-topbar-actions">
            {isOpen !== null && (
              <button
                type="button"
                className={`tenant-open-toggle ${isOpen ? 'is-open' : 'is-closed'}`}
                aria-pressed={isOpen}
                disabled={togglingOpen}
                onClick={() => void toggleOpen()}
              >
                <span className="tenant-open-dot" aria-hidden="true" />
                {togglingOpen ? 'Memproses...' : isOpen ? 'Usaha BUKA · klik untuk tutup' : 'Usaha TUTUP · klik untuk buka'}
              </button>
            )}
            <div className="tenant-date-pill">◷ <span>{new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
            <div className="tenant-top-avatar">{profile?.profile_photo ? <img src={profilePhotoUrl(profile.profile_photo)} alt="" /> : (profile?.tenant_name || 'T').charAt(0).toUpperCase()}</div>
            <button type="button" className="tenant-top-logout" onClick={logout}>↪ <span>Logout</span></button>
          </div>
        </header>
        {error && <div className="tenant-alert" role="alert"><strong>Profil belum bisa dimuat.</strong><span>{error}</span><button type="button" onClick={() => void loadProfile()}>Coba lagi</button></div>}
        {section === 'overview' && (
          <>
            <section className="tenant-welcome-banner">
              <div className="tenant-welcome-content">
                <span className="tenant-eyebrow">TENANT MANAGEMENT</span>
                <h2>Halo, {profile?.tenant_name || 'Tenant EKUT'}! <span>✦</span></h2>
                <p>Selamat datang di portal tenant E-KUT. Pantau dan kelola operasional kantinmu dari satu tempat.</p>
                <button type="button" className="tenant-primary-button" onClick={() => setSection('menus')}>Kelola menu <span>→</span></button>
              </div>
              <div className="tenant-banner-art" aria-hidden="true"><div className="tenant-art-circle">🍱</div><span className="tenant-art-spark spark-one">✦</span><span className="tenant-art-spark spark-two">✧</span><span className="tenant-art-dot" /></div>
            </section>
            <div className="tenant-section-title"><div><h2>Ringkasan Bisnis</h2><p>Ringkasan aktivitas toko kamu.</p></div><span className={`tenant-status-badge ${profile?.status?.toLowerCase() === 'active' ? 'status-active' : 'status-neutral'}`}><i /> {profile?.status?.toLowerCase() === 'active' ? 'Akun aktif' : loading ? 'Memuat status' : profile?.status || 'Status belum tersedia'}</span></div>
            <section className="tenant-stat-grid">
              <article className="tenant-stat-card"><div className="tenant-stat-top"><span>Total Pesanan</span><span className="tenant-stat-icon icon-blue">⇄</span></div><strong>—</strong><p>Data pesanan akan ditampilkan di sini</p></article>
              <article className="tenant-stat-card"><div className="tenant-stat-top"><span>Pendapatan</span><span className="tenant-stat-icon icon-green">↗</span></div><strong>—</strong><p>Akumulasi pembayaran terkonfirmasi</p></article>
              <article className="tenant-stat-card"><div className="tenant-stat-top"><span>Menu Tersedia</span><span className="tenant-stat-icon icon-orange">☷</span></div><strong>—</strong><p>Jumlah menu aktif di toko kamu</p></article>
              <article className="tenant-stat-card"><div className="tenant-stat-top"><span>Status Sewa</span><span className="tenant-stat-icon icon-purple">▣</span></div><strong className="tenant-stat-pending">—</strong><p>Status tagihan sewa bulan berjalan</p></article>
            </section>
            <section className="tenant-content-grid">
              <article className="tenant-panel tenant-quick-panel"><div className="tenant-panel-heading"><div><h3>Akses Cepat</h3><p>Pilih aktivitas yang ingin kamu kelola.</p></div></div><div className="tenant-quick-actions">
                <button type="button" onClick={() => setSection('orders')}><span className="quick-icon quick-blue">⇄</span><span><strong>Pesanan</strong><small>Kelola pesanan masuk</small></span><b>→</b></button>
                <button type="button" onClick={() => setSection('menus')}><span className="quick-icon quick-orange">☷</span><span><strong>Daftar Menu</strong><small>Perbarui menu dan stok</small></span><b>→</b></button>
                <button type="button" onClick={() => setSection('income')}><span className="quick-icon quick-green">▤</span><span><strong>Pendapatan</strong><small>Lihat ringkasan penghasilan</small></span><b>→</b></button>
              </div></article>
              <article className="tenant-panel tenant-profile-panel"><div className="tenant-panel-heading"><div><h3>Profil Tenant</h3><p>Informasi akun yang terdaftar.</p></div><button type="button" className="tenant-text-button" onClick={() => setSection('profile')}>Lihat profil →</button></div>
                {loading ? <p className="tenant-muted">Memuat informasi profil...</p> : profile ? <div className="tenant-profile-summary"><div className="tenant-profile-avatar">{profile.profile_photo ? <img src={profilePhotoUrl(profile.profile_photo)} alt="Foto profil tenant" /> : (profile.tenant_name || 'T').charAt(0).toUpperCase()}</div><div><strong>{profile.tenant_name}</strong><span>@{profile.username}</span><small>{profile.phone || 'Nomor kontak belum diisi'}</small></div></div> : <p className="tenant-muted">Profil belum tersedia.</p>}
              </article>
            </section>
          </>
        )}
        {section === 'menus' && (
          <section className="tenant-menu-page">
            <div className="tenant-menu-intro">
              <div>
                <span className="tenant-eyebrow">TENANT MANAGEMENT</span>
                <h2>Kelola Menu</h2>
                <p>Tambah, perbarui, dan kelola stok menu yang tampil di halaman pelanggan.</p>
              </div>
              <span className="tenant-menu-count">{menus.length} menu</span>
            </div>
            <form className="tenant-panel tenant-menu-form" onSubmit={saveMenu}>
              <div className="tenant-panel-heading">
                <div><h3>{editingMenuId === null ? 'Tambah Menu Baru' : 'Edit Menu'}</h3><p>Isi informasi menu dengan benar.</p></div>
                {editingMenuId !== null && <button type="button" className="tenant-secondary-button" onClick={resetMenuForm}>Batal edit</button>}
              </div>
              <div className="tenant-menu-form-grid">
                <label>Nama menu
                  <input value={menuForm.menu_name} maxLength={150} required placeholder="Contoh: Nasi ayam geprek" onChange={(e) => setMenuForm((v) => ({ ...v, menu_name: e.target.value }))} />
                </label>
                <label>Harga (Rp)
                  <input type="number" min="1" step="1" required value={menuForm.price} placeholder="15000" onChange={(e) => setMenuForm((v) => ({ ...v, price: e.target.value }))} />
                </label>
                <label>Stok
                  <input type="number" min="0" step="1" required value={menuForm.quantity} onChange={(e) => setMenuForm((v) => ({ ...v, quantity: e.target.value }))} />
                </label>
                <label>Kategori
                  <input list="tenant-menu-categories" value={menuForm.category} maxLength={50} placeholder="Makanan, Minuman, Dessert..." onChange={(e) => setMenuForm((v) => ({ ...v, category: e.target.value }))} />
                  <datalist id="tenant-menu-categories">
                    <option value="Makanan" />
                    <option value="Minuman" />
                    <option value="Dessert" />
                    <option value="Snack" />
                    <option value="Kue & Jajanan" />
                  </datalist>
                </label>
                <label className="tenant-menu-description">Deskripsi
                  <textarea value={menuForm.description} maxLength={1000} rows={3} placeholder="Deskripsi singkat menu (opsional)" onChange={(e) => setMenuForm((v) => ({ ...v, description: e.target.value }))} />
                </label>
                <div className="tenant-menu-photo-field">
                  <label htmlFor="tenant-menu-photo">Foto menu (opsional)</label>
                  {menuForm.photo && <img src={menuPhotoUrl(menuForm.photo)} alt="Pratinjau foto menu" />}
                  <input id="tenant-menu-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleMenuPhoto(event)} />
                  <small>JPG, PNG, atau WEBP · maksimal 1,5 MB</small>
                  {menuForm.photo && <button type="button" className="tenant-menu-photo-remove" onClick={() => setMenuForm((current) => ({ ...current, photo: '' }))}>Hapus foto</button>}
                </div>
              </div>
              {menuMessage && <p className={`tenant-profile-message ${/gagal|tidak dapat|harus|wajib|tidak valid|tidak ditemukan/i.test(menuMessage) ? 'error' : 'success'}`} role="status">{menuMessage}</p>}
              <div className="tenant-profile-form-actions">
                <button type="submit" className="tenant-primary-button" disabled={savingMenu}>{savingMenu ? 'Menyimpan...' : editingMenuId === null ? 'Tambah Menu' : 'Simpan Perubahan'}</button>
              </div>
            </form>
            <section className="tenant-panel tenant-menu-list-panel">
              <div className="tenant-panel-heading">
                <div><h3>Daftar Menu</h3><p>Menu yang terdaftar pada akun tenant kamu.</p></div>
                <button type="button" className="tenant-secondary-button" onClick={() => void loadMenus()} disabled={menusLoading}>{menusLoading ? 'Memuat...' : '↻ Muat ulang'}</button>
              </div>
              {menusError && <div className="tenant-alert" role="alert"><span>{menusError}</span><button type="button" onClick={() => void loadMenus()}>Coba lagi</button></div>}
              {menusLoading ? <p className="tenant-muted">Memuat daftar menu...</p> : menus.length === 0 ? (
                <div className="tenant-menu-empty"><span>☷</span><strong>Belum ada menu</strong><p>Tambahkan menu pertamamu melalui formulir di atas.</p></div>
              ) : (
                <div className="tenant-menu-table-wrap">
                  <table className="tenant-menu-table">
                    <thead><tr><th>Foto</th><th>Menu</th><th>Harga</th><th>Stok</th><th>Status</th><th>Aksi</th></tr></thead>
                    <tbody>{menus.map((menu) => (
                      <tr key={menu.menu_id}>
                        <td>{menu.photo ? (
                          <img
                            className="tenant-menu-table-photo"
                            src={menuPhotoUrl(menu.photo)}
                            alt={`Foto ${menu.menu_name}`}
                            width={44}
                            height={34}
                            style={{ width: 44, height: 34, maxWidth: 44, maxHeight: 34, objectFit: 'cover' }}
                          />
                        ) : '—'}</td>
                        <td><div className="tenant-menu-name"><strong>{menu.menu_name}</strong><small>{menu.description || 'Tidak ada deskripsi'}</small></div></td>
                        <td>{formatRupiah(menu.price)}</td><td>{menu.quantity}</td>
                        <td><span className={`tenant-menu-status ${menu.status?.toLowerCase() === 'available' ? 'is-available' : 'is-unavailable'}`}>{menu.status?.toLowerCase() === 'available' ? 'Tersedia' : 'Habis'}</span></td>
                        <td><div className="tenant-menu-actions"><button type="button" className="tenant-menu-edit" onClick={() => startMenuEdit(menu)}>Edit</button><button type="button" className="tenant-menu-delete" onClick={() => void deleteMenu(menu)}>Hapus</button></div></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
          </section>
        )}
        {section === 'orders' && (
          <section className="tenant-orders-page">
            <div className="tenant-orders-intro">
              <div>
                <span className="tenant-eyebrow">TENANT MANAGEMENT</span>
                <h2>Manajemen Pesanan</h2>
                <p>Pantau pesanan masuk dan perbarui status sesuai proses di kantin.</p>
              </div>
              <span className="tenant-order-count">{orders.length} pesanan</span>
            </div>
            {orderMessage && (
              <p className={`tenant-order-message ${/gagal|tidak|error|ditemukan/i.test(orderMessage) ? 'error' : 'success'}`} role="status">
                {orderMessage}
              </p>
            )}
            <section className="tenant-panel tenant-orders-list-panel">
              <div className="tenant-panel-heading">
                <div>
                  <h3>Daftar Pesanan</h3>
                  <p>Pesanan yang terhubung dengan akun tenant kamu.</p>
                </div>
                <button type="button" className="tenant-secondary-button" onClick={() => void loadOrders()} disabled={ordersLoading}>
                  {ordersLoading ? 'Memuat...' : '↻ Muat ulang'}
                </button>
              </div>
              {ordersError && (
                <div className="tenant-alert" role="alert">
                  <span>{ordersError}</span>
                  <button type="button" onClick={() => void loadOrders()}>Coba lagi</button>
                </div>
              )}
              {ordersLoading ? (
                <p className="tenant-muted">Memuat daftar pesanan...</p>
              ) : orders.length === 0 ? (
                <div className="tenant-orders-empty">
                  <span>⇄</span>
                  <strong>Belum ada pesanan</strong>
                  <p>Pesanan pelanggan akan muncul di sini setelah dibuat.</p>
                </div>
              ) : (
                <div className="tenant-orders-grid">
                  {orders.map((order) => {
                    const status = order.status.toLowerCase()
                    const unpaid = (order.paymentStatus ?? 'paid').toLowerCase() !== 'paid'
                    const nextLabel = unpaid ? '' : status === 'pending' ? 'Terima & Proses' : status === 'preparing' ? 'Tandai Selesai' : ''
                    return (
                      <article className="tenant-order-card" key={order.orderId}>
                        <div className="tenant-order-card-top">
                          <div>
                            {order.queueNumber
                              ? <strong className="tenant-queue-badge">Antrian {order.queueNumber}</strong>
                              : <strong className="tenant-queue-badge is-empty">Belum ada antrian</strong>}
                            <span>No. riwayat: {order.orderNumber}</span>
                            <span>{formatOrderDate(order.orderDate)}</span>
                            <span className="tenant-schedule-note">{order.scheduledTime ? `Dijadwalkan pukul ${order.scheduledTime}` : 'Pesan saat ini'}</span>
                          </div>
                          <span className={`tenant-order-status status-${status.replace(/[^a-z0-9-]/g, '')}`}>
                            {status === 'pending' ? 'Menunggu' : status === 'preparing' ? 'Diproses' : status === 'completed' ? 'Selesai' : order.status}
                          </span>
                        </div>
                        <div className="tenant-order-customer">
                          <strong>{order.customer?.name || 'Pelanggan'}</strong>
                          <span>{order.customer?.phone || 'Nomor kontak tidak tersedia'}</span>
                        </div>
                        <div className="tenant-order-items">
                          {order.items?.map((item) => (
                            <div className="tenant-order-item" key={item.orderItemId}>
                              <span>{item.menuName} <small>× {item.quantity}</small></span>
                              <strong>{formatRupiah(item.subtotal)}</strong>
                            </div>
                          ))}
                        </div>
                        <div className="tenant-order-total">
                          <span>Total pesanan</span>
                          <strong>{formatRupiah(order.totalAmount)}</strong>
                        </div>
                        {nextLabel ? (
                          <button
                            type="button"
                            className="tenant-primary-button tenant-order-action"
                            disabled={updatingOrderId === order.orderId}
                            onClick={() => void updateOrderStatus(order)}
                          >
                            {updatingOrderId === order.orderId ? 'Memperbarui...' : nextLabel}
                          </button>
                        ) : (
                          <p className="tenant-order-complete-note">{unpaid ? 'Menunggu pembayaran customer.' : 'Pesanan telah selesai.'}</p>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </section>
        )}
        {section === 'income' && (
          <section className="tenant-income-page">
            <div className="tenant-income-intro">
              <div>
                <span className="tenant-eyebrow">TENANT MANAGEMENT</span>
                <h2>Pendapatan Tenant</h2>
                <p>Ringkasan pembayaran terkonfirmasi dan transfer dari admin E-KUT.</p>
              </div>
              <button type="button" className="tenant-secondary-button" disabled={incomeLoading} onClick={() => void loadIncome()}>
                {incomeLoading ? 'Memuat...' : '↻ Muat ulang'}
              </button>
            </div>
            <form className="tenant-panel tenant-income-filter" onSubmit={(event) => { event.preventDefault(); void loadIncome() }}>
              <div className="tenant-income-filter-heading">
                <div><h3>Filter Periode</h3><p>Pilih rentang tanggal untuk melihat pendapatan dan transfer pada periode tersebut.</p></div>
              </div>
              <div className="tenant-income-filter-fields">
                <label>Tanggal awal
                  <input type="date" value={incomeStartDate} max={incomeEndDate || undefined} onChange={(event) => setIncomeStartDate(event.target.value)} />
                </label>
                <label>Tanggal akhir
                  <input type="date" value={incomeEndDate} min={incomeStartDate || undefined} onChange={(event) => setIncomeEndDate(event.target.value)} />
                </label>
                <div className="tenant-income-filter-actions">
                  <button type="submit" className="tenant-primary-button" disabled={incomeLoading}>{incomeLoading ? 'Memuat...' : 'Terapkan Filter'}</button>
                  <button type="button" className="tenant-secondary-button" disabled={incomeLoading || (!incomeStartDate && !incomeEndDate)} onClick={() => { setIncomeStartDate(''); setIncomeEndDate(''); void loadIncome('', '') }}>Reset</button>
                </div>
              </div>
            </form>
            {incomeError && (
              <div className="tenant-alert" role="alert">
                <span>{incomeError}</span>
                <button type="button" onClick={() => void loadIncome()}>Coba lagi</button>
              </div>
            )}
            {incomeLoading && !income ? (
              <div className="tenant-panel tenant-income-loading">Memuat data pendapatan...</div>
            ) : income ? (
              <>
                <div className="tenant-income-stats">
                  <article className="tenant-panel tenant-income-stat">
                    <span>Total Pendapatan</span>
                    <strong>{formatRupiah(income.totalIncome)}</strong>
                    <small>Akumulasi pembayaran berstatus paid</small>
                  </article>
                  <article className="tenant-panel tenant-income-stat">
                    <span>Pesanan Dibayar</span>
                    <strong>{income.paidOrders.toLocaleString('id-ID')}</strong>
                    <small>Jumlah pesanan dengan pembayaran terkonfirmasi</small>
                  </article>
                  <article className="tenant-panel tenant-income-stat">
                    <span>Sudah Ditransfer</span>
                    <strong>{formatRupiah(income.totalTransferred)}</strong>
                    <small>Transfer dengan status completed</small>
                  </article>
                  <article className="tenant-panel tenant-income-stat">
                    <span>Belum Ditransfer</span>
                    <strong>{formatRupiah(income.outstandingBalance)}</strong>
                    <small>Saldo pendapatan yang masih menunggu transfer</small>
                  </article>
                </div>
                <section className="tenant-panel tenant-income-history">
                  <div className="tenant-panel-heading">
                    <div><h3>Riwayat Transfer</h3><p>Daftar transfer yang tercatat untuk tenant kamu.</p></div>
                  </div>
                  {income.transfers.length === 0 ? (
                    <p className="tenant-muted">Belum ada riwayat transfer.</p>
                  ) : (
                    <div className="tenant-income-table-wrap">
                      <table className="tenant-income-table">
                        <thead><tr><th>Tanggal</th><th>Nominal</th><th>Bank & Rekening</th><th>Referensi</th><th>Status</th></tr></thead>
                        <tbody>
                          {income.transfers.map((transfer, index) => (
                            <tr key={`${transfer.reference_number || 'transfer'}-${index}`}>
                              <td>{transfer.transfer_date ? formatOrderDate(transfer.transfer_date) : '—'}</td>
                              <td><strong>{formatRupiah(transfer.amount)}</strong></td>
                              <td>{transfer.bank_name || '—'}<small>{transfer.bank_account || '—'}</small></td>
                              <td>{transfer.reference_number || '—'}</td>
                              <td><span className={`tenant-income-transfer-status ${transfer.status?.toLowerCase() === 'completed' ? 'is-completed' : ''}`}>{transfer.status?.toLowerCase() === 'completed' ? 'Selesai' : transfer.status || '—'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            ) : !incomeError ? (
              <div className="tenant-panel tenant-income-loading">Belum ada data pendapatan.</div>
            ) : null}
          </section>
        )}
        {section === 'reviews' && (
          <section className="tenant-menu-page">
            <div className="tenant-menu-intro">
              <div>
                <span className="tenant-eyebrow">TENANT MANAGEMENT</span>
                <h2>Rating & Ulasan</h2>
                <p>Lihat rating dan ulasan pelanggan untuk setiap menu di tokomu.</p>
              </div>
            </div>
            <section className="tenant-panel">
              {profile ? <RatingsView apiUrl={API_URL} tenantId={profile.tenant_id} /> : <p className="tenant-muted">Memuat profil...</p>}
            </section>
          </section>
        )}
        {section === 'rental' && (
          <section className="tenant-rental-page">
            <div className="tenant-rental-intro">
              <div>
                <span className="tenant-eyebrow">TENANT MANAGEMENT</span>
                <h2>Pembayaran Sewa</h2>
                <p>Pantau tagihan sewa kantin, tanggal jatuh tempo, dan status pembayaran akun tenant kamu.</p>
              </div>
              <button type="button" className="tenant-secondary-button" onClick={() => void loadRentalPayments()} disabled={rentalLoading}>
                {rentalLoading ? 'Memuat...' : '↻ Muat ulang'}
              </button>
            </div>
            {rentalError && (
              <div className="tenant-alert" role="alert">
                <span>{rentalError}</span>
                <button type="button" onClick={() => void loadRentalPayments()}>Coba lagi</button>
              </div>
            )}
            {rentalLoading && rentalPayments.length === 0 ? (
              <div className="tenant-panel tenant-rental-empty">Memuat riwayat pembayaran sewa...</div>
            ) : rentalPayments.length === 0 ? (
              <div className="tenant-panel tenant-rental-empty">
                <span className="tenant-rental-empty-icon">▣</span>
                <strong>Belum ada tagihan sewa</strong>
                <p>Tagihan sewa yang terdaftar untuk akun kamu akan muncul di sini.</p>
              </div>
            ) : (
              <section className="tenant-panel tenant-rental-history">
                <div className="tenant-panel-heading">
                  <div>
                    <h3>Riwayat Tagihan</h3>
                    <p>{rentalPayments.length} catatan pembayaran sewa</p>
                  </div>
                </div>
                <div className="tenant-rental-table-wrap">
                  <table className="tenant-rental-table">
                    <thead>
                      <tr>
                        <th>Periode</th>
                        <th>Jatuh Tempo</th>
                        <th>Nominal</th>
                        <th>Tanggal Bayar</th>
                        <th>Bukti Pembayaran</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rentalPayments.map((payment) => {
                        const status = (payment.status || '').toLowerCase()
                        const proof = payment.payment_proof
                        const proofFile = proof?.split('/').pop() || ''
                        const proofUrl = proof?.startsWith('/uploads/')
                          ? `${API_URL}${proof}`
                          : rentalProofImages[proofFile] || ''
                        const selectedProof = selectedRentalProofs[payment.rental_id]
                        const canUploadProof = status === 'pending' || status === 'overdue'
                        return (
                          <tr key={payment.rental_id}>
                            <td><strong>{payment.rental_period || '—'}</strong></td>
                            <td>{formatRentalDate(payment.due_date)}</td>
                            <td><strong>{formatRupiah(payment.amount)}</strong></td>
                            <td>{formatRentalDate(payment.payment_date)}</td>
                            <td>
                              <div className="tenant-rental-proof">
                                {proofUrl ? (
                                  <button
                                    type="button"
                                    className="tenant-rental-proof-link"
                                    onClick={() => setRentalProofModal({ src: proofUrl, title: `Bukti pembayaran ${payment.rental_period}` })}
                                  >
                                    Lihat bukti
                                  </button>
                                ) : <span className="tenant-rental-muted">Belum tersedia</span>}
                                {canUploadProof && (
                                  <div className="tenant-rental-proof-controls">
                                    {selectedProof && (
                                      <button
                                        type="button"
                                        className="tenant-rental-proof-link"
                                        onClick={() => setRentalProofModal({ src: selectedProof, title: 'Pratinjau bukti pembayaran' })}
                                      >
                                        Lihat pratinjau
                                      </button>
                                    )}
                                    <label className="tenant-rental-upload-label">
                                      Pilih foto
                                      <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={(event) => {
                                          const file = event.target.files?.[0]
                                          if (file) void selectRentalProof(payment.rental_id, file)
                                        }}
                                      />
                                    </label>
                                    <button type="button" className="tenant-rental-sample-button" onClick={() => void loadSampleRentalProof(payment.rental_id)}>
                                      Pakai foto contoh
                                    </button>
                                    {selectedProof && (
                                      <button
                                        type="button"
                                        className="tenant-rental-upload-button"
                                        onClick={() => void uploadRentalProof(payment)}
                                        disabled={uploadingRentalProofId === payment.rental_id}
                                      >
                                        {uploadingRentalProofId === payment.rental_id ? 'Mengunggah...' : 'Kirim ke admin'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td><span className={`tenant-rental-status status-${status || 'unknown'}`}>{rentalStatusLabel(payment.status)}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="tenant-rental-note">Setelah bukti dikirim, admin akan memeriksanya. Status pembayaran tetap menunggu sampai admin mengonfirmasi.</p>
              </section>
            )}
          </section>
        )}
        {section !== 'overview' && section !== 'menus' && section !== 'orders' && section !== 'income' && section !== 'rental' && section !== 'reviews' && (
          <section className="tenant-panel tenant-coming-soon">
            <div className="tenant-coming-icon">{currentNav?.icon || '▦'}</div>
            <span className="tenant-eyebrow">TENANT MANAGEMENT</span>
            <h2>{currentNav?.label}</h2>
            <p>{section === 'profile' ? 'Perbarui informasi toko dan rekening agar data kontak tenant di E-KUT tetap akurat.' : 'Tampilan bagian ini sudah disiapkan. Selanjutnya kita hubungkan dengan API agar data yang ditampilkan benar-benar berasal dari database EKUT.'}</p>
            {section === 'profile' && profile && (
              editingProfile ? (
                <form className="tenant-profile-edit-form" onSubmit={saveProfile}>
                  <div className="tenant-photo-editor">
                    <div className="tenant-profile-avatar tenant-photo-preview">
                      {profileForm.profile_photo
                        ? <img src={profilePhotoUrl(profileForm.profile_photo)} alt="Pratinjau foto profil" />
                        : (profileForm.tenant_name || 'T').charAt(0).toUpperCase()}
                    </div>
                    <div className="tenant-photo-controls">
                      <label htmlFor="tenant-profile-photo">Foto profil</label>
                      <input id="tenant-profile-photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleProfilePhoto} />
                      <small>JPG, PNG, atau WEBP · maksimal 1,5 MB</small>
                    </div>
                  </div>
                  <div className="tenant-profile-form-grid">
                    <label>Nama tenant
                      <input value={profileForm.tenant_name} maxLength={100} required onChange={(e) => setProfileForm((current) => ({ ...current, tenant_name: e.target.value }))} />
                    </label>
                    <label>Username
                      <input value={profile.username} disabled />
                      <small>Username tidak dapat diubah dari formulir ini.</small>
                    </label>
                    <label>Nomor kontak
                      <input value={profileForm.phone} maxLength={30} onChange={(e) => setProfileForm((current) => ({ ...current, phone: e.target.value }))} />
                    </label>
                    <label>Nama bank
                      <input value={profileForm.bank_name} maxLength={100} onChange={(e) => setProfileForm((current) => ({ ...current, bank_name: e.target.value }))} />
                    </label>
                    <label>Nomor rekening
                      <input value={profileForm.bank_account} maxLength={50} onChange={(e) => setProfileForm((current) => ({ ...current, bank_account: e.target.value }))} />
                    </label>
                    <label>Status akun
                      <input value={profile.status} disabled />
                    </label>
                  </div>
                  {profileMessage && <p className={profileMessage.includes('berhasil') ? 'tenant-profile-message success' : 'tenant-profile-message error'} role="status">{profileMessage}</p>}
                  <div className="tenant-profile-form-actions">
                    <button type="button" className="tenant-secondary-button" disabled={savingProfile} onClick={() => { setEditingProfile(false); setProfileMessage('') }}>Batal</button>
                    <button type="submit" className="tenant-primary-button" disabled={savingProfile}>{savingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="tenant-profile-details">
                    <div className="tenant-profile-detail-photo">
                      <span>Foto profil</span>
                      <div className="tenant-profile-avatar tenant-photo-preview">
                        {profile.profile_photo ? <img src={profilePhotoUrl(profile.profile_photo)} alt="Foto profil tenant" /> : (profile.tenant_name || 'T').charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div><span>Nama tenant</span><strong>{profile.tenant_name}</strong></div>
                    <div><span>Username</span><strong>{profile.username}</strong></div>
                    <div><span>Nomor kontak</span><strong>{profile.phone || 'Belum diisi'}</strong></div>
                    <div><span>Bank</span><strong>{profile.bank_name || 'Belum diisi'}</strong></div>
                    <div><span>Nomor rekening</span><strong>{profile.bank_account || 'Belum diisi'}</strong></div>
                    <div><span>Status akun</span><strong>{profile.status}</strong></div>
                  </div>
                  {profileMessage && <p className="tenant-profile-message success" role="status">{profileMessage}</p>}
                  <div className="tenant-profile-form-actions">
                    <button type="button" className="tenant-primary-button" onClick={startProfileEdit}>Edit Profil</button>
                    <button type="button" className="tenant-secondary-button" onClick={() => setSection('overview')}>← Kembali ke overview</button>
                  </div>
                </>
              )
            )}
            {section !== 'profile' && <button type="button" className="tenant-secondary-button" onClick={() => setSection('overview')}>← Kembali ke overview</button>}
          </section>
        )}
        <footer className="tenant-footer"><span>© E-KUT · E-Kantin Universitas Terbuka</span><span>Tenant Management Portal</span></footer>
      </main>
      {rentalProofModal && (
        <div
          className="tenant-rental-proof-modal"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setRentalProofModal(null)
          }}
        >
          <section className="tenant-rental-proof-modal-content" role="dialog" aria-modal="true" aria-label={rentalProofModal.title}>
            <div className="tenant-rental-proof-modal-heading">
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

export default TenantDashboard
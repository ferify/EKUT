
import { useState } from 'react'
import type { FormEvent } from 'react'
import logo from './assets/ekutlogo.png'
import mascot from './assets/maskotcartremove.png'
import './LoginPage.css'

const API_URL = 'http://localhost:3000'

function LoginPage() {
  const [isResetMode, setIsResetMode] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [resetUsername, setResetUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const result = await response.json()

      if (!response.ok || result.status !== 'success') {
        throw new Error(
          result.message || 'Username atau password tidak sesuai.',
        )
      }

      const { token, user } = result.data

      // Keep the session for the current browser tab.
      sessionStorage.setItem('ekut_token', token)
      sessionStorage.setItem('ekut_user', JSON.stringify(user))

      // Optional convenience: remember the username only.
      if (rememberMe) {
        localStorage.setItem('ekut_username', username)
      } else {
        localStorage.removeItem('ekut_username')
      }

      if (user.role === 'admin') {
        window.location.href = '/admin'
      } else if (user.role === 'tenant') {
        window.location.href = '/tenant'
      } else {
        throw new Error('Role akun tidak dikenali.')
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Tidak dapat terhubung ke server.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi sandi baru tidak sama.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: resetUsername, newPassword }),
      })
      const result = await response.json()
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Sandi gagal diperbarui.')
      }

      setUsername(resetUsername)
      setPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setIsResetMode(false)
      setSuccess('Sandi berhasil dibuat ulang. Silakan masuk dengan sandi baru.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tidak dapat terhubung ke server.')
    } finally {
      setLoading(false)
    }
  }

  function switchResetMode() {
    setIsResetMode((current) => !current)
    setError('')
    setSuccess('')
    if (!isResetMode) setResetUsername(username)
  }

  function goToCustomer() {
    window.location.href = '/'
  }

  return (
    <main className="ekut-login">
      {/* LEFT: EKUT branding and mascot */}
      <section className="login-showcase">
        <div className="showcase-decoration decoration-one" />
        <div className="showcase-decoration decoration-two" />

        <header className="showcase-header">
          <img src={logo} alt="Logo E-KUT" className="showcase-logo" />
          <span className="showcase-caption">
            YOUR CAMPUS FOOD, MADE EASY.
          </span>
        </header>

        <div className="showcase-content">
          <p className="showcase-eyebrow">
            UNIVERSITAS TERBUKA
          </p>

          <h1>
            Welcome to
            <span>E-KUT!</span>
          </h1>

          <p className="showcase-description">
            E-Kantin UT Self Ordering &amp; CRM System
          </p>

          <div className="showcase-accent" />

          <p className="showcase-message">
            Pesan makanan favoritmu dengan mudah, dukung tenant
            kampus, dan nikmati pengalaman kantin yang lebih praktis.
          </p>

          <div className="showcase-features">
            <div className="feature-item">
              <span className="feature-icon" aria-hidden="true">
                🍽️
              </span>
              <span>
                Beragam
                <br />
                Pilihan Menu
              </span>
            </div>

            <div className="feature-item">
              <span className="feature-icon" aria-hidden="true">
                📱
              </span>
              <span>
                Pemesanan
                <br />
                Mudah &amp; Cepat
              </span>
            </div>

            <div className="feature-item">
              <span className="feature-icon" aria-hidden="true">
                💙
              </span>
              <span>
                Dukung
                <br />
                Tenant Kampus
              </span>
            </div>
          </div>
        </div>

        <div className="showcase-quote">
          <span className="quote-mark">“</span>
          <p>
            Good Food,
            <br />
            Brighter Days.
          </p>
          <span className="quote-line" />
        </div>

        <img
          src={mascot}
          alt="Maskot E-KUT"
          className="showcase-mascot"
        />

        <div className="showcase-bottom">
          <span>Made for the UT campus community</span>
          <span className="bottom-dot">●</span>
          <span>E-KUT Management Portal</span>
        </div>
      </section>

      {/* RIGHT: Login form */}
      <section className="login-panel">
        <div className="login-background-shape shape-top" />
        <div className="login-background-shape shape-bottom" />

        <div className="login-card">
          <div className="management-badge">
            <span aria-hidden="true">🍴</span>
            Management Portal
          </div>

          <div className="login-heading">
            <p className="login-eyebrow">{isResetMode ? 'RESET PASSWORD' : 'WELCOME BACK'}</p>
            <h2>{isResetMode ? 'Buat ulang sandi' : 'Sign in to E-KUT'}</h2>
            <p className="login-subtitle">
              {isResetMode
                ? 'Masukkan username dan sandi baru untuk akun demo.'
                : 'Login untuk mengakses dashboard admin atau tenant.'}
            </p>
          </div>

          {isResetMode ? (
            <form onSubmit={handlePasswordReset} className="login-form">
              <div className="reset-demo-notice" role="note">
                Reset sandi ini adalah simulasi demo tanpa OTP atau verifikasi identitas.
              </div>
              <label htmlFor="reset-username">Username</label>
              <div className="login-input-wrap">
                <span className="input-icon" aria-hidden="true">♙</span>
                <input
                  id="reset-username"
                  type="text"
                  value={resetUsername}
                  onChange={(event) => setResetUsername(event.target.value)}
                  placeholder="Masukkan username akun"
                  autoComplete="username"
                  maxLength={100}
                  required
                />
              </div>

              <label htmlFor="new-password">Sandi baru</label>
              <div className="login-input-wrap">
                <span className="input-icon" aria-hidden="true">♙</span>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Minimal 8 karakter"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                />
              </div>

              <label htmlFor="confirm-password">Konfirmasi sandi baru</label>
              <div className="login-input-wrap">
                <span className="input-icon" aria-hidden="true">♙</span>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Ulangi sandi baru"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                />
              </div>

              {error && <div className="login-error" role="alert"><span aria-hidden="true">⚠</span>{error}</div>}
              <button type="submit" className="login-submit" disabled={loading}>
                <span>{loading ? 'Memproses...' : 'Simpan sandi baru'}</span>
                {!loading && <span className="submit-arrow">→</span>}
              </button>
              <button type="button" className="reset-back-button" onClick={switchResetMode} disabled={loading}>
                ← Kembali ke login
              </button>
            </form>
          ) : (
          <form onSubmit={handleLogin} className="login-form">
            <label htmlFor="username">Username</label>

            <div className="login-input-wrap">
              <span className="input-icon" aria-hidden="true">
                ♙
              </span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Masukkan username"
                autoComplete="username"
                required
              />
            </div>

            <label htmlFor="password">Password</label>

            <div className="login-input-wrap">
              <span className="input-icon" aria-hidden="true">
                ♙
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={
                  showPassword
                    ? 'Sembunyikan password'
                    : 'Tampilkan password'
                }
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            <div className="login-options">
              <label className="remember-option">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) =>
                    setRememberMe(event.target.checked)
                  }
                />
                <span>Ingat username</span>
              </label>

              <button type="button" className="forgot-label" onClick={switchResetMode}>Lupa sandi?</button>
            </div>

            {success && <div className="login-success" role="status">{success}</div>}
            {error && (
              <div className="login-error" role="alert">
                <span aria-hidden="true">⚠</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              <span>{loading ? 'Memproses...' : 'Login'}</span>
              {!loading && <span className="submit-arrow">→</span>}
            </button>
          </form>
          )}

          {!isResetMode && <div className="login-divider">
            <span />
            <p>atau</p>
            <span />
          </div>}

          {!isResetMode && <button
            type="button"
            className="customer-button"
            onClick={goToCustomer}
          >
            <span aria-hidden="true">⌂</span>
            Kembali ke halaman customer
          </button>}

          <div className="login-card-footer">
            <div className="footer-food-icons" aria-hidden="true">
              <svg className="food-character food-character--ramen" viewBox="0 0 48 48">
                <path d="M16 13c-2-2 1-3 0-5m8 5c-2-2 1-3 0-5m8 5c-2-2 1-3 0-5" fill="none" stroke="#f0a94b" strokeLinecap="round" strokeWidth="2" />
                <path d="M8 20h32l-4 16a5 5 0 0 1-5 4H17a5 5 0 0 1-5-4L8 20Z" fill="#f27b69" />
                <path d="M8 20h32" fill="none" stroke="#fff2d7" strokeLinecap="round" strokeWidth="3" />
                <path d="M18 28v2m12-2v2m-10 4c2 2 6 2 8 0" fill="none" stroke="#563c44" strokeLinecap="round" strokeWidth="2" />
                <path d="M14 40h20" fill="none" stroke="#c65a55" strokeLinecap="round" strokeWidth="2" />
              </svg>
              <svg className="food-character food-character--drink" viewBox="0 0 48 48">
                <path d="m27 8 5 4" fill="none" stroke="#8b6bd6" strokeLinecap="round" strokeWidth="2.5" />
                <path d="M15 15h20l-2 25H17l-2-25Z" fill="#a88be8" />
                <path d="M16 20h18l-1 16H17l-1-16Z" fill="#f8c5dc" />
                <path d="M20 27v2m9-2v2m-7 4c1.5 1.5 3.5 1.5 5 0" fill="none" stroke="#51436a" strokeLinecap="round" strokeWidth="2" />
                <path d="M14 15h22" fill="none" stroke="#7558be" strokeLinecap="round" strokeWidth="2" />
                <circle cx="21" cy="37" r="1.4" fill="#fff" />
                <circle cx="28" cy="37" r="1.4" fill="#fff" />
              </svg>
              <svg className="food-character food-character--cake" viewBox="0 0 48 48">
                <path d="M8 35 19 13l21 22H8Z" fill="#f3b866" />
                <path d="m19 13 5 5 4-3 4 5 5-2 3 17H8l4-8 5 1 2-7Z" fill="#fff0d2" />
                <path d="m19 13 5 5 4-3 4 5 5-2" fill="none" stroke="#f28c9a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                <path d="M22 27v2m9-2v2m-7 4c1.5 1.5 3.5 1.5 5 0" fill="none" stroke="#594751" strokeLinecap="round" strokeWidth="2" />
                <path d="M8 37h32" fill="none" stroke="#d8894c" strokeLinecap="round" strokeWidth="2" />
                <circle cx="19" cy="20" r="2" fill="#ff7f91" />
              </svg>
            </div>

            <div className="footer-brand">
              <strong>E-KUT</strong>
              <span>E-Kantin Universitas Terbuka</span>
            </div>
          </div>
        </div>

        <p className="login-panel-footer">
          © E-KUT · E-Kantin Universitas Terbuka
        </p>
      </section>
    </main>
  )
}

export default LoginPage

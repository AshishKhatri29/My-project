import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Apple,
  ChevronDown,
  Clock3,
  Coffee,
  Cookie,
  Milk,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  X,
  MapPin,
  Leaf,
  Croissant,
  PackageCheck,
  LayoutDashboard,
  Save,
  LogOut,
  UserRound,
} from 'lucide-react'
import { defaultProducts } from './catalog.js'
import { supabase } from './lib/supabase.js'

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(result.error || `Request failed (${response.status}).`)
    error.status = response.status
    throw error
  }
  return result
}

const categories = [
  { name: 'All', icon: Sparkles, color: 'cat-all' },
  { name: 'Fruits & Veggies', icon: Apple, color: 'cat-produce' },
  { name: 'Dairy & Eggs', icon: Milk, color: 'cat-dairy' },
  { name: 'Bakery', icon: Croissant, color: 'cat-bakery' },
  { name: 'Snacks', icon: Cookie, color: 'cat-snacks' },
  { name: 'Drinks', icon: Coffee, color: 'cat-drinks' },
]

const sampleRestaurants = [
  {
    name: 'Indiranagar Tiffin Co.',
    cuisine: 'South Indian · Breakfast & meals',
    area: 'Indiranagar',
    deliveryTime: '25–35 min',
    image: 'photo-1589302168068-964664d93dc0',
    imageAlt: 'A South Indian meal served on a banana leaf',
  },
  {
    name: 'Koramangala Curry House',
    cuisine: 'Indian · Curries & biryani',
    area: 'Koramangala',
    deliveryTime: '30–40 min',
    image: 'photo-1565557623262-b51c2513a641',
    imageAlt: 'A bowl of Indian curry garnished with herbs',
  },
  {
    name: 'HSR Oven & Table',
    cuisine: 'Pizza · Pasta · Bakery',
    area: 'HSR Layout',
    deliveryTime: '25–35 min',
    image: 'photo-1513104890138-7c749659a591',
    imageAlt: 'Freshly baked pizza topped with vegetables',
  },
]

const imageUrl = (id, width = 600) => id.startsWith('https://')
  ? id
  : `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`
const money = (amount) => `₹${amount}`

function normalizeIndianMobile(value) {
  const digits = value.replace(/\D/g, '')
  const localNumber = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits
  return /^[6-9]\d{9}$/.test(localNumber) ? `+91${localNumber}` : null
}

function indianMobileLocalPart(value) {
  return value?.replace(/^\+91/, '') || ''
}

const emptyCustomerProfile = {
  full_name: '',
  phone: '',
  email: '',
  gender: '',
  house_number: '',
  street: '',
  area: '',
  city: '',
  state: '',
  pincode: '',
}

function isCustomerProfileComplete(profile, verifiedPhone) {
  return Boolean(
    profile
    && verifiedPhone
    && profile.phone === verifiedPhone
    && ['full_name', 'phone', 'email', 'gender', 'house_number', 'street', 'area', 'city', 'state', 'pincode']
      .every((field) => typeof profile[field] === 'string' && profile[field].trim())
    && /^[0-9]{6}$/.test(profile.pincode),
  )
}

function customerAuthErrorMessage(error) {
  const code = error?.code || ''
  const message = error?.message || ''

  if (/unsupported phone provider|phone provider.*not enabled/i.test(message)) {
    return 'Mobile sign-in is unavailable because Phone Auth is not enabled for this Supabase project. Enable the Phone provider and configure an SMS provider in Supabase, then try again.'
  }
  if (/unsupported provider|provider is not enabled/i.test(message)) {
    return 'This sign-in provider is not enabled in Supabase. Enable the requested provider in Authentication settings, then try again.'
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return 'Please verify your email address using the link we sent before signing in.'
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return 'The email or password is incorrect. Check your details or create an account.'
  }
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered/i.test(message)) {
    return 'An account with this email already exists. Sign in instead.'
  }
  if (code === 'weak_password') {
    return 'Choose a stronger password that meets the password requirements.'
  }
  if (code === 'over_email_send_rate_limit') {
    return 'Too many emails were requested. Please wait a few minutes and try again.'
  }
  if (code === 'phone_exists' || /phone number.*(already|registered|exists)/i.test(message)) {
    return 'This mobile number is already linked to another account. Sign in to that account or use a different number.'
  }
  if (code === 'over_sms_send_rate_limit' || code === 'sms_send_failed' || /sms.*rate limit/i.test(message)) {
    return 'SMS could not be sent right now. Wait a few minutes before requesting another code.'
  }
  if (code === 'otp_expired' && /phone|sms/i.test(message)) {
    return 'That verification code has expired. Request a new code and try again.'
  }
  if (/invalid.*(otp|token)|otp.*invalid/i.test(message)) {
    return 'That verification code is incorrect. Check the code and try again.'
  }
  if (code === 'otp_expired' || /expired|invalid.*token/i.test(message)) {
    return 'This link has expired or is invalid. Request a new password reset or verification email.'
  }
  return message || 'Authentication could not be completed. Please try again.'
}

function ProductCard({ product, quantity, onAdd, onChange }) {
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <img className="product-image" src={imageUrl(product.image)} alt={product.name} loading="lazy" />
        {product.badge && <span className={`product-badge ${product.badge.includes('OFF') ? 'sale-badge' : ''}`}>{product.badge}</span>}
        {quantity > 0 && <span className="in-cart-label">IN YOUR BAG</span>}
      </div>
      <div className="product-copy">
        <span className="product-size">{product.detail}</span>
        <h3>{product.name}</h3>
        <div className="product-bottom">
          <div className="price-line"><strong>{money(product.price)}</strong>{product.oldPrice && <del>{money(product.oldPrice)}</del>}</div>
          {quantity > 0 ? (
            <div className="quantity-control" aria-label={`${quantity} ${product.name} in bag`}>
              <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => onChange(product.id, -1)}><Minus size={14} /></button>
              <span>{quantity}</span>
              <button type="button" aria-label={`Add one ${product.name}`} onClick={() => onChange(product.id, 1)}><Plus size={14} /></button>
            </div>
          ) : (
            <button className="add-button" type="button" onClick={() => onAdd(product)}>ADD <Plus size={14} /></button>
          )}
        </div>
      </div>
    </article>
  )
}

function BasketDrawer({ items, subtotal, onClose, onChange }) {
  const [checkoutNotice, setCheckoutNotice] = useState('')
  const delivery = subtotal >= 499 ? 0 : subtotal === 0 ? 0 : 25
  const total = subtotal + delivery
  const count = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="basket-drawer" role="dialog" aria-modal="true" aria-labelledby="basket-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <div><span className="section-kicker">YOUR QUICK HAUL</span><h2 id="basket-title">My basket <span>({count})</span></h2></div>
          <button className="close-button" type="button" aria-label="Close basket" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="delivery-strip"><Clock3 size={16} /> Delivering in 10–15 minutes</div>
        {items.length === 0 ? (
          <div className="empty-basket">
            <span className="empty-icon"><ShoppingBag size={32} /></span>
            <h3>Your basket is empty</h3>
            <p>Good things are just a tap away.</p>
            <button className="checkout-button" type="button" onClick={onClose}>Start shopping <ArrowRight size={17} /></button>
          </div>
        ) : (
          <>
            <div className="basket-items">
              {items.map(({ product, quantity }) => (
                <div className="basket-item" key={product.id}>
                  <img src={imageUrl(product.image, 180)} alt="" />
                  <div className="basket-item-info"><h3>{product.name}</h3><span>{product.detail}</span><strong>{money(product.price * quantity)}</strong></div>
                  <div className="quantity-control"><button type="button" aria-label={`Remove one ${product.name}`} onClick={() => onChange(product.id, -1)}><Minus size={13} /></button><span>{quantity}</span><button type="button" aria-label={`Add one ${product.name}`} onClick={() => onChange(product.id, 1)}><Plus size={13} /></button></div>
                </div>
              ))}
            </div>
            {subtotal < 499 && <p className="free-delivery-note">Add {money(499 - subtotal)} more for free delivery</p>}
            <div className="bill-summary">
              <div><span>Item total</span><span>{money(subtotal)}</span></div>
              <div><span>Delivery fee</span><span>{delivery === 0 ? <b className="free">FREE</b> : money(delivery)}</span></div>
              <div className="bill-total"><strong>To pay</strong><strong>{money(total)}</strong></div>
              <button className="checkout-button" type="button" onClick={() => setCheckoutNotice('Checkout is a demo and payment is not connected yet.')}>Proceed to checkout <ArrowRight size={17} /></button>
              {checkoutNotice && <p className="checkout-notice" role="status">{checkoutNotice}</p>}
              <p className="packed-note"><PackageCheck size={15} /> Packed fresh, delivered fast</p>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

function LocationDialog({ location, onChoose, onClose }) {
  const locations = ['Indiranagar, Bengaluru', 'Koramangala, Bengaluru', 'HSR Layout, Bengaluru']
  return (
    <div className="drawer-backdrop location-backdrop" onMouseDown={onClose}>
      <section className="location-dialog" role="dialog" aria-modal="true" aria-labelledby="location-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="close-button location-close" type="button" aria-label="Close locations" onClick={onClose}><X size={19} /></button>
        <span className="location-pin"><MapPin size={20} /></span>
        <span className="section-kicker">DELIVERY LOCATION</span>
        <h2 id="location-title">Where should we deliver?</h2>
        <p>Choose your neighbourhood to see what’s available nearby.</p>
        <div className="location-options">{locations.map((place) => <button type="button" key={place} className={place === location ? 'location-option selected' : 'location-option'} onClick={() => { onChoose(place); onClose() }}><MapPin size={16} /><span>{place}</span>{place === location && <span className="selected-check">✓</span>}</button>)}</div>
      </section>
    </div>
  )
}

function CustomerAccount({ session, onSessionChange, onRecoveryComplete, onProfileStatus, initialMode = 'login', navigate }) {
  const [mode, setMode] = useState(initialMode)
  const [authMethod, setAuthMethod] = useState('email')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [phoneMessage, setPhoneMessage] = useState('')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [phoneTarget, setPhoneTarget] = useState('')
  const [phoneSubmitting, setPhoneSubmitting] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [phoneChangeOpen, setPhoneChangeOpen] = useState(false)
  const [phoneOtpPurpose, setPhoneOtpPurpose] = useState('change')
  const [customerProfile, setCustomerProfile] = useState(null)
  const [profileDraft, setProfileDraft] = useState(emptyCustomerProfile)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const phoneOtpAttempted = useRef('')

  useEffect(() => {
    setMode(initialMode)
    setError('')
    if (initialMode === 'recovery') setMessage('')
  }, [initialMode])

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const providerError = searchParams.get('error_description')
      || searchParams.get('error')
      || hashParams.get('error_description')
      || hashParams.get('error')
    if (!providerError) return
    setError(customerAuthErrorMessage(new Error(providerError)))
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  useEffect(() => {
    const profilePhone = session?.user?.phone || session?.user?.user_metadata?.pending_phone || ''
    setPhoneNumber(indianMobileLocalPart(profilePhone))
  }, [session?.user?.id, session?.user?.phone, session?.user?.user_metadata?.pending_phone])

  useEffect(() => {
    if (!resendCooldown) return undefined
    const timer = window.setTimeout(() => setResendCooldown((current) => Math.max(0, current - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [resendCooldown])

  useEffect(() => {
    let active = true
    const user = session?.user
    if (!user || !supabase) {
      setCustomerProfile(null)
      setProfileDraft(emptyCustomerProfile)
      setProfileLoading(false)
      setProfileError('')
      return () => { active = false }
    }

    setProfileLoading(true)
    setProfileError('')
    supabase
      .from('customer_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (queryError) throw queryError
        if (!active) return
        setCustomerProfile(data)
        setProfileDraft({
          ...emptyCustomerProfile,
          ...data,
          full_name: data?.full_name || user.user_metadata?.full_name || '',
          phone: user.phone_confirmed_at ? user.phone : '',
          email: data?.email || user.email || '',
        })
        onProfileStatus?.(isCustomerProfileComplete(data, user.phone_confirmed_at ? user.phone : '') ? 'complete' : 'incomplete')
      })
      .catch((loadError) => {
        if (!active) return
        console.error('Unable to load customer profile:', loadError)
        setProfileError('Your profile could not be loaded. Check that the customer profile migration is applied and try again.')
        onProfileStatus?.('incomplete')
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })

    return () => { active = false }
  }, [session?.user?.id, session?.user?.phone, session?.user?.phone_confirmed_at, onProfileStatus])

  async function sendPhoneOtp(value = phoneNumber, purpose = 'change') {
    const normalizedPhone = normalizeIndianMobile(value)
    if (!normalizedPhone) {
      setPhoneError('Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.')
      setPhoneMessage('')
      return false
    }
    if (!supabase) {
      setPhoneError('Supabase is not configured, so SMS verification is unavailable.')
      setPhoneMessage('')
      return false
    }
    if (resendCooldown > 0) return false

    setPhoneSubmitting(true)
    setPhoneError('')
    setPhoneMessage('')
    setResendCooldown(60)
    setPhoneOtpPurpose(purpose)
    try {
      if (purpose === 'login' || purpose === 'register') {
        const { error: sendError } = await supabase.auth.signInWithOtp({
          phone: normalizedPhone,
          options: { shouldCreateUser: purpose === 'register' },
        })
        if (sendError) throw sendError
      } else {
        const { error: updateError } = await supabase.auth.updateUser({ phone: normalizedPhone })
        if (updateError) throw updateError
      }
      setPhoneTarget(normalizedPhone)
      setPhoneNumber(indianMobileLocalPart(normalizedPhone))
      setPhoneOtp('')
      setPhoneOtpSent(true)
      setPhoneMessage(`Verification code sent by SMS to +91 ${indianMobileLocalPart(normalizedPhone)}. It expires according to your Supabase OTP settings.`)
      return true
    } catch (authError) {
      setPhoneError(customerAuthErrorMessage(authError))
      return false
    } finally {
      setPhoneSubmitting(false)
    }
  }

  async function resendPhoneOtp() {
    if (!supabase || !phoneTarget || resendCooldown > 0) return
    setPhoneSubmitting(true)
    setPhoneError('')
    setPhoneMessage('')
    setResendCooldown(60)
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: phoneOtpPurpose === 'change' ? 'phone_change' : 'sms',
        phone: phoneTarget,
      })
      if (resendError) throw resendError
      setPhoneMessage(`A new verification code was sent by SMS to +91 ${indianMobileLocalPart(phoneTarget)}.`)
    } catch (authError) {
      setPhoneError(customerAuthErrorMessage(authError))
    } finally {
      setPhoneSubmitting(false)
    }
  }

  async function verifyPhoneOtp(event) {
    event?.preventDefault()
    if (!supabase || !phoneTarget) {
      setPhoneError('Request a verification code before entering it.')
      return
    }
    const token = phoneOtp.trim()
    if (!/^\d{6}$/.test(token)) {
      setPhoneError('Enter the 6-digit SMS verification code.')
      return
    }

    setPhoneSubmitting(true)
    setPhoneError('')
    setPhoneMessage('')
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: phoneTarget,
        token,
        type: phoneOtpPurpose === 'change' ? 'phone_change' : 'sms',
      })
      if (verifyError) throw verifyError
      if (data.user?.phone !== phoneTarget || !data.user?.phone_confirmed_at) {
        throw new Error('Supabase did not confirm this mobile number. It will remain unverified.')
      }
      if (data.session) onSessionChange(data.session)
      setPhoneOtpSent(false)
      setPhoneChangeOpen(false)
      setPhoneOtp('')
      setResendCooldown(0)
      if (phoneOtpPurpose === 'login' || phoneOtpPurpose === 'register') {
        setMode('account')
        setProfileEditing(false)
        setPhoneMessage(phoneOtpPurpose === 'register' ? 'Your mobile number was verified by Supabase. Complete your customer profile to finish creating your account.' : 'Mobile OTP verified by Supabase. Checking your customer profile…')
        if (phoneOtpPurpose === 'login') setMessage('You are signed in with your verified mobile number.')
      } else {
        setProfileDraft((current) => ({ ...current, phone: data.user.phone }))
        setPhoneMessage('Mobile number verified successfully by Supabase.')
      }
    } catch (authError) {
      setPhoneError(authError.code === 'otp_expired'
        ? 'That SMS verification code is invalid or expired. Request a new code and try again.'
        : customerAuthErrorMessage(authError))
    } finally {
      setPhoneSubmitting(false)
    }
  }

  useEffect(() => {
    const pendingPhone = session?.user?.user_metadata?.pending_phone
    const hasVerifiedPhone = Boolean(session?.user?.phone && session?.user?.phone_confirmed_at)
    if (!session?.user?.email_confirmed_at || hasVerifiedPhone || !pendingPhone || mode === 'recovery') return
    const attemptKey = `${session.user.id}:${pendingPhone}`
    if (phoneOtpAttempted.current === attemptKey) return
    phoneOtpAttempted.current = attemptKey
    sendPhoneOtp(pendingPhone)
  }, [session?.user?.id, session?.user?.email_confirmed_at, session?.user?.phone, session?.user?.user_metadata?.pending_phone, mode])

  useEffect(() => {
    if (session?.user?.email_confirmed_at) {
      setMessage('Your email is verified and you are signed in.')
    }
  }, [session?.user?.id])

  async function submit(event) {
    event.preventDefault()
    if ((mode === 'login' || mode === 'register') && authMethod === 'phone') {
      if (phoneOtpSent) {
        await verifyPhoneOtp(event)
      } else {
        await sendPhoneOtp(phoneNumber, mode === 'register' ? 'register' : 'login')
      }
      return
    }
    if (!supabase) {
      setError('Supabase is not configured. In .env, replace VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY with your project’s real public values, then restart the app.')
      return
    }
    if (mode === 'register' && authMethod === 'email') {
      if (!fullName.trim()) {
        setError('Enter your full name to create an account.')
        return
      }
    }
    if ((mode === 'register' || mode === 'recovery') && password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: window.location.origin,
          },
        })
        if (signUpError) throw signUpError
        if (data.user?.identities?.length === 0) {
          setError('An account with this email already exists. Sign in instead or use a different email address.')
          setMode('login')
          return
        }
        if (data.session) {
          if (!data.user?.email_confirmed_at) {
            const { error: signOutError } = await supabase.auth.signOut()
            if (signOutError) throw signOutError
            onSessionChange(null)
            setError('Your account was created, but Supabase did not confirm the email address. Enable email confirmations in Supabase, verify your email, then sign in to continue phone verification.')
            setMode('login')
          } else {
            onSessionChange(data.session)
            setMode('account')
            setMessage('Account created. Complete your customer profile to continue.')
          }
        } else {
          setMessage(`Account created successfully. Check ${email.trim()} for the verification link, then sign in to complete your customer profile.`)
          setMode('login')
        }
        setPassword('')
        setConfirmPassword('')
      } else if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        })
        if (resetError) throw resetError
        setMessage(`If an account exists for ${email.trim()}, password reset instructions will be sent. Check your inbox and spam folder.`)
      } else if (mode === 'recovery') {
        const { error: updateError } = await supabase.auth.updateUser({ password })
        if (updateError) throw updateError
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        onSessionChange(sessionData.session)
        onRecoveryComplete()
        setPassword('')
        setConfirmPassword('')
        setMode('account')
        setMessage('Your password has been updated.')
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) throw signInError
        if (!data.user?.email_confirmed_at) {
          const { error: signOutError } = await supabase.auth.signOut()
          if (signOutError) throw signOutError
          onSessionChange(null)
          throw new Error('Please verify your email address before signing in.')
        }
        onSessionChange(data.session)
        setMessage('You are signed in. Your email is verified.')
      }
    } catch (authError) {
      setError(customerAuthErrorMessage(authError))
    } finally {
      setSubmitting(false)
    }
  }

  async function signInWithProvider(provider) {
    if (!supabase) {
      setError('Supabase is not configured. Set the public project URL and anon/publishable key, then restart the app.')
      return
    }
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/login` },
      })
      if (oauthError) throw oauthError
    } catch (oauthError) {
      setError(customerAuthErrorMessage(oauthError))
      setSubmitting(false)
    }
  }

  async function signOut() {
    if (!supabase) {
      setError('Supabase is not configured, so you cannot sign out right now.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      onSessionChange(null)
      setMode('login')
      setMessage('You are signed out.')
      navigate?.('/login')
    } catch (authError) {
      setError(customerAuthErrorMessage(authError))
    } finally {
      setSubmitting(false)
    }
  }

  async function saveCustomerProfile(event) {
    event.preventDefault()
    if (!session?.user || !supabase) {
      setProfileError('Sign in again before saving your customer profile.')
      return
    }
    const verifiedPhone = session.user.phone_confirmed_at ? session.user.phone : ''
    if (!verifiedPhone) {
      setProfileError('Verify your mobile number with the Supabase SMS code before saving your profile.')
      return
    }

    const profile = {
      user_id: session.user.id,
      full_name: profileDraft.full_name.trim(),
      phone: verifiedPhone,
      email: profileDraft.email.trim(),
      gender: profileDraft.gender,
      house_number: profileDraft.house_number.trim(),
      street: profileDraft.street.trim(),
      area: profileDraft.area.trim(),
      city: profileDraft.city.trim(),
      state: profileDraft.state.trim(),
      pincode: profileDraft.pincode.trim(),
    }
    const requiredFields = Object.entries(profile).filter(([field]) => field !== 'user_id' && field !== 'phone')
    if (requiredFields.some(([, value]) => !value)) {
      setProfileError('Complete every required profile field before saving.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      setProfileError('Enter a valid email address.')
      return
    }
    if (!['Male', 'Female', 'Prefer not to say'].includes(profile.gender)) {
      setProfileError('Choose one of the listed gender options.')
      return
    }
    if (!/^\d{6}$/.test(profile.pincode)) {
      setProfileError('Enter a valid 6-digit PIN code.')
      return
    }

    setProfileSaving(true)
    setProfileError('')
    setProfileMessage('')
    try {
      const { data, error: saveError } = await supabase
        .from('customer_profiles')
        .upsert(profile, { onConflict: 'user_id' })
        .select('*')
        .single()
      if (saveError) throw saveError
      setCustomerProfile(data)
      setProfileDraft({ ...emptyCustomerProfile, ...data })
      setProfileEditing(false)
      setProfileMessage('Your customer profile has been saved.')
      onProfileStatus?.('complete')
      navigate?.('/', true)
    } catch (saveError) {
      console.error('Unable to save customer profile:', saveError)
      setProfileError(saveError.message || 'Your profile could not be saved. Please try again.')
    } finally {
      setProfileSaving(false)
    }
  }

  const displayName = session?.user?.user_metadata?.full_name?.trim()
  const displayEmail = session?.user?.email
  const verifiedPhone = session?.user?.phone_confirmed_at ? session.user.phone : ''
  const pendingPhone = session?.user?.user_metadata?.pending_phone || ''
  const profileComplete = isCustomerProfileComplete(customerProfile, verifiedPhone)

  return (
    <main className={`auth-page ${session ? 'auth-page-profile' : ''}`}>
      <div className="auth-layout">
        <section className="auth-story" aria-label="ZIPZY">
          <a href="/" className="brand auth-brand" onClick={(event) => { event.preventDefault(); navigate?.('/') }} aria-label="Zipzy home"><span className="brand-mark"><ShoppingBag size={20} strokeWidth={2.6} /></span><span>zipzy<span className="brand-period">.</span></span></a>
          <div className="auth-story-copy">
            <span className="section-kicker">GOOD STUFF. QUICK.</span>
            <h1>Your neighbourhood store, in your pocket.</h1>
            <p>Sign in or create your ZIPZY account for fresh picks, quick delivery, and a smoother checkout.</p>
          </div>
          <div className="auth-story-tag"><Sparkles size={16} /> Fresh picks, delivered fast</div>
        </section>
        <section className="auth-card" aria-labelledby="customer-account-title">
          {session ? <button className="auth-back-link" type="button" onClick={() => navigate?.('/')}>← Back to store</button> : null}
          <span className="login-icon"><UserRound size={22} /></span>
          <span className="section-kicker">{session ? 'YOUR ZIPZY ACCOUNT' : 'WELCOME TO ZIPZY'}</span>
          <h2 id="customer-account-title">{session && mode !== 'recovery' ? customerProfile?.full_name || profileDraft.full_name || displayName || 'Complete your account' : mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : mode === 'recovery' ? 'Choose a new password' : 'Welcome back'}</h2>
          <p className="auth-card-intro">{session ? customerProfile?.email || displayEmail || 'Complete your customer profile.' : 'Sign in or create an account to continue.'}</p>

        {session && mode !== 'recovery' ? (
          <div className="customer-account-actions">
            {profileLoading ? <p className="customer-account-note" role="status">Loading your customer profile…</p> : null}
            {profileError && <p className="admin-alert" role="alert">{profileError}</p>}
            {!profileLoading && (profileEditing || !profileComplete) ? (
              <>
                <p className="customer-account-note">{profileComplete ? 'Edit your saved customer details.' : 'Complete your customer details to finish setting up your account.'}</p>
                <form className="customer-profile-form" onSubmit={saveCustomerProfile}>
                  <label>Full name<input value={profileDraft.full_name} onChange={(event) => setProfileDraft({ ...profileDraft, full_name: event.target.value })} required maxLength={100} /></label>
                  <label>Email address<input type="email" value={profileDraft.email} onChange={(event) => setProfileDraft({ ...profileDraft, email: event.target.value })} required maxLength={254} /></label>
                  <label>Verified mobile number
                    {verifiedPhone && !phoneChangeOpen ? <input value={verifiedPhone} readOnly aria-readonly="true" /> : (
                      <span className="phone-input-wrap"><span>+91</span><input type="tel" inputMode="numeric" autoComplete="tel-national" aria-label="10-digit Indian mobile number" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" disabled={phoneOtpSent || phoneSubmitting} required /></span>
                    )}
                  </label>
                  {!verifiedPhone || phoneChangeOpen ? (
                    <div className="customer-phone-verification">
                      {!phoneOtpSent ? (
                        <button type="button" className="customer-auth-submit" onClick={() => sendPhoneOtp()} disabled={phoneSubmitting || resendCooldown > 0}>
                          {phoneSubmitting ? 'Sending SMS…' : resendCooldown > 0 ? `Wait ${resendCooldown}s to resend` : 'Send SMS verification code'}<ArrowRight size={16} />
                        </button>
                      ) : (
                        <>
                          <p className="customer-verification-note">Enter the 6-digit code sent by Supabase to +91 {indianMobileLocalPart(phoneTarget)}.</p>
                          <div className="phone-otp-form">
                            <label>SMS verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" value={phoneOtp} onChange={(event) => setPhoneOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required minLength={6} maxLength={6} /></label>
                            <button type="button" className="customer-auth-submit" onClick={() => verifyPhoneOtp()} disabled={phoneSubmitting}>{phoneSubmitting ? 'Verifying…' : 'Verify mobile number'}<ArrowRight size={16} /></button>
                          </div>
                          <button type="button" className="customer-auth-link" onClick={resendPhoneOtp} disabled={phoneSubmitting || resendCooldown > 0}>{resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend SMS code'}</button>
                          <button type="button" className="customer-auth-link" onClick={() => { setPhoneOtpSent(false); setPhoneTarget(''); setPhoneOtp(''); setPhoneMessage(''); setPhoneError(''); setResendCooldown(0) }}>Use a different number</button>
                        </>
                      )}
                      {phoneError && <p className="admin-alert" role="alert">{phoneError}</p>}
                      {phoneMessage && <p className="admin-success" role="status">{phoneMessage}</p>}
                    </div>
                  ) : null}
                  <label>Gender<select value={profileDraft.gender} onChange={(event) => setProfileDraft({ ...profileDraft, gender: event.target.value })} required>
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select></label>
                  <label>House number<input value={profileDraft.house_number} onChange={(event) => setProfileDraft({ ...profileDraft, house_number: event.target.value })} required maxLength={100} /></label>
                  <label>Street<input value={profileDraft.street} onChange={(event) => setProfileDraft({ ...profileDraft, street: event.target.value })} required maxLength={150} /></label>
                  <label>Area / locality<input value={profileDraft.area} onChange={(event) => setProfileDraft({ ...profileDraft, area: event.target.value })} required maxLength={150} /></label>
                  <label>City<input value={profileDraft.city} onChange={(event) => setProfileDraft({ ...profileDraft, city: event.target.value })} required maxLength={100} /></label>
                  <label>State<input value={profileDraft.state} onChange={(event) => setProfileDraft({ ...profileDraft, state: event.target.value })} required maxLength={100} /></label>
                  <label>6-digit PIN code<input type="text" inputMode="numeric" autoComplete="postal-code" value={profileDraft.pincode} onChange={(event) => setProfileDraft({ ...profileDraft, pincode: event.target.value.replace(/\D/g, '').slice(0, 6) })} required minLength={6} maxLength={6} /></label>
                  <button type="submit" className="customer-auth-submit" disabled={profileSaving || profileLoading || !verifiedPhone || phoneChangeOpen}>{profileSaving ? 'Saving profile…' : phoneChangeOpen ? 'Verify your new mobile number first' : !verifiedPhone ? 'Verify mobile to save profile' : profileComplete ? 'Save profile changes' : 'Save customer profile'}<ArrowRight size={16} /></button>
                  {profileComplete && <button type="button" className="customer-auth-link" onClick={() => { setProfileEditing(false); setProfileError('') }}>Cancel editing</button>}
                </form>
              </>
            ) : !profileLoading ? (
              <>
                <div className="customer-profile">
                  <div><span>Email</span><strong>{customerProfile.email}</strong></div>
                  <div><span>Verified mobile number</span><strong>{customerProfile.phone}</strong></div>
                  <div><span>Gender</span><strong>{customerProfile.gender}</strong></div>
                  <div><span>House number</span><strong>{customerProfile.house_number}</strong></div>
                  <div><span>Street</span><strong>{customerProfile.street}</strong></div>
                  <div><span>Area / locality</span><strong>{customerProfile.area}</strong></div>
                  <div><span>City</span><strong>{customerProfile.city}</strong></div>
                  <div><span>State</span><strong>{customerProfile.state}</strong></div>
                  <div><span>PIN code</span><strong>{customerProfile.pincode}</strong></div>
                </div>
                <button type="button" className="customer-auth-link" onClick={() => { setProfileEditing(true); setProfileMessage('') }}>Edit profile</button>
                <button type="button" className="customer-auth-link" onClick={() => { setProfileEditing(true); setPhoneChangeOpen(true); setPhoneNumber(''); setPhoneError(''); setPhoneMessage('') }}>Change mobile number</button>
              </>
            ) : null}
            {profileMessage && <p className="admin-success" role="status">{profileMessage}</p>}
            {error && <p className="admin-alert" role="alert">{error}</p>}
            {message && <p className="admin-success" role="status">{message}</p>}
            <button type="button" className="customer-auth-submit" onClick={signOut} disabled={submitting}>{submitting ? 'Signing out…' : 'Sign out'}<LogOut size={16} /></button>
          </div>
        ) : (
          <>
            {(mode === 'login' || mode === 'register') && <div className="auth-main-tabs" aria-label="Account action">
              <button type="button" aria-pressed={mode === 'login'} className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setAuthMethod('email'); setPhoneOtpSent(false); setError(''); setMessage('') }}>Sign In</button>
              <button type="button" aria-pressed={mode === 'register'} className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setAuthMethod('email'); setPhoneOtpSent(false); setError(''); setMessage('') }}>Create Account</button>
            </div>}
            {(mode === 'login' || mode === 'register') && <div className="auth-method-switch" aria-label="Authentication method">
              <button type="button" aria-pressed={authMethod === 'email'} className={authMethod === 'email' ? 'selected' : ''} onClick={() => { setAuthMethod('email'); setPhoneOtpSent(false); setPhoneError(''); setPhoneMessage(''); setError(''); setMessage('') }}>Email &amp; Password</button>
              <button type="button" aria-pressed={authMethod === 'phone'} className={authMethod === 'phone' ? 'selected' : ''} onClick={() => { setAuthMethod('phone'); setPhoneOtpSent(false); setPhoneOtpPurpose(mode === 'register' ? 'register' : 'login'); setPhoneError(''); setPhoneMessage(''); setError(''); setMessage('') }}>Mobile OTP</button>
            </div>}
            <form className="login-form" onSubmit={submit}>
              {(mode === 'login' || mode === 'register') && authMethod === 'phone' && <>
                <label>Mobile number<span className="phone-input-wrap"><span>+91</span><input type="tel" inputMode="numeric" autoComplete="tel-national" aria-label="10-digit Indian mobile number" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" required disabled={phoneOtpSent} /></span></label>
                {phoneOtpSent && <label>SMS verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" value={phoneOtp} onChange={(event) => setPhoneOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required minLength={6} maxLength={6} /></label>}
              </>}
              {mode === 'register' && authMethod === 'email' && <label>Full name<input autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={100} /></label>}
              {mode !== 'recovery' && !(mode !== 'forgot' && authMethod === 'phone') && <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></label>}
              {mode !== 'forgot' && !(mode !== 'recovery' && authMethod === 'phone') && <label>{mode === 'recovery' ? 'New password' : 'Password'}<input type="password" autoComplete={mode === 'register' || mode === 'recovery' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label>}
              {(mode === 'register' && authMethod === 'email' || mode === 'recovery') && <label>{mode === 'register' ? 'Confirm password' : 'Confirm new password'}<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} /></label>}
              {error && <p className="admin-alert" role="alert">{error}</p>}
              {message && <p className="admin-success" role="status">{message}</p>}
              {phoneError && mode === 'login' && authMethod === 'phone' && <p className="admin-alert" role="alert">{phoneError}</p>}
              {phoneMessage && mode === 'login' && authMethod === 'phone' && <p className="admin-success" role="status">{phoneMessage}</p>}
              <button type="submit" className="customer-auth-submit" disabled={submitting || phoneSubmitting || ((mode === 'login' || mode === 'register') && authMethod === 'phone' && !phoneOtpSent && resendCooldown > 0)}>{submitting || phoneSubmitting ? 'Please wait…' : (mode === 'login' || mode === 'register') && authMethod === 'phone' && !phoneOtpSent && resendCooldown > 0 ? `Wait ${resendCooldown}s` : mode === 'register' ? authMethod === 'email' ? 'Create account' : phoneOtpSent ? 'Verify OTP & create account' : 'Send OTP' : mode === 'forgot' ? 'Send reset link' : mode === 'recovery' ? 'Update password' : authMethod === 'phone' ? phoneOtpSent ? 'Verify OTP & sign in' : 'Send OTP' : 'Sign In'}<ArrowRight size={16} /></button>
            </form>
            {(mode === 'login' || mode === 'register') && authMethod === 'phone' && phoneOtpSent && <button type="button" className="customer-auth-link" onClick={resendPhoneOtp} disabled={phoneSubmitting || resendCooldown > 0}>{resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend SMS code'}</button>}
            {(mode === 'login' || mode === 'register') && authMethod === 'phone' && <p className="customer-verification-note">{mode === 'register' ? 'Verify your number to create your account, then complete your customer profile.' : 'We’ll send a one-time code by SMS. New phone accounts are created only after Supabase verifies the code.'}</p>}
            {mode === 'login' && authMethod === 'email' && <button className="customer-auth-link" type="button" onClick={() => { setMode('forgot'); setError(''); setMessage('') }}>Forgot password?</button>}
            {mode === 'forgot' && <button className="customer-auth-link" type="button" onClick={() => { setMode('login'); setError(''); setMessage('') }}>Back to sign in</button>}
            {(mode === 'login' || mode === 'register') && <div className="auth-social">
              <div className="auth-divider"><span>or continue with</span></div>
              <div className="auth-social-buttons">
                <button type="button" onClick={() => signInWithProvider('google')} disabled={submitting}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.05 5.05 0 0 1-2.2 3.31v2.77h3.57c2.08-1.92 3.27-4.75 3.27-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.15a11 11 0 0 0 0 9.88l3.69-2.84z"/><path fill="#EA4335" d="M12 4.37c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 1.09 14.97 0 12 0a11 11 0 0 0-9.85 7.06L5.84 9.9C6.71 7.3 9.14 5.37 12 5.37z"/></svg><span>Google</span></button>
                <button type="button" onClick={() => signInWithProvider('twitter')} disabled={submitting}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.9 2H22l-6.78 7.75L23.2 22h-6.25l-4.9-7.42L5.56 22H2.43l7.25-8.29L1.8 2h6.4l4.43 6.77L18.9 2Zm-1.1 18h1.73L7.28 3.9H5.42L17.8 20Z"/></svg><span>X / Twitter</span></button>
              </div>
            </div>}
          </>
        )}
        </section>
      </div>
      <footer className="auth-footer">© ZIPZY · Good stuff. Quick.</footer>
    </main>
  )
}

function AdminPanel({ products, onClose, onAddProduct, onUpdatePrice, onLogout, storageError }) {
  const [priceDrafts, setPriceDrafts] = useState(() => Object.fromEntries(products.map((product) => [product.id, String(product.price)])))
  const [newProduct, setNewProduct] = useState({ name: '', detail: '', category: categories[1].name, price: '', image: '', badge: '' })
  const [formError, setFormError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [logoutError, setLogoutError] = useState('')

  async function addProduct(event) {
    event.preventDefault()
    const price = Number(newProduct.price)
    if (!newProduct.name.trim() || !newProduct.detail.trim() || !newProduct.image.trim() || !Number.isFinite(price) || price <= 0) {
      setFormError('Enter a name, size, image, and a price greater than zero.')
      setSavedMessage('')
      return
    }
    try {
      await onAddProduct({
      name: newProduct.name.trim(),
      detail: newProduct.detail.trim(),
      category: newProduct.category,
      price,
      oldPrice: null,
      image: newProduct.image.trim().replace(/^https:\/\/images\.unsplash\.com\//, '').split('?')[0],
      badge: newProduct.badge.trim() || null,
      })
      setNewProduct({ name: '', detail: '', category: categories[1].name, price: '', image: '', badge: '' })
      setFormError('')
      setSavedMessage('Product added to the storefront.')
    } catch (saveError) {
      setFormError(saveError.message)
      setSavedMessage('')
    }
  }

  async function savePrice(product) {
    const price = Number(priceDrafts[product.id])
    if (!Number.isFinite(price) || price <= 0) {
      setFormError(`Enter a valid price greater than zero for ${product.name}.`)
      setSavedMessage('')
      return
    }
    try {
      await onUpdatePrice(product.id, price)
      setFormError('')
      setSavedMessage(`${product.name} price updated.`)
    } catch (saveError) {
      setFormError(saveError.message)
      setSavedMessage('')
    }
  }

  async function signOut() {
    setLogoutError('')
    try {
      await onLogout()
    } catch (error) {
      setLogoutError(error.message)
    }
  }

  return (
    <div className="admin-backdrop" onMouseDown={onClose}>
      <section className="admin-panel" role="dialog" aria-modal="true" aria-labelledby="admin-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="admin-header">
          <div className="admin-heading">
            <span className="admin-heading-icon"><LayoutDashboard size={20} /></span>
            <div><span className="section-kicker">ZIPZY STORE MANAGEMENT</span><h2 id="admin-title">Admin panel</h2></div>
          </div>
          <div className="admin-header-actions"><button className="admin-logout-button" type="button" onClick={signOut}><LogOut size={15} /><span>Sign out</span></button><button className="close-button" type="button" aria-label="Close admin panel" onClick={onClose}><X size={20} /></button></div>
        </header>
        <div className="admin-content">
          <div className="admin-intro"><div><h3>Products & pricing</h3><p>Changes are reflected in the shop and saved to the server.</p></div><span className="admin-product-count">{products.length} products</span></div>
          {logoutError && <p className="admin-alert" role="alert">{logoutError}</p>}
          {storageError && <p className="admin-alert" role="alert">{storageError}</p>}
          {formError && <p className="admin-alert" role="alert">{formError}</p>}
          {savedMessage && <p className="admin-success" role="status">{savedMessage}</p>}

          <section className="admin-section" aria-labelledby="add-product-title">
            <h3 id="add-product-title">Add a product</h3>
            <form className="product-form" onSubmit={addProduct}>
              <label>Product name<input value={newProduct.name} onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })} placeholder="e.g. Alphonso mangoes" required maxLength={70} /></label>
              <label>Pack size / details<input value={newProduct.detail} onChange={(event) => setNewProduct({ ...newProduct, detail: event.target.value })} placeholder="e.g. 500 g · ripe & sweet" required maxLength={70} /></label>
              <label>Category<select value={newProduct.category} onChange={(event) => setNewProduct({ ...newProduct, category: event.target.value })}>{categories.slice(1).map(({ name }) => <option key={name} value={name}>{name}</option>)}</select></label>
              <label>Price (₹)<input type="number" min="1" step="0.01" value={newProduct.price} onChange={(event) => setNewProduct({ ...newProduct, price: event.target.value })} placeholder="e.g. 99" required /></label>
              <label className="form-wide">Image URL or Unsplash photo ID<input value={newProduct.image} onChange={(event) => setNewProduct({ ...newProduct, image: event.target.value })} placeholder="photo-... or https://images.unsplash.com/..." required /></label>
              <label>Badge (optional)<input value={newProduct.badge} onChange={(event) => setNewProduct({ ...newProduct, badge: event.target.value })} placeholder="e.g. FRESH PICK" maxLength={24} /></label>
              <div className="form-submit"><button type="submit"><Plus size={16} /> Add product</button></div>
            </form>
          </section>

          <section className="admin-section catalog-section" aria-labelledby="catalog-title">
            <div className="catalog-title-row"><h3 id="catalog-title">Current catalog</h3><span>Update a rate and save</span></div>
            <div className="admin-product-list">
              {products.map((product) => (
                <article className="admin-product-row" key={product.id}>
                  <img src={imageUrl(product.image, 150)} alt="" />
                  <div className="admin-product-copy"><strong>{product.name}</strong><span>{product.category} · {product.detail}</span></div>
                  <form className="rate-form" onSubmit={(event) => { event.preventDefault(); savePrice(product) }}>
                    <label className="sr-only" htmlFor={`rate-${product.id}`}>Price for {product.name}</label>
                    <span>₹</span><input id={`rate-${product.id}`} type="number" min="1" step="0.01" value={priceDrafts[product.id] ?? String(product.price)} onChange={(event) => setPriceDrafts({ ...priceDrafts, [product.id]: event.target.value })} />
                    <button type="submit" aria-label={`Save price for ${product.name}`}><Save size={15} /><span>Save</span></button>
                  </form>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname)
  const isFoodPage = currentPath.replace(/\/+$/, '') === '/food'
  const [products, setProducts] = useState(defaultProducts)
  const [catalogError, setCatalogError] = useState('')
  const [customerSession, setCustomerSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [profileStatus, setProfileStatus] = useState('checking')
  const [recoveryFlow, setRecoveryFlow] = useState(false)
  const [adminAuthenticated, setAdminAuthenticated] = useState(false)
  const [adminExpiresAt, setAdminExpiresAt] = useState(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState({})
  const [cartOpen, setCartOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [location, setLocation] = useState('Indiranagar, Bengaluru')
  const [toast, setToast] = useState('')

  const navigate = useCallback((path, replace = false) => {
    if (window.location.pathname !== path) {
      if (replace) window.history.replaceState({}, '', path)
      else window.history.pushState({}, '', path)
    }
    setCurrentPath(path)
  }, [])
  const handleProfileStatus = useCallback((status) => setProfileStatus(status), [])

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!authReady || customerSession || currentPath === '/login') return
    navigate('/login', true)
  }, [authReady, customerSession, currentPath, navigate])

  useEffect(() => {
    if (customerSession && profileStatus === 'complete' && currentPath === '/login' && !recoveryFlow) {
      navigate('/', true)
    }
  }, [customerSession, profileStatus, currentPath, recoveryFlow, navigate])

  useEffect(() => {
    let active = true
    apiRequest('/api/catalog')
      .then(({ products: catalog }) => { if (active) setProducts(catalog) })
      .catch((error) => {
        console.error('Unable to load the Zipzy catalog:', error)
        if (active) setCatalogError('The live catalog could not be loaded. Showing the starter catalog.')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true)
      return undefined
    }
    let active = true
    supabase.auth.getSession()
      .then(async ({ data, error }) => {
        if (error) throw error
        const session = data.session
        if (session && !session.user.email_confirmed_at && !session.user.phone_confirmed_at) {
          await supabase.auth.signOut()
          if (active) setCustomerSession(null)
          return
        }
        if (active) {
          setCustomerSession(session)
          setProfileStatus(session ? 'checking' : 'incomplete')
          setAuthReady(true)
        }
      })
      .catch((error) => {
        console.error('Unable to restore the customer session:', error)
        if (active) {
          setCustomerSession(null)
          setProfileStatus('incomplete')
          setAuthReady(true)
        }
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const verifiedSession = session?.user.email_confirmed_at || session?.user.phone_confirmed_at ? session : null
      setCustomerSession(verifiedSession)
      if (['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) {
        setProfileStatus(verifiedSession ? 'checking' : 'incomplete')
      }
      setAuthReady(true)
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryFlow(true)
        navigate('/login')
      } else if (event === 'SIGNED_OUT') {
        navigate('/login')
      }
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [navigate])

  useEffect(() => {
    let active = true
    if (!customerSession) {
      setAdminAuthenticated(false)
      setAdminExpiresAt(null)
      return () => { active = false }
    }
    apiRequest('/api/admin/session', {
      headers: { Authorization: `Bearer ${customerSession.access_token}` },
    })
      .then(() => {
        if (active) {
          setAdminAuthenticated(true)
          setAdminExpiresAt((customerSession.expires_at || 0) * 1000)
          setAdminOpen(true)
        }
      })
      .catch((error) => {
        if (active) {
          setAdminAuthenticated(false)
          setAdminExpiresAt(null)
          if (error.status !== 401 && error.status !== 403) {
            console.error('Unable to check the Supabase admin role:', error)
          }
        }
      })
    return () => { active = false }
  }, [customerSession])

  useEffect(() => {
    if (!adminAuthenticated || !adminExpiresAt) return undefined
    const timer = window.setTimeout(() => {
      setAdminAuthenticated(false)
      setAdminExpiresAt(null)
      setAdminOpen(false)
    }, Math.max(0, adminExpiresAt - Date.now()))
    return () => window.clearTimeout(timer)
  }, [adminAuthenticated, adminExpiresAt])

  useEffect(() => {
    if (!cartOpen && !locationOpen && !adminOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setCartOpen(false)
        setLocationOpen(false)
        setAdminOpen(false)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [cartOpen, locationOpen, adminOpen])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = activeCategory === 'All' || product.category === activeCategory
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || `${product.name} ${product.detail} ${product.category}`.toLowerCase().includes(query)
    return matchesCategory && matchesSearch
  }), [activeCategory, search])

  const cartItems = products.filter((product) => cart[product.id]).map((product) => ({ product, quantity: cart[product.id] }))
  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0)
  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  function changeQuantity(id, amount) {
    setCart((current) => {
      const quantity = (current[id] || 0) + amount
      const next = { ...current }
      if (quantity <= 0) delete next[id]
      else next[id] = quantity
      return next
    })
  }

  function addProduct(product) {
    changeQuantity(product.id, 1)
    setToast(`${product.name} added to basket`)
  }

  async function saveCatalog(nextProducts) {
    try {
      if (!customerSession?.access_token) throw new Error('Sign in with your verified admin account to update the catalog.')
      const { products: savedProducts } = await apiRequest('/api/catalog', {
        method: 'PUT',
        body: JSON.stringify({ products: nextProducts }),
        headers: { Authorization: `Bearer ${customerSession.access_token}` },
      })
      setProducts(savedProducts)
    } catch (error) {
      if (error.status === 401) {
        setAdminAuthenticated(false)
        setAdminExpiresAt(null)
        setAdminOpen(false)
        navigate('/login')
      }
      throw error
    }
  }

  async function addCatalogProduct(product) {
    const baseId = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product'
    let id = baseId
    let suffix = 2
    while (products.some((existing) => existing.id === id)) {
      id = `${baseId}-${suffix}`
      suffix += 1
    }
    await saveCatalog([...products, { ...product, id }])
  }

  async function updateProductPrice(id, price) {
    await saveCatalog(products.map((product) => (
      product.id === id ? { ...product, price, oldPrice: null } : product
    )))
  }

  async function loginAdmin(email, password) {
    if (!supabase) throw new Error('Supabase is not configured. Replace the placeholder Project URL and public key in .env, then restart the app.')
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
    if (!data.user?.email_confirmed_at) {
      await supabase.auth.signOut()
      throw new Error('Verify your email address before signing in.')
    }
    const session = data.session
    try {
      await apiRequest('/api/admin/session', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
    } catch (roleError) {
      if (roleError.status === 403) throw new Error('This verified account does not have the admin role.')
      throw roleError
    }
    setCustomerSession(session)
    setAdminAuthenticated(true)
    setAdminExpiresAt((session.expires_at || 0) * 1000)
    setAdminOpen(true)
  }

  async function logoutAdmin() {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setCustomerSession(null)
    setAdminAuthenticated(false)
    setAdminExpiresAt(null)
    setAdminOpen(false)
  }

  function selectCategory(name) {
    setActiveCategory(name)
    document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!authReady) {
    return <main className="auth-page auth-loading"><a href="/" className="brand auth-brand"><span className="brand-mark"><ShoppingBag size={20} /></span><span>zipzy<span className="brand-period">.</span></span></a><p>Checking your secure ZIPZY session…</p></main>
  }

  if (!customerSession || recoveryFlow || profileStatus !== 'complete' || currentPath === '/login' || currentPath === '/account') {
    return <CustomerAccount
      key={customerSession?.user?.id || 'guest'}
      session={customerSession}
      onSessionChange={setCustomerSession}
      onRecoveryComplete={() => setRecoveryFlow(false)}
      onProfileStatus={handleProfileStatus}
      initialMode={recoveryFlow ? 'recovery' : 'login'}
      navigate={navigate}
    />
  }

  return (
    <div className="app-shell">
      <div className="announcement"><Sparkles size={14} /><span>YOUR NEIGHBOURHOOD STORE, NOW IN YOUR POCKET</span><b>10-MIN DELIVERY</b></div>
      <header className="site-header">
        <a href="/" className="brand" aria-label="Zipzy home"><span className="brand-mark"><ShoppingBag size={20} strokeWidth={2.6} /></span><span>zipzy<span className="brand-period">.</span></span></a>
        <button className="location-button" type="button" onClick={() => setLocationOpen(true)} aria-label={`Change delivery location, currently ${location}`}>
          <MapPin size={19} /><span><small>DELIVERING TO</small><strong>{location}</strong></span><ChevronDown size={16} />
        </button>
        <label className="search-box"><Search size={19} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search for milk, snacks, fruits..." aria-label="Search groceries" /><kbd>⌘ K</kbd></label>
        {adminAuthenticated && <button className="admin-open-button" type="button" aria-label="Open admin panel" onClick={() => setAdminOpen(true)}><LayoutDashboard size={16} /><span>Admin</span></button>}
        <button className="account-open-button" type="button" onClick={() => navigate('/account')} aria-label={customerSession ? `Customer account for ${customerSession.user.email}` : 'Customer account'}><UserRound size={16} /><span>Account</span></button>
        <button className="basket-button" type="button" onClick={() => setCartOpen(true)} aria-label={`Open basket, ${itemCount} items`}><ShoppingBag size={18} /><span>Basket</span>{itemCount > 0 && <b>{itemCount}</b>}</button>
      </header>

      <nav className="category-nav" aria-label="Grocery categories"><div className="nav-inner">
        <a className={isFoodPage ? 'nav-category active' : 'nav-category'} href="/food" aria-current={isFoodPage ? 'page' : undefined}>Food</a>
        {categories.map(({ name, icon: Icon }) => <button key={name} type="button" className={activeCategory === name ? 'nav-category active' : 'nav-category'} onClick={() => selectCategory(name)}><Icon size={16} />{name}</button>)}
        <span className="open-status"><i /> Stores nearby are open</span>
      </div></nav>

      <main id="top">
        {catalogError && <div className="catalog-error wrap" role="status">{catalogError}</div>}
        <section className="hero wrap">
          <div className="hero-content">
            <span className="hero-label"><span className="hero-label-dot" />{isFoodPage ? 'GOOD FOOD, RIGHT AROUND THE CORNER' : 'THE GOOD STUFF. RIGHT NOW.'}</span>
            <h1>{isFoodPage ? <>Good food.<br /><span>Good mood.</span></> : <>Hungry? <span>Happy.</span><br />Sorted in 10.</>}</h1>
            <p>{isFoodPage ? 'Browse fresh groceries, bakery favourites, snacks and drinks from your neighbourhood store.' : 'Fresh groceries, daily needs and little cravings. At your door before you can say “add to cart”.'}</p>
            <button className="hero-cta" type="button" onClick={() => document.getElementById(isFoodPage ? 'restaurants' : 'shop')?.scrollIntoView({ behavior: 'smooth' })}>{isFoodPage ? 'Explore local restaurants' : "Shop what's fresh"} <ArrowRight size={17} /></button>
            <div className="hero-delivery"><Clock3 size={15} /><strong>10–15 min</strong><span>delivery in your area</span></div>
          </div>
          <div className="hero-image">
            <img src={imageUrl('photo-1542838132-92c53300491e', 1200)} alt="A colourful selection of fresh vegetables and groceries" />
            <div className="hero-image-shade" />
            <div className="hero-sticker"><span>FRESH</span><strong>O'CLOCK</strong><i>✦</i></div>
            <div className="hero-caption"><Leaf size={16} /><span>Picked fresh. Packed fast.</span><ArrowUpRight size={17} /></div>
          </div>
          <div className="hero-side-note"><span>ZIPZY</span><i /> FAST FINDS, FRESH PICKS</div>
        </section>

        {isFoodPage && <section className="restaurants-section wrap" id="restaurants" aria-labelledby="restaurants-title">
          <div className="section-title">
            <div><span className="section-kicker">A TASTE OF YOUR NEIGHBOURHOOD</span><h2 id="restaurants-title">Local restaurants</h2></div>
            <span className="quick-note"><MapPin size={14} /> Bengaluru neighbourhoods</span>
          </div>
          <p className="restaurant-demo-note">Sample listings for preview · replace with your restaurant partners</p>
          <div className="restaurant-grid">
            {sampleRestaurants.map((restaurant) => (
              <article className="restaurant-card" key={restaurant.name}>
                <img src={imageUrl(restaurant.image, 720)} alt={restaurant.imageAlt} loading="lazy" />
                <div className="restaurant-copy">
                  <span className="restaurant-area"><MapPin size={13} />{restaurant.area}</span>
                  <h3>{restaurant.name}</h3>
                  <p>{restaurant.cuisine}</p>
                  <span className="restaurant-delivery"><Clock3 size={13} />{restaurant.deliveryTime} <span>·</span> Sample listing</span>
                </div>
              </article>
            ))}
          </div>
        </section>}

        <section className="categories-section wrap" aria-label="Shop by category">
          <div className="section-title"><div><span className="section-kicker">WHAT ARE YOU IN THE MOOD FOR?</span><h2>Shop by category</h2></div><span className="quick-note"><Clock3 size={14} /> All at your door in minutes</span></div>
          <div className="category-grid">{categories.slice(1).map(({ name, icon: Icon, color }) => <button type="button" key={name} className={`category-card ${color}`} onClick={() => selectCategory(name)}><span className="category-icon"><Icon size={24} strokeWidth={1.8} /></span><strong>{name}</strong><span className="category-shop">Shop now <ArrowRight size={13} /></span></button>)}</div>
        </section>

        <section className="shop-section wrap" id="shop">
          <div className="shop-heading"><div><span className="section-kicker">{search ? 'FIND YOUR FAVOURITES' : activeCategory === 'All' ? 'GOOD THINGS, ON THE DOUBLE' : 'YOUR AISLE IS READY'}</span><h2>{search ? 'Search results' : activeCategory === 'All' ? 'Popular near you' : activeCategory}</h2></div><span className="stock-note"><i /> In stock near you</span></div>
          <div className="filter-row"><div className="filter-pills" aria-label="Filter groceries">{categories.map(({ name }) => <button type="button" key={name} className={activeCategory === name ? 'filter-pill selected' : 'filter-pill'} onClick={() => setActiveCategory(name)}>{name}</button>)}</div><span className="results-count">{visibleProducts.length} items</span></div>
          {visibleProducts.length ? <div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} quantity={cart[product.id] || 0} onAdd={addProduct} onChange={changeQuantity} />)}</div> : <div className="no-results"><Search size={28} /><h3>No goodies found</h3><p>Try a different search or browse all our fresh picks.</p><button type="button" onClick={() => { setSearch(''); setActiveCategory('All') }}>Show everything <ArrowRight size={15} /></button></div>}
        </section>

        <section className="promise-band"><div className="promise-inner wrap"><div><span className="promise-icon"><Clock3 size={19} /></span><p><strong>Fast means fast</strong><span>Fresh picks in 10–15 minutes</span></p></div><i /><div><span className="promise-icon"><Leaf size={19} /></span><p><strong>Fresh, always</strong><span>Handpicked for your basket</span></p></div><i /><div><span className="promise-icon"><PackageCheck size={19} /></span><p><strong>At your doorstep</strong><span>Free delivery over ₹499</span></p></div></div></section>
      </main>
      <footer className="site-footer wrap"><a href="/" className="footer-brand">zipzy<span>.</span></a><span>Good stuff. Quick.</span><span>Made for your neighbourhood · Bengaluru</span></footer>

      {itemCount > 0 && <button className="mobile-cart-bar" type="button" onClick={() => setCartOpen(true)}><span className="mobile-cart-count">{itemCount}</span><span>View basket</span><strong>{money(subtotal)}</strong><ArrowRight size={17} /></button>}
      {cartOpen && <BasketDrawer items={cartItems} subtotal={subtotal} onClose={() => setCartOpen(false)} onChange={changeQuantity} />}
      {locationOpen && <LocationDialog location={location} onChoose={setLocation} onClose={() => setLocationOpen(false)} />}
      {adminOpen && adminAuthenticated && <AdminPanel products={products} onClose={() => setAdminOpen(false)} onAddProduct={addCatalogProduct} onUpdatePrice={updateProductPrice} onLogout={logoutAdmin} storageError={catalogError} />}
      {toast && <div className="toast" role="status"><ShoppingBag size={16} />{toast}</div>}
    </div>
  )
}

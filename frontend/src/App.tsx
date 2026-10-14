import { useCallback, useEffect, useMemo, useState } from 'react'
import { authConfigured, authToken, confirmUser, currentAppUser, loginUser, logoutUser, registerUser, type AppUser } from './auth'
import {
  ArrowDownUp, ArrowRight, BookOpen, Check, ChevronDown, CircleHelp, Clock3, Heart,
  Leaf, MapPin, Menu, PackagePlus, Recycle, Search, ShieldCheck, Sparkles, X,
  Shirt, Laptop, Armchair, House, HandHeart, RefreshCw, SlidersHorizontal,
} from 'lucide-react'

type Category = 'Books & Paper' | 'Clothing' | 'Electronics' | 'Furniture' | 'Household'
type Action = 'Donate' | 'Reuse' | 'Repair' | 'Recycle'
type Condition = 'New' | 'Like new' | 'Good' | 'Needs repair'
type Listing = {
  id: number; title: string; category: Category; action: Action; condition: Condition
  location: string; description: string; status: string; created_at: string
}
type NewListing = Omit<Listing, 'id' | 'status' | 'created_at'> & { owner_email?: string }
type ClaimForm = { requester_name: string; requester_email: string; message: string }
type MyClaim = {
  id: number
  resource_id: number
  resource_title: string
  resource_category: Category
  resource_location?: string
  requester_name: string
  requester_email?: string
  message: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '')
const categories: { name: Category; icon: typeof BookOpen; note: string }[] = [
  { name: 'Books & Paper', icon: BookOpen, note: 'Books, notes, stationery' },
  { name: 'Clothing', icon: Shirt, note: 'Clothes, shoes, bags' },
  { name: 'Electronics', icon: Laptop, note: 'Devices and accessories' },
  { name: 'Furniture', icon: Armchair, note: 'Furniture and storage' },
  { name: 'Household', icon: House, note: 'Everyday home essentials' },
]
const actionOptions: Action[] = ['Donate', 'Reuse', 'Repair', 'Recycle']
const conditions: Condition[] = ['New', 'Like new', 'Good', 'Needs repair']
const blankListing: NewListing = { title: '', category: 'Books & Paper', action: 'Donate', condition: 'Good', location: '', description: '' }
const blankClaim: ClaimForm = { requester_name: '', requester_email: '', message: '' }

function dateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently added'
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date)
}
function actionClass(action: Action) { return `tag tag-${action.toLowerCase()}` }
function categoryEmoji(category: Category) {
  return ({ 'Books & Paper': '📚', Clothing: '👕', Electronics: '🔌', Furniture: '🪑', Household: '🏠' })[category]
}
async function apiFetch(path: string, init: RequestInit = {}) {
  const token = await authToken()
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    signal: init.signal ?? AbortSignal.timeout(15000),
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`)
  return payload
}

export default function App() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | 'All'>('All')
  const [action, setAction] = useState<Action | 'All'>('All')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('resource-favorites') || '[]') as number[] } catch { return [] }
  })
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<Listing | null>(null)
  const [showClaim, setShowClaim] = useState(false)
  const [notice, setNotice] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [claimBusy, setClaimBusy] = useState(false)
  const [createError, setCreateError] = useState('')
  const [claimError, setClaimError] = useState('')
  const [claimForm, setClaimForm] = useState<ClaimForm>(blankClaim)
  const [user, setUser] = useState<AppUser | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'confirm'>('signin')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [showMyClaims, setShowMyClaims] = useState(false)
  const [claimsTab, setClaimsTab] = useState<'received' | 'sent'>('received')
  const [receivedClaims, setReceivedClaims] = useState<MyClaim[]>([])
  const [sentClaims, setSentClaims] = useState<MyClaim[]>([])
  const [loadingClaims, setLoadingClaims] = useState(false)
  const [updatingClaimId, setUpdatingClaimId] = useState<number | null>(null)

  const loadListings = useCallback(async () => {
    setLoading(true); setLoadError('')
    try {
      const payload = await apiFetch('/resources')
      setListings(Array.isArray(payload.resources) ? payload.resources : [])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load listings.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadListings() }, [loadListings])
  useEffect(() => { void currentAppUser().then(setUser) }, [])
  useEffect(() => { localStorage.setItem('resource-favorites', JSON.stringify(favorites)) }, [favorites])

  const loadMyClaims = useCallback(async () => {
    if (!user) return
    setLoadingClaims(true)
    try {
      const payload = await apiFetch('/claims/my')
      setReceivedClaims(Array.isArray(payload.received) ? payload.received : [])
      setSentClaims(Array.isArray(payload.sent) ? payload.sent : [])
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load requests.')
    } finally { setLoadingClaims(false) }
  }, [user])

  useEffect(() => {
    if (user) void loadMyClaims()
  }, [user, loadMyClaims])

  async function updateClaimStatus(claimId: number, newStatus: 'approved' | 'rejected') {
    setUpdatingClaimId(claimId)
    try {
      const res = await apiFetch(`/claims/${claimId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      setReceivedClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: newStatus } : c))
      setNotice(res.message || `Request ${newStatus}. Status email sent!`)
      void loadListings()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to update request.')
    } finally {
      setUpdatingClaimId(null)
    }
  }

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 3800)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return listings.filter(item => {
      const matchesQuery = !term || [item.title, item.description, item.location, item.category, item.action].some(v => v.toLowerCase().includes(term))
      return matchesQuery && (category === 'All' || item.category === category) && (action === 'All' || item.action === action) && (!favoritesOnly || favorites.includes(item.id))
    }).sort((a, b) => sort === 'newest' ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime() : new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [listings, query, category, action, sort, favoritesOnly, favorites])

  const stats = useMemo(() => ({ total: listings.length, available: listings.filter(x => x.status === 'available').length, categories: new Set(listings.map(x => x.category)).size }), [listings])
  const toggleFavorite = (id: number) => setFavorites(prev => prev.includes(id) ? prev.filter(value => value !== id) : [...prev, id])
  const resetFilters = () => { setQuery(''); setCategory('All'); setAction('All'); setFavoritesOnly(false) }

  function requestCreateListing() {
    if (!user) { setAuthOpen(true); setAuthMode('signin'); setAuthError('Sign in to publish a listing.'); return }
    setShowCreate(true)
  }

  function requestClaim(): boolean {
    if (!user) { setAuthOpen(true); setAuthMode('signin'); setAuthError('Sign in to request an item.'); return false }
    setShowClaim(true)
    return true
  }

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthBusy(true); setAuthError('')
    try {
      if (authMode === 'signup') {
        const result = await registerUser(authEmail, authPassword, authName)
        if (result.nextStep.signUpStep === 'CONFIRM_SIGN_UP') { setAuthMode('confirm'); setNotice('Check your email for the verification code.') }
        else { setUser(await currentAppUser()); setAuthOpen(false); setNotice('Account created. You can now pass value forward.') }
      } else if (authMode === 'confirm') {
        await confirmUser(authEmail, authCode)
        setAuthMode('signin'); setAuthPassword(''); setAuthCode(''); setNotice('Email verified. Sign in to continue.')
      } else {
        const result = await loginUser(authEmail, authPassword)
        if (result.isSignedIn) { setUser(await currentAppUser()); setAuthOpen(false); setAuthPassword(''); setNotice('You are signed in.') }
        else if (result.nextStep.signInStep === 'CONFIRM_SIGN_UP') { setAuthMode('confirm'); setAuthError('Verify your email before signing in.') }
        else setAuthError(`Additional sign-in step required: ${result.nextStep.signInStep}. Check Cognito configuration.`)
      }
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Authentication failed. Please try again.') }
    finally { setAuthBusy(false) }
  }

  async function handleSignOut() {
    try { await logoutUser(); setUser(null); setNotice('You have signed out.') }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not sign out.') }
  }

  async function createListing(data: NewListing) {
    setCreateBusy(true); setCreateError('')
    try {
      const payload = await apiFetch('/resources', {
        method: 'POST',
        body: JSON.stringify({ ...data, owner_email: user?.email || undefined }),
      })
      setListings(prev => [payload.resource, ...prev.filter(x => x.id !== payload.resource.id)])
      setShowCreate(false); setNotice('Your listing is live. Thanks for passing value forward!')
      setCategory('All'); setAction('All'); setFavoritesOnly(false); setQuery('')
    } catch (error) { setCreateError(error instanceof Error ? error.message : 'Could not create listing.') }
    finally { setCreateBusy(false) }
  }

  async function submitClaim(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    setClaimBusy(true); setClaimError('')
    try {
      await apiFetch(`/claims/${selected.id}`, {
        method: 'POST',
        body: JSON.stringify({
          message: claimForm.message.trim(),
          requester_name: user?.username || undefined,
          requester_email: user?.email || undefined,
        }),
      })
      setShowClaim(false); setSelected(null); setClaimForm(blankClaim)
      setNotice('Your request has been saved successfully!')
      void loadMyClaims()
    } catch (error) { setClaimError(error instanceof Error ? error.message : 'Could not send request.') }
    finally { setClaimBusy(false) }
  }

  function openDetails(item: Listing) { setSelected(item); setShowClaim(false); setClaimError(''); setClaimForm(blankClaim) }
  function goToBrowse() { setMobileMenu(false); document.getElementById('browse')?.scrollIntoView({ behavior: 'smooth' }) }

  return <div className="app-shell">
    <div className="announcement"><Leaf size={14} /> Good things deserve a second life <span className="announcement-dot">•</span> Built for sharing, not wasting</div>
    <header className="site-header">
      <a className="brand" href="#top" aria-label="reSource home"><span className="brand-mark"><Recycle size={24} strokeWidth={2.4} /></span><span>re<span className="brand-green">Source</span><small>PASS VALUE FORWARD</small></span></a>
      <button className="mobile-menu-button icon-button" onClick={() => setMobileMenu(v => !v)} aria-label="Toggle menu">{mobileMenu ? <X /> : <Menu />}</button>
      <nav className={`nav-links ${mobileMenu ? 'nav-open' : ''}`}>
        <button onClick={goToBrowse}>Browse items</button><a href="#how-it-works" onClick={() => setMobileMenu(false)}>How it works</a><a href="#impact" onClick={() => setMobileMenu(false)}>Our impact</a>
        {user && (
          <button onClick={() => { setShowMyClaims(true); void loadMyClaims(); setMobileMenu(false) }}>
            Requests &amp; Activity {receivedClaims.filter(c => c.status === 'pending').length > 0 ? `(${receivedClaims.filter(c => c.status === 'pending').length})` : ''}
          </button>
        )}
        <div className="auth-nav">{user ? <><span className="auth-username" title={user.username}>{user.username}</span><button className="button button-secondary auth-button" onClick={handleSignOut}>Sign out</button></> : <button className="button button-secondary auth-button" onClick={() => { setAuthOpen(true); setAuthMode('signin'); setAuthError(''); setMobileMenu(false) }}>Sign in</button>}</div><button className="button button-primary nav-cta" onClick={() => { requestCreateListing(); setMobileMenu(false) }}><PackagePlus size={17} /> Share an item</button>
      </nav>
    </header>

    <main id="top">
      <section className="hero section-wrap">
        <div className="hero-copy"><div className="eyebrow"><Sparkles size={15} /> SMALL ACTION. REAL IMPACT.</div><h1>One person’s <span>unused</span> is another person’s <em>something useful.</em></h1><p className="hero-description">Give good things another chapter. Share what you no longer need, find something useful, or help an item get repaired instead of wasted.</p><div className="hero-actions"><button className="button button-primary button-large" onClick={goToBrowse}>Find something useful <ArrowRight size={18} /></button><button className="button button-secondary button-large" onClick={requestCreateListing}><HandHeart size={18} /> Pass something on</button></div><div className="hero-proof"><span className="proof-icon"><ShieldCheck size={17} /></span><span><strong>Community-first sharing</strong><small>No selling pressure. Just useful things finding new homes.</small></span></div></div>
        <div className="hero-art" aria-label="Illustration of reusable items"><div className="art-sun" /><div className="art-leaf leaf-one">✳</div><div className="art-leaf leaf-two">✦</div><div className="art-circle"><div className="art-card art-book"><BookOpen size={35} /><span>Read again</span></div><div className="art-card art-shirt"><Shirt size={38} /><span>Wear again</span></div><div className="art-card art-plant"><Leaf size={40} /><span>Grow again</span></div><div className="art-card art-box"><PackagePlus size={34} /><span>Use again</span></div><div className="art-center"><Recycle size={56} /><strong>Pass it<br />forward</strong></div></div><div className="art-note"><span className="note-dot" /><span><strong>Good things, shared.</strong><small>Better for people and planet.</small></span></div></div>
      </section>

      <section className="impact-strip section-wrap" id="impact"><div className="impact-intro"><span className="impact-icon"><Leaf size={21} /></span><span><strong>Reuse is a simple climate action.</strong><small>Keep useful things in circulation for longer.</small></span></div><div className="impact-stat"><strong>{stats.total}</strong><span>items shared</span></div><div className="impact-stat"><strong>{stats.available}</strong><span>available now</span></div><div className="impact-stat"><strong>{stats.categories}</strong><span>item categories</span></div></section>

      <section className="section-wrap category-section"><div className="section-heading"><div><span className="eyebrow">FIND YOUR NEXT USEFUL THING</span><h2>Browse by category</h2></div><button className="text-button" onClick={() => { setCategory('All'); goToBrowse() }}>View all items <ArrowRight size={16} /></button></div><div className="category-grid">{categories.map(({ name, icon: Icon, note }) => <button className={`category-card ${category === name ? 'category-active' : ''}`} key={name} onClick={() => { setCategory(category === name ? 'All' : name); document.getElementById('browse')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}><span className="category-icon"><Icon size={24} /></span><strong>{name}</strong><small>{note}</small><ArrowRight className="category-arrow" size={17} /></button>)}</div></section>

      <section className="browse-section" id="browse"><div className="section-wrap"><div className="section-heading browse-heading"><div><span className="eyebrow">THE COMMUNITY EXCHANGE</span><h2>Useful things, ready for a new home.</h2><p>Explore available items shared by people around you.</p></div><button className="button button-primary" onClick={requestCreateListing}><PackagePlus size={17} /> List an item</button></div>
        <div className="filters"><label className="search-box"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search items, categories, location..." aria-label="Search listings" />{query && <button className="clear-search" onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}</label><label className="filter-select"><SlidersHorizontal size={16} /><select value={category} onChange={e => setCategory(e.target.value as Category | 'All')} aria-label="Filter category"><option value="All">All categories</option>{categories.map(c => <option key={c.name}>{c.name}</option>)}</select><ChevronDown size={15} /></label><label className="filter-select"><select value={action} onChange={e => setAction(e.target.value as Action | 'All')} aria-label="Filter action"><option value="All">All actions</option>{actionOptions.map(a => <option key={a}>{a}</option>)}</select><ChevronDown size={15} /></label><label className="filter-select sort-select"><ArrowDownUp size={15} /><select value={sort} onChange={e => setSort(e.target.value as 'newest' | 'oldest')} aria-label="Sort listings"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select><ChevronDown size={15} /></label><button className={`favorites-filter ${favoritesOnly ? 'favorites-active' : ''}`} onClick={() => setFavoritesOnly(v => !v)}><Heart size={16} fill={favoritesOnly ? 'currentColor' : 'none'} /> Saved ({favorites.length})</button></div>
        <div className="results-meta"><span>{loading ? 'Loading items…' : `${filtered.length} ${filtered.length === 1 ? 'item' : 'items'} found`}</span>{(query || category !== 'All' || action !== 'All' || favoritesOnly) && <button onClick={resetFilters}>Clear filters</button>}</div>
        {loadError ? <div className="state-panel error-panel"><CircleHelp size={30} /><h3>We couldn’t load the listings.</h3><p>{loadError}. Make sure the API and database are running.</p><button className="button button-primary" onClick={() => void loadListings()}><RefreshCw size={16} /> Try again</button></div> : loading ? <div className="listing-grid">{Array.from({ length: 6 }).map((_, i) => <div className="listing-skeleton" key={i}><div /><span /><span /><span /></div>)}</div> : filtered.length === 0 ? <div className="state-panel"><span className="empty-illustration"><Search size={28} /></span><h3>{favoritesOnly ? 'No saved items yet' : 'Nothing here just yet'}</h3><p>{favoritesOnly ? 'Tap the heart on any listing to save it here.' : 'Try another search or be the first to share something useful.'}</p><div className="state-actions"><button className="button button-secondary" onClick={resetFilters}>Clear filters</button><button className="button button-primary" onClick={requestCreateListing}>Share an item <ArrowRight size={16} /></button></div></div> : <div className="listing-grid">{filtered.map(item => <article className="listing-card" key={item.id}><button className={`favorite-button ${favorites.includes(item.id) ? 'is-favorite' : ''}`} onClick={() => toggleFavorite(item.id)} aria-label={favorites.includes(item.id) ? 'Remove from saved items' : 'Save item'}><Heart size={18} fill={favorites.includes(item.id) ? 'currentColor' : 'none'} /></button><button className={`listing-art art-${item.category.toLowerCase().replace(/[^a-z]+/g, '-')}`} onClick={() => openDetails(item)} aria-label={`View ${item.title}`}><span className="listing-emoji">{categoryEmoji(item.category)}</span><span className="listing-category">{item.category}</span></button><div className="listing-content"><div className="listing-tags"><span className={actionClass(item.action)}>{item.action}</span><span className="condition-tag">{item.condition}</span></div><button className="listing-title" onClick={() => openDetails(item)}>{item.title}</button><p className="listing-description">{item.description || 'A useful item looking for its next home.'}</p><div className="listing-footer"><span className="listing-location"><MapPin size={14} />{item.location}</span><span className="listing-date"><Clock3 size={13} />{dateLabel(item.created_at)}</span></div><button className="view-details" onClick={() => openDetails(item)}>View details <ArrowRight size={15} /></button></div></article>)}</div>}
        <div className="browse-bottom-note"><Recycle size={17} /><span>Every item reused is one less item wasted. Thanks for being part of the loop.</span></div>
      </div></section>

      <section className="how-section section-wrap" id="how-it-works"><div className="how-heading"><span className="eyebrow">THREE SIMPLE STEPS</span><h2>Good things keep going.</h2><p>Make passing things on easier than throwing them away.</p></div><div className="steps-grid"><div className="step-card"><span className="step-number">01</span><div className="step-icon step-green"><PackagePlus size={25} /></div><h3>Share what you have</h3><p>List an item you no longer need. Add a few details so someone can decide if it works for them.</p></div><div className="step-card"><span className="step-number">02</span><div className="step-icon step-peach"><Search size={25} /></div><h3>Find what you need</h3><p>Search by category, action, or location. Save items you want to come back to.</p></div><div className="step-card"><span className="step-number">03</span><div className="step-icon step-blue"><HandHeart size={25} /></div><h3>Connect and pass it on</h3><p>Send a request for an available item and coordinate the handover directly.</p></div></div></section>

      <section className="closing-cta section-wrap"><div className="closing-leaf"><Leaf size={31} /></div><div><span className="eyebrow">YOUR NEXT SMALL ACTION</span><h2>Have something useful sitting around?</h2><p>It might be exactly what someone else needs.</p></div><button className="button button-light" onClick={requestCreateListing}>Share it on reSource <ArrowRight size={17} /></button></section>
    </main>
    <footer className="site-footer"><a className="brand footer-brand" href="#top"><span className="brand-mark"><Recycle size={21} /></span><span>re<span className="brand-green">Source</span><small>PASS VALUE FORWARD</small></span></a><p>Useful things deserve another life.</p><span className="footer-copyright">© {new Date().getFullYear()} reSource · Built for a more circular community</span></footer>

    {notice && <div className="toast" role="status"><span className="toast-check"><Check size={16} /></span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={16} /></button></div>}

    {showCreate && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !createBusy) setShowCreate(false) }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-title"><div className="modal-header"><div><span className="eyebrow">PASS VALUE FORWARD</span><h2 id="create-title">Share an item</h2><p>Give something useful a new home.</p></div><button className="icon-button modal-close" onClick={() => setShowCreate(false)} disabled={createBusy} aria-label="Close"><X /></button></div><form className="modal-form" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void createListing({ title: String(form.get('title')).trim(), category: String(form.get('category')) as Category, action: String(form.get('action')) as Action, condition: String(form.get('condition')) as Condition, location: String(form.get('location')).trim(), description: String(form.get('description')).trim() }) }}><label>Item title<input name="title" required maxLength={120} placeholder="e.g. Engineering mathematics textbook" /></label><div className="form-row"><label>Category<select name="category" defaultValue={blankListing.category}>{categories.map(c => <option key={c.name}>{c.name}</option>)}</select></label><label>How can it be used?<select name="action" defaultValue={blankListing.action}>{actionOptions.map(a => <option key={a}>{a}</option>)}</select></label></div><div className="form-row"><label>Condition<select name="condition" defaultValue={blankListing.condition}>{conditions.map(c => <option key={c}>{c}</option>)}</select></label><label>Location<input name="location" required maxLength={120} placeholder="e.g. Ahmedabad, Gujarat" /></label></div><label>Description <span className="optional-label">(optional)</span><textarea name="description" rows={3} maxLength={1000} placeholder="Share condition, pickup preferences, or useful details…" /></label>{createError && <p className="form-error" role="alert">{createError}</p>}<div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setShowCreate(false)} disabled={createBusy}>Cancel</button><button type="submit" className="button button-primary" disabled={createBusy}>{createBusy ? <><span className="spinner" /> Publishing…</> : <><PackagePlus size={17} /> Publish listing</>}</button></div><p className="form-footnote"><ShieldCheck size={14} /> Please don’t include private or sensitive information.</p></form></section></div>}

    {selected && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !claimBusy) setSelected(null) }}><section className="modal details-modal" role="dialog" aria-modal="true" aria-labelledby="details-title"><div className="details-art"><button className="icon-button details-close" onClick={() => setSelected(null)} aria-label="Close details"><X /></button><span>{categoryEmoji(selected.category)}</span><small>{selected.category}</small></div><div className="details-body"><div className="listing-tags"><span className={actionClass(selected.action)}>{selected.action}</span><span className="condition-tag">{selected.condition}</span></div><h2 id="details-title">{selected.title}</h2><p className="details-description">{selected.description || 'A useful item looking for its next home.'}</p><div className="details-meta"><span><MapPin size={16} />{selected.location}</span><span><Clock3 size={15} />Added {dateLabel(selected.created_at)}</span></div>{!showClaim ? <div className="details-actions"><button className={`button button-secondary ${favorites.includes(selected.id) ? 'saved-detail-button' : ''}`} onClick={() => toggleFavorite(selected.id)}><Heart size={17} fill={favorites.includes(selected.id) ? 'currentColor' : 'none'} />{favorites.includes(selected.id) ? 'Saved' : 'Save item'}</button><button className="button button-primary" disabled={selected.status !== 'available'} onClick={() => { if (requestClaim()) setClaimError('') }}>Request this item <ArrowRight size={17} /></button></div> : <form className="claim-form" onSubmit={submitClaim}><h3>Request this item</h3><p>Requesting as <strong>{user?.username}</strong>. The owner can identify your account from your request.</p><label>Message <span className="optional-label">(optional)</span><textarea rows={2} maxLength={500} value={claimForm.message} onChange={e => setClaimForm(p => ({ ...p, message: e.target.value }))} placeholder="When would pickup work for you?" /></label>{claimError && <p className="form-error" role="alert">{claimError}</p>}<div className="form-actions"><button type="button" className="button button-secondary" disabled={claimBusy} onClick={() => setShowClaim(false)}>Back</button><button type="submit" className="button button-primary" disabled={claimBusy}>{claimBusy ? <><span className="spinner" /> Sending…</> : 'Send request'}</button></div><p className="form-footnote"><ShieldCheck size={14} /> Your details are used to process this request.</p></form>}</div></section></div>}
    {authOpen && <div className="modal-backdrop auth-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !authBusy) setAuthOpen(false) }}><section className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><div className="modal-header"><div><span className="eyebrow">YOUR COMMUNITY ACCOUNT</span><h2 id="auth-title">{authMode === 'signup' ? 'Create your account' : authMode === 'confirm' ? 'Verify your email' : 'Welcome back'}</h2><p>{authMode === 'signup' ? 'Join the community and pass value forward.' : authMode === 'confirm' ? 'Enter the code sent to your email address.' : 'Sign in to share items and request what you need.'}</p></div><button className="icon-button modal-close" onClick={() => setAuthOpen(false)} disabled={authBusy} aria-label="Close authentication"><X /></button></div>{!authConfigured ? <div className="auth-config-warning"><ShieldCheck size={24} /><strong>Amazon Cognito needs configuration</strong><p>Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID in frontend/.env, and matching COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID in the backend .env. Restart both services afterward.</p></div> : <form className="modal-form" onSubmit={submitAuth}>{authMode === 'signup' && <label>Full name<input required maxLength={100} autoComplete="name" value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Your name" /></label>}{authMode !== 'confirm' && <label>Email address<input required type="email" autoComplete="email" maxLength={254} value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@example.com" /></label>}{authMode === 'confirm' ? <label>Verification code<input required inputMode="numeric" autoComplete="one-time-code" value={authCode} onChange={e => setAuthCode(e.target.value)} placeholder="Code from email" /></label> : <label>Password<input required type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength={8} value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="At least 8 characters" /></label>}{authError && <p className="form-error" role="alert">{authError}</p>}<div className="form-actions"><button type="button" className="button button-secondary" disabled={authBusy} onClick={() => { setAuthError(''); setAuthMode(authMode === 'confirm' ? 'signin' : authMode === 'signin' ? 'signup' : 'signin') }}>{authMode === 'confirm' ? 'Back to sign in' : authMode === 'signin' ? 'Create account' : 'Have an account? Sign in'}</button><button type="submit" className="button button-primary" disabled={authBusy}>{authBusy ? <><span className="spinner" /> Working…</> : authMode === 'signup' ? 'Create account' : authMode === 'confirm' ? 'Verify email' : 'Sign in'}</button></div><p className="form-footnote"><ShieldCheck size={14} /> Passwords are managed by Amazon Cognito, not stored by reSource.</p></form>}</section></div>}

    {showMyClaims && (
      <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowMyClaims(false) }}>
        <section className="modal claims-modal" role="dialog" aria-modal="true" aria-labelledby="claims-title">
          <div className="modal-header">
            <div>
              <span className="eyebrow">COMMUNITY ACTIVITY</span>
              <h2 id="claims-title">Requests &amp; History</h2>
              <p>Manage incoming requests on your listings and track items you requested.</p>
            </div>
            <button className="icon-button modal-close" onClick={() => setShowMyClaims(false)} aria-label="Close"><X /></button>
          </div>

          <div className="claims-tabs">
            <button
              className={`claims-tab-btn ${claimsTab === 'received' ? 'tab-active' : ''}`}
              onClick={() => setClaimsTab('received')}
            >
              Received on My Items
              {receivedClaims.filter(c => c.status === 'pending').length > 0 ? (
                <span className="tab-badge badge-pending">
                  {receivedClaims.filter(c => c.status === 'pending').length} new
                </span>
              ) : (
                <span className="tab-badge">{receivedClaims.length}</span>
              )}
            </button>
            <button
              className={`claims-tab-btn ${claimsTab === 'sent' ? 'tab-active' : ''}`}
              onClick={() => setClaimsTab('sent')}
            >
              My Sent Requests
              <span className="tab-badge">{sentClaims.length}</span>
            </button>
          </div>

          <div className="claims-list">
            {loadingClaims ? (
              <p style={{ textAlign: 'center', padding: '24px', color: '#7a867b' }}>Loading requests...</p>
            ) : claimsTab === 'received' ? (
              receivedClaims.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 12px', color: '#7a867b' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>No incoming requests yet</p>
                  <small>When other members request your listed items, they will appear here for your review.</small>
                </div>
              ) : (
                receivedClaims.map(claim => (
                  <div className="claim-card" key={claim.id}>
                    <div className="claim-header">
                      <div>
                        <div className="claim-title">{claim.resource_title}</div>
                        <div className="claim-requester">Requested by <strong>{claim.requester_name}</strong></div>
                      </div>
                      <span className={`claim-status status-${claim.status}`}>{claim.status}</span>
                    </div>
                    {claim.message && <div className="claim-message">&ldquo;{claim.message}&rdquo;</div>}
                    <div className="claim-meta">
                      <span>{dateLabel(claim.created_at)}</span>
                      {claim.status === 'pending' ? (
                        <div className="claim-btn-group">
                          <button
                            className="btn-approve"
                            disabled={updatingClaimId === claim.id}
                            onClick={() => void updateClaimStatus(claim.id, 'approved')}
                          >
                            {updatingClaimId === claim.id ? 'Updating...' : 'Approve'}
                          </button>
                          <button
                            className="btn-reject"
                            disabled={updatingClaimId === claim.id}
                            onClick={() => void updateClaimStatus(claim.id, 'rejected')}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#6e7b70', fontStyle: 'italic' }}>
                          Decision made ({claim.status})
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )
            ) : (
              sentClaims.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 12px', color: '#7a867b' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>No sent requests yet</p>
                  <small>Browse items in the catalog and request what you need to track it here.</small>
                </div>
              ) : (
                sentClaims.map(claim => (
                  <div className="claim-card" key={claim.id}>
                    <div className="claim-header">
                      <div>
                        <div className="claim-title">{claim.resource_title}</div>
                        <div className="claim-requester">{claim.resource_category} {claim.resource_location ? `• ${claim.resource_location}` : ''}</div>
                      </div>
                      <span className={`claim-status status-${claim.status}`}>{claim.status}</span>
                    </div>
                    {claim.message && <div className="claim-message">&ldquo;{claim.message}&rdquo;</div>}
                    <div className="claim-meta">
                      <span>Requested on {dateLabel(claim.created_at)}</span>
                      <span style={{ fontSize: '11px', color: claim.status === 'approved' ? '#1e6845' : claim.status === 'rejected' ? '#a53e2f' : '#b45309', fontWeight: 600 }}>
                        {claim.status === 'approved' ? 'Owner accepted request' : claim.status === 'rejected' ? 'Owner declined' : 'Awaiting owner review'}
                      </span>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </section>
      </div>
    )}
    <a className="skip-link" href="#browse">Skip to listings</a>
  </div>
}

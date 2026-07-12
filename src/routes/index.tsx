import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

export const Route = createFileRoute('/')({
  component: App,
})

// Member login passcode (kept as 1925). The admin PIN is separate, stored in
// the database, defaults to a different value, and is changeable in the app.
const PASSCODE = '1925'

const BANNER_IMG = '/banner-camp.jpeg'
const LOGIN_BANNER_IMG = '/banner-login.jpg'
const GIRL_IMG = '/student-girl.png'
const BOY_IMG = '/student-boy.png'

// Route an image through the Netlify Image CDN so the large source PNG/JPEGs in
// /public are resized on demand and delivered as modern formats (webp/avif) via
// content negotiation. This keeps payloads tiny on phones — e.g. the 3.8 MB
// emblem and the ~0.5 MB student art are only ever shipped at the size shown.
function cdn(src: string, w: number, h?: number, fit: 'contain' | 'cover' = 'contain') {
  const p = new URLSearchParams({ url: src, w: String(w) })
  if (h != null) { p.set('h', String(h)); p.set('fit', fit) }
  return `/.netlify/images?${p.toString()}`
}

type Tab = 'weather' | 'announcements' | 'schedule' | 'rooms' | 'lodging' | 'carpool' | 'fragrance'

interface Announcement {
  id: number
  title: string
  body: string
  pinned: boolean
  createdAt: string
  reactions: Record<string, number>
}

interface ScheduleEvent { time: string; title: string; note: string }
interface ScheduleDay { label: string; date: string; events: ScheduleEvent[] }
interface RoomEntry { room: string; gender: 'sisters' | 'brothers'; chaperone: boolean; occupants: string[] }
type CarType = 'sisters' | 'brothers' | 'coed' | 'plain'
interface Car { name: string; type?: CarType; driver: string; departure: string; passengers: string[] }
// Car arrangements are kept independently for the trip to camp (arrival) and the
// trip home (departure). Editing one leg never affects the other.
interface CarpoolContent { arrival: Car[]; departure: Car[] }
interface TripStop { time: string; text: string }
interface TripLeg { heading: string; date: string; note: string; stops: TripStop[] }
interface TripContent { arrival: TripLeg; departure: TripLeg }
interface Submission {
  id: number
  name: string
  title: string | null
  body: string
  createdAt: string
}

interface Content {
  schedule: ScheduleDay[]
  rooms: RoomEntry[]
  carpool: CarpoolContent
  trip: TripContent
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

// Swap an array item with its neighbour in the given direction (in place).
function moveItem<T>(arr: T[], i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= arr.length) return
  const tmp = arr[i]
  arr[i] = arr[j]
  arr[j] = tmp
}

// ── Helper ────────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ── Line icons ────────────────────────────────────────────────────────────────
// Crisp stroked glyphs for the bottom navigation so the chrome looks designed
// rather than relying on emoji.
function Icon({ name, className = 'w-6 h-6' }: { name: Tab; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'announcements':
      return (
        <svg {...common}>
          <path d="M4 10v4a1 1 0 0 0 1 1h2l4 4V5L7 9H5a1 1 0 0 0-1 1Z" />
          <path d="M16 9a4 4 0 0 1 0 6" />
          <path d="M19 6a8 8 0 0 1 0 12" />
        </svg>
      )
    case 'schedule':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2.5" />
          <path d="M3 10h18M8 3v4M16 3v4" />
          <path d="M8 14h2M14 14h2M8 17.5h2" />
        </svg>
      )
    case 'rooms':
      return (
        <svg {...common}>
          <path d="M3 20v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
          <path d="M3 16h18M3 20v1.5M21 20v1.5" />
          <path d="M7 12V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" />
        </svg>
      )
    case 'carpool':
      return (
        <svg {...common}>
          <path d="M5 13l1.6-4.4A2 2 0 0 1 8.5 7.3h7a2 2 0 0 1 1.9 1.3L19 13" />
          <path d="M4 13h16v4a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1H7.5v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4Z" />
          <path d="M7.5 16h.01M16.5 16h.01" />
        </svg>
      )
    case 'fragrance':
      return (
        <svg {...common}>
          <path d="M12 12c0-3 1.6-4.6 0-7-1.6 2.4 0 4 0 7Z" />
          <path d="M12 12c0 3 1.6 4.6 0 7-1.6-2.4 0-4 0-7Z" />
          <path d="M12 12c-3 0-4.6 1.6-7 0 2.4-1.6 4 0 7 0Z" />
          <path d="M12 12c3 0 4.6 1.6 7 0-2.4-1.6-4 0-7 0Z" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'lodging':
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5" />
          <path d="M5 9.5V20h14V9.5" />
          <path d="M10 20v-5h4v5" />
          <path d="M9 11.5h0M15 11.5h0" />
        </svg>
      )
    case 'weather':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )
  }
}

// ── Shared styles ───────────────────────────────────────────────────────────
// Large text, strong borders and a high-contrast placeholder keep every field
// easy to read on phones and tablets.
const inputCls =
  'w-full border-2 border-dusk-200 rounded-2xl px-3.5 py-3 text-base text-dusk-900 placeholder:text-dusk-500 bg-white focus:outline-none focus:ring-2 focus:ring-ember-400 focus:border-ember-400'

const smallBtn = 'text-sm font-bold px-4 py-2.5 rounded-full transition-colors active:scale-95'
const primaryBtn = 'bg-ember-500 text-white hover:bg-ember-600'

// ── Row reorder / delete controls ─────────────────────────────────────────────
function RowTools({
  onUp, onDown, onDelete, disableUp, disableDown, deleteTitle = 'Remove',
}: {
  onUp: () => void; onDown: () => void; onDelete: () => void
  disableUp: boolean; disableDown: boolean; deleteTitle?: string
}) {
  const base = 'h-11 w-11 grid place-items-center rounded-xl text-xl font-bold transition-colors active:scale-95 disabled:opacity-30'
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button type="button" onClick={onUp} disabled={disableUp} className={`${base} bg-dusk-100 text-dusk-800 hover:bg-dusk-200`} title="Move up" aria-label="Move up">↑</button>
      <button type="button" onClick={onDown} disabled={disableDown} className={`${base} bg-dusk-100 text-dusk-800 hover:bg-dusk-200`} title="Move down" aria-label="Move down">↓</button>
      <button type="button" onClick={onDelete} className={`${base} bg-red-100 text-red-700 hover:bg-red-200`} title={deleteTitle} aria-label={deleteTitle}>🗑</button>
    </div>
  )
}

// Compact "move this person elsewhere" dropdown used in rooms and carpool.
function MoveToSelect({ options, onMove, label }: { options: { value: number; label: string }[]; onMove: (target: number) => void; label: string }) {
  if (options.length === 0) return null
  return (
    <select
      className="text-sm font-semibold rounded-xl border-2 border-dusk-200 bg-white px-2.5 py-2 text-dusk-800"
      value=""
      onChange={e => { const v = Number(e.target.value); if (!Number.isNaN(v)) onMove(v) }}
    >
      <option value="">{label}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// Add-a-person field with its own local state so the draft is only touched on add.
function AddPerson({ onAdd, placeholder }: { onAdd: (name: string) => void; placeholder: string }) {
  const [v, setV] = useState('')
  const add = () => { const t = v.trim(); if (!t) return; onAdd(t); setV('') }
  return (
    <div className="flex gap-2">
      <input
        className={`${inputCls} flex-1`}
        placeholder={placeholder}
        value={v}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
      />
      <button type="button" onClick={add} className={`${smallBtn} ${primaryBtn} shrink-0`}>+ Add</button>
    </div>
  )
}

// Small student avatar (pink girl / blue boy) shown on room and car headers.
function GenderAvatar({ kind, className = 'w-12 h-12' }: { kind: 'sisters' | 'brothers' | 'coed'; className?: string }) {
  if (kind === 'coed') {
    return (
      <span className="flex -space-x-3 shrink-0">
        <img src={cdn(BOY_IMG, 96)} alt="Brothers" loading="lazy" decoding="async" className={`${className} object-contain drop-shadow`} />
        <img src={cdn(GIRL_IMG, 96)} alt="Sisters" loading="lazy" decoding="async" className={`${className} object-contain drop-shadow`} />
      </span>
    )
  }
  const src = kind === 'sisters' ? GIRL_IMG : BOY_IMG
  const alt = kind === 'sisters' ? 'Sisters' : 'Brothers'
  return <img src={cdn(src, 96)} alt={alt} loading="lazy" decoding="async" className={`${className} object-contain drop-shadow shrink-0`} />
}

// ── Passcode screen ───────────────────────────────────────────────────────────
function PasscodeScreen({ onUnlock }: { onUnlock: () => void }) {
  const [digits, setDigits] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const press = (d: string) => {
    if (digits.length >= 4) return
    const next = digits + d
    setDigits(next)
    if (next.length === 4) {
      if (next === PASSCODE) {
        onUnlock()
      } else {
        setError(true)
        setShake(true)
        setTimeout(() => { setDigits(''); setError(false); setShake(false) }, 800)
      }
    }
  }

  const del = () => setDigits(d => d.slice(0, -1))

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 login-bg relative overflow-hidden">
      {/* Soft halo glows for depth */}
      <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-ember-400/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-ember-300/20 blur-3xl" />

      <div className="relative w-full flex flex-col items-center">
        {/* Welcome banner */}
        <div className="w-full max-w-md mb-6 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/30">
          <img
            src={cdn(LOGIN_BANNER_IMG, 900)}
            alt="West Central Region — ISBA Summer Camp 2026 — Realizing our hope in the future of the gospel"
            decoding="async"
            fetchPriority="high"
            className="w-full block"
          />
        </div>

        <div className={`bg-white/95 backdrop-blur rounded-3xl p-8 w-full max-w-xs shadow-2xl ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
          <p className="text-center text-dusk-900 text-lg mb-6 font-bold font-display">Enter Passcode</p>

          <div className="flex justify-center gap-4 mb-8">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
                  i < digits.length
                    ? error ? 'bg-red-500 border-red-500' : 'bg-ember-500 border-ember-500'
                    : 'border-dusk-300'
                }`}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => (
              <button
                key={i}
                onClick={() => k === '⌫' ? del() : k ? press(k) : undefined}
                disabled={!k}
                className={`h-16 rounded-2xl text-2xl font-bold transition-all active:scale-95 ${
                  k === '⌫'
                    ? 'bg-dusk-100 text-dusk-700 hover:bg-dusk-200'
                    : k
                    ? 'bg-ember-500 text-white hover:bg-ember-600 active:bg-ember-700 shadow-sm'
                    : 'invisible'
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          {error && (
            <p className="text-red-600 text-center text-base mt-4 font-bold">Incorrect passcode</p>
          )}
        </div>

        <p className="text-white/80 text-sm mt-6 font-semibold">World Mission Society Church of God</p>
      </div>
    </div>
  )
}

// ── Reusable modal ────────────────────────────────────────────────────────────
// Rendered through a portal on document.body so it is always anchored to the
// viewport. (The tab content sits inside an `animate-pop-in` wrapper whose
// final transform establishes a containing block — without the portal a
// `position: fixed` modal would be positioned relative to that tall, scrolled
// wrapper, forcing the admin to scroll down to find the edit box.)
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  // Lock background scroll while the editor is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-bark-800/55 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 sunset-wash px-4 py-3.5 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold font-display text-white drop-shadow-sm">{title}</h2>
          <button onClick={onClose} className="h-10 w-10 grid place-items-center rounded-full text-white/90 hover:bg-white/20 text-2xl leading-none" aria-label="Close">✕</button>
        </div>
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

function SaveBar({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex gap-2 pt-4 mt-2 sticky bottom-0 bg-white border-t border-dusk-100">
      <button
        onClick={onSave}
        disabled={saving}
        className="flex-1 bg-ember-500 hover:bg-ember-600 text-white font-bold py-3.5 rounded-2xl text-base transition-colors disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
      <button onClick={onCancel} className="flex-1 bg-dusk-100 hover:bg-dusk-200 text-dusk-800 font-bold py-3.5 rounded-2xl text-base transition-colors">
        Cancel
      </button>
    </div>
  )
}

// ── Need Help info button ─────────────────────────────────────────────────────
// A small round "?" button that tucks into the bottom-right corner. Tapping it
// toggles a compact contacts card open and closed, so it never sits in the way
// of the app content.
function HelpBanner() {
  const [open, setOpen] = useState(false)
  return (
    <>
      {/* Transparent catcher so tapping anywhere closes the card */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

      <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-3">
        {open && (
          <div
            className="bg-white rounded-3xl p-5 w-72 max-w-[calc(100vw-2rem)] shadow-2xl ring-1 ring-dusk-200 animate-pop-in"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold font-display text-dusk-900 mb-0.5">Need Help?</h2>
            <p className="text-dusk-700 text-sm mb-3">Camp & medical support</p>
            <div className="space-y-2.5">
              <div className="p-3 bg-ember-50 rounded-2xl">
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="text-2xl">📞</span>
                  <p className="font-bold text-dusk-900 text-sm">Camp contact</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-dusk-900 text-sm font-bold">M. Ray Taylor</p>
                  <div className="flex gap-2">
                    <a href="tel:+17194159988" className="px-3 py-1 rounded-xl bg-ember-100 hover:bg-ember-200 text-ember-800 text-xs font-bold transition-colors">Call</a>
                    <a href="sms:+17194159988" className="px-3 py-1 rounded-xl bg-ember-100 hover:bg-ember-200 text-ember-800 text-xs font-bold transition-colors">Text</a>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-ember-50 rounded-2xl">
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="text-2xl">⛑️</span>
                  <p className="font-bold text-dusk-900 text-sm">Medical Team</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-dusk-900 text-sm font-bold">S. Micaela</p>
                    <div className="flex gap-2">
                      <a href="tel:+14025333696" className="px-3 py-1 rounded-xl bg-ember-100 hover:bg-ember-200 text-ember-800 text-xs font-bold transition-colors">Call</a>
                      <a href="sms:+14025333696" className="px-3 py-1 rounded-xl bg-ember-100 hover:bg-ember-200 text-ember-800 text-xs font-bold transition-colors">Text</a>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-dusk-900 text-sm font-bold">S. Jessica</p>
                    <div className="flex gap-2">
                      <a href="tel:+17123184628" className="px-3 py-1 rounded-xl bg-ember-100 hover:bg-ember-200 text-ember-800 text-xs font-bold transition-colors">Call</a>
                      <a href="sms:+17123184628" className="px-3 py-1 rounded-xl bg-ember-100 hover:bg-ember-200 text-ember-800 text-xs font-bold transition-colors">Text</a>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-dusk-900 text-sm font-bold">B. Stephan Dickens</p>
                    <div className="flex gap-2">
                      <a href="tel:+17202179998" className="px-3 py-1 rounded-xl bg-ember-100 hover:bg-ember-200 text-ember-800 text-xs font-bold transition-colors">Call</a>
                      <a href="sms:+17202179998" className="px-3 py-1 rounded-xl bg-ember-100 hover:bg-ember-200 text-ember-800 text-xs font-bold transition-colors">Text</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'Close help' : 'Need help?'}
          aria-expanded={open}
          className="h-12 w-12 grid place-items-center rounded-full bg-marigold-400 hover:bg-marigold-500 text-bark-800 font-bold text-2xl shadow-lg transition-all active:scale-95"
        >
          {open ? '✕' : '?'}
        </button>
      </div>
    </>
  )
}

// ── Card section heading with optional Edit button ─────────────────────────────
function SectionHeader({ title, isAdmin, onEdit }: { title: string; isAdmin: boolean; onEdit?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-3xl font-bold font-display text-dusk-900">{title}</h2>
      {isAdmin && onEdit && (
        <button onClick={onEdit} className={`${smallBtn} ${primaryBtn} shrink-0`}>✏️ Edit</button>
      )}
    </div>
  )
}

// ── Weather tab ───────────────────────────────────────────────────────────────
// A dedicated, full-page weather section. Forecasts come live from Open-Meteo,
// a free, key-less service rated among the most accurate available: it blends
// the leading national weather models (NOAA/NWS GFS & HRRR, ECMWF, and DWD
// ICON) and automatically picks the best match for each location. Members can
// follow as many places as they like — the camp (Snow Mountain Ranch) and
// Granby, CO are included to start — and add any city by search or their own
// GPS location. The list is saved on the device, and the camp dates (Sun → Thu)
// are highlighted in each 7-day strip.
interface WxLocation { id: string; name: string; lat: number; lon: number }
interface WxCurrent { temp: number; feels: number; code: number; humidity: number; wind: number }
interface WxDay { date: string; code: number; max: number; min: number; precip: number }

const CAMP_WX_LOCATION: WxLocation = { id: 'camp', name: 'Snow Mountain Ranch, CO', lat: 40.0419, lon: -105.8408 }
const GRANBY_WX_LOCATION: WxLocation = { id: 'granby', name: 'Granby, CO', lat: 40.0866, lon: -105.9433 }
const DEFAULT_WX_LOCATIONS: WxLocation[] = [CAMP_WX_LOCATION, GRANBY_WX_LOCATION]
// Camp runs Sunday June 21 → Thursday June 25, 2026.
const CAMP_START = '2026-06-21'
const CAMP_END = '2026-06-25'

// Map a WMO weather code to a friendly emoji + label.
function weatherInfo(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: '☀️', label: 'Clear' }
  if (code === 1) return { emoji: '🌤️', label: 'Mainly clear' }
  if (code === 2) return { emoji: '⛅', label: 'Partly cloudy' }
  if (code === 3) return { emoji: '☁️', label: 'Overcast' }
  if (code === 45 || code === 48) return { emoji: '🌫️', label: 'Fog' }
  if (code >= 51 && code <= 57) return { emoji: '🌦️', label: 'Drizzle' }
  if (code >= 61 && code <= 67) return { emoji: '🌧️', label: 'Rain' }
  if (code >= 71 && code <= 77) return { emoji: '🌨️', label: 'Snow' }
  if (code >= 80 && code <= 82) return { emoji: '🌦️', label: 'Showers' }
  if (code === 85 || code === 86) return { emoji: '🌨️', label: 'Snow showers' }
  if (code >= 95) return { emoji: '⛈️', label: 'Thunderstorm' }
  return { emoji: '🌡️', label: 'Weather' }
}

function wxWeekday(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }) }
function wxShortDate(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

// Cache the most recently fetched forecast per location. Each tab is torn down
// when you switch away and rebuilt when you return, so without this every reopen
// of the Weather tab re-requests a fresh forecast from Open-Meteo for every
// followed location — the more places you follow, the slower it feels, every
// single time. With the cache, the last forecast paints instantly on reopen
// while a fresh one is fetched in the background (and on the usual 10-min timer).
interface WxCache { current: WxCurrent; days: WxDay[] }
function readWxCache(id: string): WxCache | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(`foz-wx-cache-${id}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.current && Array.isArray(parsed.days)) return parsed as WxCache
  } catch { /* ignore */ }
  return null
}
function writeWxCache(id: string, data: WxCache) {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(`foz-wx-cache-${id}`, JSON.stringify(data)) } catch { /* ignore */ }
}

// One followed location: its own current-conditions header plus a 7-day strip.
// Each card fetches independently and refreshes every 10 minutes so the data
// stays live during camp. This scales cleanly to ~100 members at once — every
// request goes straight from the phone to Open-Meteo's CDN, never through our
// server or database.
function LocationWeatherCard({ loc, onRemove }: { loc: WxLocation; onRemove?: () => void }) {
  // Seed from the cached forecast so the card paints immediately on reopen.
  const cached = readWxCache(loc.id)
  const [current, setCurrent] = useState<WxCurrent | null>(cached?.current ?? null)
  const [days, setDays] = useState<WxDay[]>(cached?.days ?? [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchWx = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=7`
      const res = await fetch(url)
      if (!res.ok) throw new Error('bad response')
      const d = await res.json()
      const c = d.current
      const nextCurrent: WxCurrent = {
        temp: Math.round(c.temperature_2m),
        feels: Math.round(c.apparent_temperature),
        code: c.weather_code,
        humidity: Math.round(c.relative_humidity_2m),
        wind: Math.round(c.wind_speed_10m),
      }
      setCurrent(nextCurrent)
      const dy = d.daily
      const nextDays: WxDay[] = (dy?.time ?? []).map((t: string, i: number) => ({
        date: t,
        code: dy.weather_code[i],
        max: Math.round(dy.temperature_2m_max[i]),
        min: Math.round(dy.temperature_2m_min[i]),
        precip: dy.precipitation_probability_max?.[i] ?? 0,
      }))
      setDays(nextDays)
      // Remember this forecast so the next reopen shows it instantly.
      writeWxCache(loc.id, { current: nextCurrent, days: nextDays })
    } catch {
      setError('Weather is unavailable right now — tap ↻ to try again.')
    }
    setLoading(false)
  }, [loc.id, loc.lat, loc.lon])

  useEffect(() => { fetchWx() }, [fetchWx])
  useEffect(() => {
    const id = setInterval(fetchWx, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchWx])

  const wi = current ? weatherInfo(current.code) : null

  return (
    <div className="rounded-3xl overflow-hidden shadow-sm ring-1 ring-black/5 bg-white">
      {/* Current conditions */}
      <div className="sunset-wash text-white px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white/90 flex items-center gap-1 truncate">📍 {loc.name}</p>
            {wi && current ? (
              <div className="flex items-center gap-2.5 mt-1">
                <span className="text-4xl leading-none" aria-hidden>{wi.emoji}</span>
                <div>
                  <p className="text-3xl font-bold font-display leading-none">{current.temp}°</p>
                  <p className="text-sm font-semibold text-white/90 mt-1">{wi.label} · feels {current.feels}°</p>
                </div>
              </div>
            ) : (
              <p className="text-sm font-semibold text-white/90 mt-1.5">{loading ? 'Loading weather…' : '—'}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={fetchWx}
              aria-label="Refresh weather"
              className={`h-9 w-9 grid place-items-center rounded-full bg-white/20 hover:bg-white/30 text-base transition-colors active:scale-95 ${loading ? 'animate-spin' : ''}`}
            >↻</button>
            {onRemove && (
              <button
                onClick={onRemove}
                aria-label={`Remove ${loc.name}`}
                className="h-9 w-9 grid place-items-center rounded-full bg-white/20 hover:bg-white/30 text-lg leading-none transition-colors active:scale-95"
              >✕</button>
            )}
          </div>
        </div>

        {current && (
          <div className="flex items-center gap-4 mt-2 text-sm font-semibold text-white/90">
            <span>💧 {current.humidity}% humidity</span>
            <span>💨 {current.wind} mph wind</span>
          </div>
        )}
      </div>

      {/* 7-day strip with the camp window highlighted */}
      <div className="px-2.5 py-3">
        {error && days.length === 0 ? (
          <p className="text-dusk-700 text-sm font-semibold text-center py-1.5">{error}</p>
        ) : days.length === 0 ? (
          <p className="text-dusk-600 text-sm text-center py-1.5">{loading ? 'Loading forecast…' : 'Forecast unavailable.'}</p>
        ) : (
          <>
            <p className="text-xs font-bold text-dusk-500 px-1 mb-2">7-day forecast · camp days highlighted</p>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {days.map(d => {
                const di = weatherInfo(d.code)
                const inCamp = d.date >= CAMP_START && d.date <= CAMP_END
                return (
                  <div
                    key={d.date}
                    className={`shrink-0 w-[4.5rem] rounded-xl px-1.5 py-2 text-center border ${
                      inCamp ? 'bg-ember-50 border-ember-300' : 'bg-dusk-50 border-dusk-100'
                    }`}
                  >
                    <p className="text-xs font-bold text-dusk-900">{wxWeekday(d.date)}</p>
                    <p className="text-[10px] text-dusk-500 font-semibold">{wxShortDate(d.date)}</p>
                    <p className="text-xl my-1 leading-none" aria-hidden title={di.label}>{di.emoji}</p>
                    <p className="text-sm font-bold text-dusk-900">{d.max}°<span className="text-dusk-500 font-semibold"> / {d.min}°</span></p>
                    {d.precip > 0 && <p className="text-[10px] font-bold text-ember-600 mt-0.5">💧 {d.precip}%</p>}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function WeatherTab() {
  const [locations, setLocations] = useState<WxLocation[]>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('foz-weather-locs')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length) return parsed as WxLocation[]
        } catch { /* ignore */ }
      }
    }
    return DEFAULT_WX_LOCATIONS
  })
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WxLocation[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [geoBusy, setGeoBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const persist = useCallback((list: WxLocation[]) => {
    setLocations(list)
    try { localStorage.setItem('foz-weather-locs', JSON.stringify(list)) } catch { /* ignore */ }
  }, [])

  function add(l: WxLocation) {
    setNotice('')
    if (locations.some(x => Math.abs(x.lat - l.lat) < 0.01 && Math.abs(x.lon - l.lon) < 0.01)) {
      setNotice(`${l.name} is already on your list.`)
      setQuery(''); setResults(null)
      return
    }
    persist([...locations, l])
    setQuery(''); setResults(null)
  }

  function remove(id: string) {
    persist(locations.filter(x => x.id !== id))
  }

  async function runSearch() {
    const q = query.trim()
    if (!q) return
    setSearching(true); setResults(null); setNotice('')
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`)
      const d = await res.json()
      setResults((d.results ?? []).map((r: { id?: number; name: string; admin1?: string; country_code?: string; latitude: number; longitude: number }) => ({
        id: `g${r.id ?? `${r.latitude},${r.longitude}`}`,
        name: [r.name, r.admin1, r.country_code].filter(Boolean).join(', '),
        lat: r.latitude,
        lon: r.longitude,
      })))
    } catch {
      setResults([])
    }
    setSearching(false)
  }

  function useMyLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setNotice('Location is not available on this device — search instead.')
      return
    }
    setGeoBusy(true); setNotice('')
    navigator.geolocation.getCurrentPosition(
      pos => { setGeoBusy(false); add({ id: `me${Date.now()}`, name: 'My location', lat: pos.coords.latitude, lon: pos.coords.longitude }) },
      () => { setGeoBusy(false); setNotice('Could not get your location — allow location access or search instead.') },
      { timeout: 8000 },
    )
  }

  return (
    <div className="p-4 pb-32 space-y-4 animate-pop-in">
      <div>
        <h2 className="text-3xl font-bold font-display text-dusk-900">Weather</h2>
        <p className="text-dusk-700 text-base mt-1.5">Live forecasts for camp and any places you follow.</p>
      </div>

      {/* Add a location */}
      <div className="bg-white/95 rounded-3xl p-4 shadow-sm space-y-2.5">
        <p className="text-sm font-bold text-dusk-700">Add a location</p>
        <div className="flex gap-2">
          <input
            className={`${inputCls} flex-1`}
            placeholder="Search a city or place…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); runSearch() } }}
          />
          <button onClick={runSearch} disabled={searching} className={`${smallBtn} ${primaryBtn} shrink-0`}>
            {searching ? '…' : 'Search'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => add(CAMP_WX_LOCATION)} className={`${smallBtn} bg-ember-100 text-ember-700 hover:bg-ember-200`}>🏕️ Camp</button>
          <button onClick={() => add(GRANBY_WX_LOCATION)} className={`${smallBtn} bg-ember-100 text-ember-700 hover:bg-ember-200`}>⛰️ Granby, CO</button>
          <button onClick={useMyLocation} disabled={geoBusy} className={`${smallBtn} bg-ember-100 text-ember-700 hover:bg-ember-200 disabled:opacity-60`}>
            {geoBusy ? 'Locating…' : '📍 Use my location'}
          </button>
        </div>
        {notice && <p className="text-dusk-700 text-sm font-semibold">{notice}</p>}
        {results && results.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => add(r)}
                className="w-full text-left px-3.5 py-2.5 rounded-2xl bg-white border-2 border-dusk-200 text-dusk-900 font-semibold text-base hover:border-ember-400 transition-colors flex items-center justify-between gap-2"
              >
                <span className="min-w-0 truncate">{r.name}</span>
                <span className="text-ember-600 font-bold shrink-0">+ Add</span>
              </button>
            ))}
          </div>
        )}
        {results && results.length === 0 && (
          <p className="text-dusk-700 text-sm font-semibold">No places found — try another search.</p>
        )}
      </div>

      {/* Followed locations */}
      {locations.length === 0 ? (
        <div className="text-center py-12 text-dusk-700 bg-white/95 rounded-3xl shadow-sm">
          <p className="text-5xl mb-3">⛅</p>
          <p className="font-bold text-lg">No locations yet</p>
          <p className="text-base mt-1">Add the camp, Granby, or any place above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map(loc => (
            <LocationWeatherCard key={loc.id} loc={loc} onRemove={() => remove(loc.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Announcements tab ─────────────────────────────────────────────────────────
// The fixed palette of reactions members can leave on an announcement. Kept in
// sync with ALLOWED_EMOJI in src/routes/api/reactions.ts.
const REACTIONS = ['🙏', '❤️', '🙌', '🔥', '😊'] as const

// The last announcements payload fetched this session. Because the tab unmounts
// whenever the user navigates away, holding the data here lets it re-render
// instantly on return while a fresh copy loads in the background — so members no
// longer see a blank "Loading…" each time they revisit the tab.
let announcementsCache: Announcement[] | null = null

// The app has no usernames, so we mint an anonymous, stable id per browser and
// keep it in localStorage. It is the only thing that identifies "this person"
// for the purpose of toggling their own reactions — it carries no personal data.
function getClientId(): string {
  if (typeof localStorage === 'undefined') return ''
  let id = localStorage.getItem('foz-client-id')
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `c${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem('foz-client-id', id)
  }
  return id
}

// Which emojis this browser has placed on each announcement, mirrored in
// localStorage so a member's own picks stay highlighted across reloads. The
// server remains the source of truth and reconciles this on every tap.
function readMyReactions(): Record<number, string[]> {
  if (typeof localStorage === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem('foz-my-reactions') || '{}') } catch { return {} }
}
function writeMyReactions(v: Record<number, string[]>) {
  try { localStorage.setItem('foz-my-reactions', JSON.stringify(v)) } catch { /* ignore */ }
}

// ── Push notification opt-in ───────────────────────────────────────────────────
// Lets a member turn on alerts for new announcements on their own device. The
// app has no accounts, so this is per-browser and entirely opt-in: tapping it
// asks the phone's permission once and stores the browser's push subscription
// against the same anonymous client id used for reactions. No names are
// collected. iPhones only allow push once the app is on the home screen, so
// those visitors are guided to install first.

// Push services hand out the VAPID key as URL-safe base64; the browser's
// subscribe() call needs it as raw bytes.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function NotifyMe() {
  // 'checking' until we know the device's capability and current state.
  const [state, setState] = useState<'checking' | 'unsupported' | 'needs-install' | 'blocked' | 'on' | 'off'>('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') return
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
      // iPhone/iPad only deliver web push once the app is installed to the home
      // screen and opened from there — a plain Safari tab can't subscribe.
      if (detectPlatform() === 'ios' && !appIsInstalled()) { if (!cancelled) setState('needs-install'); return }
      if (!supported) { if (!cancelled) setState('unsupported'); return }
      if (Notification.permission === 'denied') { if (!cancelled) setState('blocked'); return }
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (!cancelled) setState(sub ? 'on' : 'off')
      } catch {
        if (!cancelled) setState('off')
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  async function enable() {
    setBusy(true); setError('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off')
        setBusy(false)
        return
      }
      const res = await fetch('/api/push')
      const { publicKey } = await res.json() as { publicKey: string }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })
      const save = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: getClientId(), subscription: sub.toJSON() }),
      })
      if (!save.ok) throw new Error('save failed')
      setState('on')
    } catch {
      setError("Couldn't turn on notifications — please try again.")
    }
    setBusy(false)
  }

  async function disable() {
    setBusy(true); setError('')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch(`/api/push?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: 'DELETE' }).catch(() => {})
        await sub.unsubscribe().catch(() => {})
      }
      setState('off')
    } catch {
      setError("Couldn't turn off notifications — please try again.")
    }
    setBusy(false)
  }

  // Stay out of the way on devices/browsers that simply can't do this.
  if (state === 'checking' || state === 'unsupported') return null

  if (state === 'needs-install') {
    return (
      <div className="rounded-3xl bg-white border-2 border-dusk-200 p-4 flex items-start gap-3 shadow-sm">
        <div className="shrink-0 h-11 w-11 rounded-2xl bg-ember-50 grid place-items-center text-2xl" aria-hidden>🔔</div>
        <div className="min-w-0">
          <p className="font-bold font-display text-dusk-900 text-base leading-tight">Want announcement alerts?</p>
          <p className="text-dusk-600 text-sm leading-snug mt-0.5">
            On iPhone, first add the app to your home screen (the prompt at the top), open it from there, then return here to turn on notifications.
          </p>
        </div>
      </div>
    )
  }

  const on = state === 'on'

  return (
    <div className="rounded-3xl bg-white border-2 border-dusk-200 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="shrink-0 h-11 w-11 rounded-2xl bg-ember-50 grid place-items-center text-2xl" aria-hidden>{on ? '🔔' : '🔕'}</div>
        <div className="min-w-0 flex-1">
          <p className="font-bold font-display text-dusk-900 text-base leading-tight">Announcement alerts</p>
          <p className="text-dusk-600 text-sm leading-snug mt-0.5">
            {state === 'blocked'
              ? 'Notifications are blocked in your browser settings — allow them there to get alerts.'
              : on
              ? "You'll get a notification on this device when a new announcement is posted."
              : 'Get a notification on this device when a new announcement is posted.'}
          </p>
        </div>
        {state !== 'blocked' && (
          <button
            onClick={on ? disable : enable}
            disabled={busy}
            className={`${smallBtn} shrink-0 ${on ? 'bg-dusk-100 text-dusk-700 hover:bg-dusk-200' : primaryBtn} disabled:opacity-60`}
          >
            {busy ? '…' : on ? 'Turn off' : '🔔 Notify me'}
          </button>
        )}
      </div>
      {error && <p className="text-red-600 text-sm font-semibold mt-2">{error}</p>}
    </div>
  )
}

function AnnouncementsTab({ isAdmin, adminPin, onAuthFail }: { isAdmin: boolean; adminPin: string | null; onAuthFail: () => void }) {
  const [items, setItems] = useState<Announcement[]>(() => announcementsCache ?? [])
  const [loading, setLoading] = useState(() => announcementsCache === null)
  const [myReactions, setMyReactions] = useState<Record<number, string[]>>(() => readMyReactions())
  const clientId = useRef(getClientId()).current
  const [showPost, setShowPost] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')

  const load = useCallback(async (fresh = false) => {
    if (announcementsCache === null) setLoading(true)
    try {
      const res = await fetch(fresh ? `/api/announcements?t=${Date.now()}` : '/api/announcements')
      const data: Announcement[] = await res.json()
      announcementsCache = data
      setItems(data)
    } catch { /* keep whatever is on screen */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Toggle one reaction with an optimistic update, then reconcile against the
  // authoritative counts the server returns.
  async function toggleReaction(id: number, emoji: string) {
    if (!clientId) return
    const mine = myReactions[id] ?? []
    const had = mine.includes(emoji)

    const nextMine = { ...myReactions, [id]: had ? mine.filter(e => e !== emoji) : [...mine, emoji] }
    setMyReactions(nextMine)
    writeMyReactions(nextMine)
    setItems(prev => {
      const next = prev.map(a => {
        if (a.id !== id) return a
        const counts = { ...a.reactions }
        counts[emoji] = (counts[emoji] ?? 0) + (had ? -1 : 1)
        if (counts[emoji] <= 0) delete counts[emoji]
        return { ...a, reactions: counts }
      })
      announcementsCache = next
      return next
    })

    try {
      const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementId: id, emoji, clientId }),
      })
      if (!res.ok) return
      const { reactions, mine: serverMine } = await res.json() as { reactions: Record<string, number>; mine: string[] }
      setItems(prev => {
        const next = prev.map(a => a.id === id ? { ...a, reactions } : a)
        announcementsCache = next
        return next
      })
      setMyReactions(prev => {
        const merged = { ...prev, [id]: serverMine }
        writeMyReactions(merged)
        return merged
      })
    } catch { /* leave the optimistic state; next load will reconcile */ }
  }

  async function post() {
    if (!title.trim() || !body.trim()) { setPostError('Title and message required'); return }
    setPosting(true); setPostError('')
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, pinned, passcode: adminPin }),
    })
    if (res.ok) {
      setTitle(''); setBody(''); setPinned(false); setShowPost(false)
      load(true)
    } else {
      if (res.status === 401) onAuthFail()
      setPostError('Could not post — admin session may have expired')
    }
    setPosting(false)
  }

  async function del(id: number) {
    if (!window.confirm('Delete this announcement?')) return
    const res = await fetch(`/api/announcements?id=${id}&passcode=${encodeURIComponent(adminPin ?? '')}`, { method: 'DELETE' })
    if (res.status === 401) onAuthFail()
    load(true)
  }

  return (
    <div className="p-4 space-y-4 pb-32 animate-pop-in">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold font-display text-dusk-900">Announcements</h2>
        {isAdmin && (
          <button
            onClick={() => setShowPost(v => !v)}
            className={`${smallBtn} ${primaryBtn}`}
          >
            + Post
          </button>
        )}
      </div>

      {isAdmin && showPost && (
        <div className="bg-ember-50 rounded-3xl p-4 space-y-3 border-2 border-ember-100">
          <h3 className="font-bold font-display text-ember-700 text-lg">New Announcement</h3>
          <input className={inputCls} placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea className={`${inputCls} h-28 resize-none`} placeholder="Message…" value={body} onChange={e => setBody(e.target.value)} />
          <label className="flex items-center gap-2 text-base text-dusk-900 font-semibold cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} className="w-5 h-5 rounded accent-ember-500" />
            Pin to top
          </label>
          {postError && <p className="text-red-600 text-base font-semibold">{postError}</p>}
          <div className="flex gap-2">
            <button onClick={post} disabled={posting} className="flex-1 bg-ember-500 hover:bg-ember-600 text-white font-bold py-3 rounded-2xl text-base transition-colors disabled:opacity-60">
              {posting ? 'Posting…' : 'Post'}
            </button>
            <button onClick={() => setShowPost(false)} className="flex-1 bg-dusk-100 hover:bg-dusk-200 text-dusk-800 font-bold py-3 rounded-2xl text-base transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <NotifyMe />

      {loading ? (
        <div className="text-center py-12 text-dusk-600 text-lg">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-dusk-700 bg-white rounded-3xl shadow-md border-2 border-dusk-200">
          <p className="text-5xl mb-3">📣</p>
          <p className="font-bold text-lg">No announcements yet</p>
          <p className="text-base mt-1">Check back soon!</p>
        </div>
      ) : (
        items.map(a => (
          <div key={a.id} className={`rounded-3xl p-5 border-2 shadow-md ${a.pinned ? 'bg-marigold-100 border-marigold-400' : 'bg-white border-dusk-200'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {a.pinned && <span className="text-sm bg-marigold-500 text-white px-2.5 py-0.5 rounded-full font-bold">📌 Pinned</span>}
                  <h3 className="font-bold font-display text-dusk-900 text-2xl leading-tight">{a.title}</h3>
                </div>
                <p className="text-dusk-900 text-lg mt-3 whitespace-pre-wrap leading-relaxed font-medium">{a.body}</p>
                <p className="text-dusk-600 text-sm mt-4 font-semibold flex items-center gap-1.5">🕑 {formatDate(a.createdAt)}</p>
              </div>
              {isAdmin && (
                <button onClick={() => del(a.id)} className="h-10 w-10 grid place-items-center rounded-full text-dusk-400 hover:text-red-600 hover:bg-red-50 text-2xl leading-none shrink-0 transition-colors" title="Delete" aria-label="Delete announcement">✕</button>
              )}
            </div>

            {/* Reactions — tap to add or remove yours. Counts are everyone's total. */}
            <div className="mt-4 flex flex-wrap gap-2">
              {REACTIONS.map(emoji => {
                const count = a.reactions?.[emoji] ?? 0
                const mineHas = (myReactions[a.id] ?? []).includes(emoji)
                return (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(a.id, emoji)}
                    aria-pressed={mineHas}
                    aria-label={`React with ${emoji}${count ? ` (${count})` : ''}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-base font-bold border-2 transition-all active:scale-95 ${
                      mineHas
                        ? 'bg-ember-100 border-ember-400 text-ember-800'
                        : 'bg-white/70 border-dusk-200 text-dusk-600 hover:border-ember-300'
                    }`}
                  >
                    <span className="text-lg leading-none" aria-hidden>{emoji}</span>
                    {count > 0 && <span className="tabular-nums">{count}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ── Schedule tab + editor ──────────────────────────────────────────────────────
function ScheduleTab({ days, isAdmin, onSave }: { days: ScheduleDay[] | null; isAdmin: boolean; onSave: (d: ScheduleDay[]) => Promise<boolean> }) {
  const [dayIdx, setDayIdx] = useState(0)
  const [editing, setEditing] = useState(false)

  if (!days) return <Loading />
  const idx = Math.min(dayIdx, Math.max(0, days.length - 1))
  const day = days[idx]

  return (
    <div className="p-4 pb-32 space-y-3 animate-pop-in">
      <SectionHeader title="Schedule" isAdmin={isAdmin} onEdit={() => setEditing(true)} />

      {days.length === 0 ? (
        <p className="text-dusk-700 bg-white/95 rounded-3xl p-6 text-center text-lg shadow-sm">No schedule yet.</p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {days.map((d, i) => (
              <button
                key={i}
                onClick={() => setDayIdx(i)}
                className={`shrink-0 px-5 py-2.5 rounded-full text-base font-bold transition-all ${
                  i === idx ? 'bg-ember-500 text-white shadow' : 'bg-white text-dusk-800 hover:bg-ember-50'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <p className="text-ember-700 font-bold text-base">{day.date}</p>

          <div className="relative bg-white/95 rounded-3xl p-4 shadow-sm">
            <div className="absolute left-[92px] top-4 bottom-4 w-0.5 bg-ember-200" />
            <div className="space-y-5">
              {day.events.map((e, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <span className="text-sm text-dusk-900 font-bold w-16 shrink-0 pt-0.5 text-right">{e.time}</span>
                  <div className="relative pl-6">
                    <div className="absolute -left-[7px] top-1.5 w-3.5 h-3.5 rounded-full bg-ember-500 border-2 border-white shadow" />
                    <p className={`font-bold text-dusk-900 text-base ${e.title.includes('Deadline') ? 'text-ember-700' : ''}`}>{e.title}</p>
                    {e.note && <p className="text-dusk-600 text-sm mt-0.5 leading-relaxed">{e.note}</p>}
                  </div>
                </div>
              ))}
              {day.events.length === 0 && <p className="text-dusk-500 text-base pl-2">No events for this day.</p>}
            </div>
          </div>
        </>
      )}

      {editing && (
        <ScheduleEditor initial={days} onClose={() => setEditing(false)} onSave={onSave} />
      )}
    </div>
  )
}

function ScheduleEditor({ initial, onClose, onSave }: { initial: ScheduleDay[]; onClose: () => void; onSave: (d: ScheduleDay[]) => Promise<boolean> }) {
  const [draft, setDraft] = useState<ScheduleDay[]>(() => clone(initial))
  const [saving, setSaving] = useState(false)
  const edit = (fn: (d: ScheduleDay[]) => void) => setDraft(prev => { const d = clone(prev); fn(d); return d })

  return (
    <Modal title="Edit Schedule" onClose={onClose}>
      <p className="text-sm text-dusk-700 mb-3">Use ↑ / ↓ to reorder days and events. Items stay until you tap 🗑 to delete them.</p>
      <div className="space-y-4">
        {draft.map((day, di) => (
          <div key={di} className="border-2 border-dusk-200 rounded-2xl p-3 space-y-3">
            <div className="flex gap-2 items-center">
              <span className="text-sm font-bold text-dusk-600 shrink-0">Day</span>
              <RowTools
                onUp={() => edit(d => moveItem(d, di, -1))}
                onDown={() => edit(d => moveItem(d, di, 1))}
                onDelete={() => edit(d => { d.splice(di, 1) })}
                disableUp={di === 0}
                disableDown={di === draft.length - 1}
                deleteTitle="Remove day"
              />
            </div>
            <input className={inputCls} placeholder="Day label (e.g. Day 1)" value={day.label} onChange={e => edit(d => { d[di].label = e.target.value })} />
            <input className={inputCls} placeholder="Date (e.g. Mon, Jul 6)" value={day.date} onChange={e => edit(d => { d[di].date = e.target.value })} />

            <div className="space-y-3 pt-1">
              {day.events.map((ev, ei) => (
                <div key={ei} className="bg-dusk-50 rounded-2xl p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-dusk-600">Event {ei + 1}</span>
                    <RowTools
                      onUp={() => edit(d => moveItem(d[di].events, ei, -1))}
                      onDown={() => edit(d => moveItem(d[di].events, ei, 1))}
                      onDelete={() => edit(d => { d[di].events.splice(ei, 1) })}
                      disableUp={ei === 0}
                      disableDown={ei === day.events.length - 1}
                      deleteTitle="Remove event"
                    />
                  </div>
                  <input className={inputCls} placeholder="Time (e.g. 9:00 AM)" value={ev.time} onChange={e => edit(d => { d[di].events[ei].time = e.target.value })} />
                  <input className={inputCls} placeholder="Title" value={ev.title} onChange={e => edit(d => { d[di].events[ei].title = e.target.value })} />
                  <input className={inputCls} placeholder="Note (optional)" value={ev.note} onChange={e => edit(d => { d[di].events[ei].note = e.target.value })} />
                </div>
              ))}
              <button onClick={() => edit(d => { d[di].events.push({ time: '', title: '', note: '' }) })} className={`${smallBtn} bg-ember-100 text-ember-700 hover:bg-ember-200`}>+ Add event</button>
            </div>
          </div>
        ))}
        <button onClick={() => edit(d => { d.push({ label: `Day ${d.length + 1}`, date: '', events: [] }) })} className={`${smallBtn} ${primaryBtn}`}>+ Add day</button>
      </div>
      <SaveBar saving={saving} onCancel={onClose} onSave={async () => { setSaving(true); const ok = await onSave(draft); setSaving(false); if (ok) onClose() }} />
    </Modal>
  )
}

// ── Rooms tab + editor ──────────────────────────────────────────────────────────
const ROOM_THEME = {
  sisters: {
    band: 'bg-pink-600',
    card: 'bg-pink-50 border-pink-300',
    chip: 'bg-pink-100 text-pink-900',
    label: 'Sisters',
  },
  brothers: {
    band: 'bg-dusk-600',
    card: 'bg-dusk-50 border-dusk-300',
    chip: 'bg-dusk-100 text-dusk-900',
    label: 'Brothers',
  },
} as const

function roomTheme(g: RoomEntry['gender']) { return ROOM_THEME[g] ?? ROOM_THEME.brothers }

function RoomsTab({ rooms, isAdmin, onSave }: { rooms: RoomEntry[] | null; isAdmin: boolean; onSave: (d: RoomEntry[]) => Promise<boolean> }) {
  const [search, setSearch] = useState('')
  const [editIdx, setEditIdx] = useState<number | 'new' | null>(null)
  if (!rooms) return <Loading />

  const lower = search.trim().toLowerCase()
  const filtering = !!lower
  const shown = filtering
    ? rooms.filter(r =>
        r.room.toLowerCase().includes(lower) ||
        r.occupants.some(o => o.toLowerCase().includes(lower)),
      )
    : rooms

  // Reorder a single room and persist right away so the order updates live.
  const moveRoom = (ri: number, dir: -1 | 1) => {
    const d = clone(rooms); moveItem(d, ri, dir); onSave(d)
  }

  const blank: RoomEntry = { room: String(rooms.length + 1), gender: 'sisters', chaperone: true, occupants: [] }

  return (
    <div className="p-4 pb-32 space-y-4 animate-pop-in">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-3xl font-bold font-display text-dusk-900">Room Arrangements</h2>
        {isAdmin && (
          <button onClick={() => setEditIdx('new')} className={`${smallBtn} ${primaryBtn} shrink-0`}>+ Add Room</button>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm font-bold bg-white/95 rounded-2xl px-3.5 py-2.5 shadow-sm">
        <span className="flex items-center gap-1.5 text-dusk-800"><span className="w-3.5 h-3.5 rounded-full bg-pink-600" /> Sisters</span>
        <span className="flex items-center gap-1.5 text-dusk-800"><span className="w-3.5 h-3.5 rounded-full bg-dusk-600" /> Brothers</span>
        <span className="flex items-center gap-1.5 text-dusk-800">⭐ Chaperone</span>
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dusk-400 text-lg">🔍</span>
        <input className={`${inputCls} pl-10`} placeholder="Search by name or room…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isAdmin && (
        <p className="text-sm text-dusk-700 bg-white/85 rounded-2xl px-3.5 py-2.5">
          Tap <span className="font-bold">✏️ Edit</span> on a room to change just that one, or use ↑ / ↓ to reorder. Move a person to another room from inside the editor.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {shown.map(room => {
          const ri = rooms.indexOf(room)
          const t = roomTheme(room.gender)
          return (
            <div key={ri} className={`rounded-3xl border-2 shadow-sm overflow-hidden ${t.card}`}>
              <div className={`${t.band} px-4 py-3 flex items-center justify-between gap-2`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <GenderAvatar kind={room.gender} className="w-11 h-11" />
                  <h3 className="font-bold font-display text-white text-xl">Room {room.room}</h3>
                </div>
                <span className="bg-white/25 text-white text-sm font-bold px-2.5 py-0.5 rounded-full shrink-0">{t.label}</span>
              </div>
              <div className="px-4 py-3 flex flex-wrap gap-2">
                {room.occupants.map((o, i) => {
                  const isChaperone = room.chaperone && i === 0
                  const match = lower && o.toLowerCase().includes(lower)
                  return (
                    <span
                      key={i}
                      className={`text-base px-3 py-1.5 rounded-full font-semibold ${
                        isChaperone ? 'bg-marigold-400 text-bark-800 ring-2 ring-marigold-500'
                        : match ? 'bg-marigold-200 text-bark-800'
                        : `${t.chip}`
                      }`}
                    >
                      {isChaperone && '⭐ '}{o}{isChaperone && ' · Chaperone'}
                    </span>
                  )
                })}
                {room.occupants.length === 0 && <span className="text-base text-dusk-500">No occupants listed</span>}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2 px-3 py-2.5 border-t border-black/5 bg-white/55">
                  <button onClick={() => setEditIdx(ri)} className={`${smallBtn} ${primaryBtn}`}>✏️ Edit</button>
                  {!filtering && (
                    <div className="ml-auto flex items-center gap-1.5">
                      <button onClick={() => moveRoom(ri, -1)} disabled={ri === 0} className="h-10 w-10 grid place-items-center rounded-xl bg-dusk-100 text-dusk-800 hover:bg-dusk-200 disabled:opacity-30 text-xl font-bold active:scale-95" aria-label="Move room up">↑</button>
                      <button onClick={() => moveRoom(ri, 1)} disabled={ri === rooms.length - 1} className="h-10 w-10 grid place-items-center rounded-xl bg-dusk-100 text-dusk-800 hover:bg-dusk-200 disabled:opacity-30 text-xl font-bold active:scale-95" aria-label="Move room down">↓</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {lower && shown.length === 0 && (
        <div className="text-center py-12 text-dusk-700 bg-white/95 rounded-3xl shadow-sm">
          <p className="text-5xl mb-3">🔍</p>
          <p className="font-bold text-lg">No results for "{search}"</p>
        </div>
      )}

      {editIdx !== null && (
        <RoomCardEditor
          initial={editIdx === 'new' ? [...rooms, blank] : rooms}
          index={editIdx === 'new' ? rooms.length : editIdx}
          onClose={() => setEditIdx(null)}
          onSave={onSave}
        />
      )}
    </div>
  )
}

// Edits a single room card so the admin only ever sees one box at a time.
function RoomCardEditor({ initial, index, onClose, onSave }: { initial: RoomEntry[]; index: number; onClose: () => void; onSave: (d: RoomEntry[]) => Promise<boolean> }) {
  const [draft, setDraft] = useState<RoomEntry[]>(() => clone(initial))
  const [saving, setSaving] = useState(false)
  const edit = (fn: (d: RoomEntry[]) => void) => setDraft(prev => { const d = clone(prev); fn(d); return d })
  const r = draft[index]
  if (!r) return null
  const others = draft
    .map((rr, idx) => ({ value: idx, label: `Room ${rr.room || idx + 1}` }))
    .filter(o => o.value !== index)

  async function removeRoom() {
    if (!window.confirm('Delete this entire room?')) return
    setSaving(true)
    const d = clone(draft); d.splice(index, 1)
    const ok = await onSave(d); setSaving(false); if (ok) onClose()
  }

  return (
    <Modal title={`Edit Room ${r.room || index + 1}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <input className={`${inputCls} w-24 shrink-0`} placeholder="No." value={r.room} onChange={e => edit(d => { d[index].room = e.target.value })} />
          <select
            className={`${inputCls} bg-white`}
            value={r.gender}
            onChange={e => edit(d => { d[index].gender = e.target.value as RoomEntry['gender'] })}
          >
            <option value="sisters">Sisters (pink)</option>
            <option value="brothers">Brothers (blue)</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-base font-semibold text-dusk-800 cursor-pointer">
          <input type="checkbox" checked={r.chaperone} onChange={e => edit(d => { d[index].chaperone = e.target.checked })} className="w-5 h-5 rounded accent-ember-500" />
          First person is the chaperone
        </label>

        <div className="space-y-2 pt-1">
          <p className="text-sm font-bold text-dusk-600">People in this room</p>
          {r.occupants.map((o, oi) => (
            <div key={oi} className="bg-dusk-50 rounded-2xl p-2 space-y-2 border border-dusk-200">
              <div className="flex items-center gap-2">
                <input
                  className={`${inputCls} flex-1`}
                  value={o}
                  placeholder="Name"
                  onChange={e => edit(d => { d[index].occupants[oi] = e.target.value })}
                />
                <RowTools
                  onUp={() => edit(d => moveItem(d[index].occupants, oi, -1))}
                  onDown={() => edit(d => moveItem(d[index].occupants, oi, 1))}
                  onDelete={() => edit(d => { d[index].occupants.splice(oi, 1) })}
                  disableUp={oi === 0}
                  disableDown={oi === r.occupants.length - 1}
                  deleteTitle="Remove person"
                />
              </div>
              {(oi === 0 && r.chaperone) && <p className="text-xs font-bold text-marigold-600 pl-1">⭐ Chaperone</p>}
              <MoveToSelect
                label="Move to another room…"
                options={others}
                onMove={target => edit(d => {
                  const [person] = d[index].occupants.splice(oi, 1)
                  d[target].occupants.push(person)
                })}
              />
            </div>
          ))}
          <AddPerson placeholder="Add a person…" onAdd={name => edit(d => { d[index].occupants.push(name) })} />
        </div>

        <button onClick={removeRoom} disabled={saving} className={`${smallBtn} bg-red-100 text-red-700 hover:bg-red-200 w-full`}>🗑 Delete this room</button>
      </div>
      <SaveBar saving={saving} onCancel={onClose} onSave={async () => { setSaving(true); const ok = await onSave(draft); setSaving(false); if (ok) onClose() }} />
    </Modal>
  )
}

// ── Carpool tab + editor ────────────────────────────────────────────────────────
// Vehicles are colour-coded: pink (sisters), blue (brothers), purple (co-ed).
// "plain" vehicles are left intentionally neutral — no colour, badge, or avatar.
const CAR_THEME = {
  sisters: { band: 'bg-pink-600', card: 'bg-pink-50 border-pink-300', chip: 'bg-pink-100 text-pink-900', driverChip: 'bg-pink-200 text-pink-900', label: 'Sisters' },
  brothers: { band: 'bg-dusk-600', card: 'bg-dusk-50 border-dusk-300', chip: 'bg-dusk-100 text-dusk-900', driverChip: 'bg-dusk-200 text-dusk-900', label: 'Brothers' },
  coed: { band: 'bg-purple-600', card: 'bg-purple-50 border-purple-300', chip: 'bg-purple-100 text-purple-900', driverChip: 'bg-purple-200 text-purple-900', label: 'Co-ed' },
  plain: { band: 'bg-slate-500', card: 'bg-white border-slate-300', chip: 'bg-slate-100 text-slate-800', driverChip: 'bg-slate-200 text-slate-800', label: '' },
} as const

function carTheme(t?: CarType) { return CAR_THEME[t ?? 'coed'] ?? CAR_THEME.coed }

// Arrival (to camp) and Departure (home) plans, shown as two bubbles at the top
// of the Carpool tab. The data lives in the database so admins can edit it in
// the app. The departure plans start empty — car departure arrangements are
// finalised later — so the admin builds that schedule from here when ready.
const LEG_META = {
  arrival: { emoji: '🚌', bubble: 'Arrival', fallbackHeading: 'Heading to Camp' },
  departure: { emoji: '🏠', bubble: 'Departure', fallbackHeading: 'Heading Home' },
} as const
type LegKey = keyof typeof LEG_META

function TripLogistics({ trip, leg, isAdmin, onSave }: { trip: TripContent | null; leg: LegKey; isAdmin: boolean; onSave: (t: TripContent) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false)
  if (!trip) return null
  const info = trip[leg]
  const meta = LEG_META[leg]
  const empty = !info.date && !info.note.trim() && info.stops.length === 0
  const accent = leg === 'arrival' ? 'bg-ember-500 text-white' : 'bg-marigold-400 text-bark-800'

  return (
    <div className="bg-white/95 rounded-3xl p-4 shadow-sm space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-2xl font-bold font-display text-dusk-900">{info.heading || meta.fallbackHeading}</h3>
            {info.date && <span className={`text-sm font-bold px-3 py-1 rounded-full ${accent}`}>{info.date}</span>}
          </div>
          {isAdmin && (
            <button onClick={() => setEditing(true)} className={`${smallBtn} ${primaryBtn} shrink-0`}>✏️ Edit</button>
          )}
        </div>

        {empty ? (
          <p className="mt-3 bg-dusk-50 border-2 border-dashed border-dusk-200 rounded-2xl px-3.5 py-4 text-dusk-700 text-base leading-relaxed">
            {isAdmin
              ? '📝 No plans added yet. Tap ✏️ Edit to create the departure schedule once the arrangements are ready.'
              : '🚗 Departure plans will be shared here once the arrangements are confirmed. Check back soon!'}
          </p>
        ) : (
          <>
            <ul className="mt-3 space-y-2.5">
              {info.stops.map((s, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="shrink-0 w-20 text-right text-sm font-bold text-ember-700 pt-0.5">{s.time}</span>
                  <span className="flex-1 text-dusk-800 text-base leading-snug">{s.text}</span>
                </li>
              ))}
            </ul>
            {info.note.trim() && (
              <p className="mt-3 bg-marigold-100 border border-marigold-300 rounded-2xl px-3.5 py-3 text-bark-800 text-base leading-relaxed">
                📍 {info.note}
              </p>
            )}
          </>
        )}
      </div>

      {editing && (
        <TripLegEditor legKey={leg} trip={trip} onClose={() => setEditing(false)} onSave={onSave} />
      )}
    </div>
  )
}

// Edits a single trip leg (arrival or departure): heading, date, note, and the
// list of timed stops. Saves the whole trip object back so the other leg is
// preserved.
function TripLegEditor({ legKey, trip, onClose, onSave }: { legKey: LegKey; trip: TripContent; onClose: () => void; onSave: (t: TripContent) => Promise<boolean> }) {
  const [draft, setDraft] = useState<TripContent>(() => clone(trip))
  const [saving, setSaving] = useState(false)
  const edit = (fn: (t: TripContent) => void) => setDraft(prev => { const d = clone(prev); fn(d); return d })
  const leg = draft[legKey]
  const meta = LEG_META[legKey]

  return (
    <Modal title={`Edit ${meta.bubble} Plans`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-bold text-dusk-600 mb-1.5">Heading</label>
          <input className={inputCls} placeholder={meta.fallbackHeading} value={leg.heading} onChange={e => edit(t => { t[legKey].heading = e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-bold text-dusk-600 mb-1.5">Date</label>
          <input className={inputCls} placeholder="e.g. Thursday, June 25" value={leg.date} onChange={e => edit(t => { t[legKey].date = e.target.value })} />
        </div>

        <div className="space-y-3 pt-1">
          <p className="text-sm font-bold text-dusk-600">Stops & times</p>
          {leg.stops.map((s, si) => (
            <div key={si} className="bg-dusk-50 rounded-2xl p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-dusk-600">Stop {si + 1}</span>
                <RowTools
                  onUp={() => edit(t => moveItem(t[legKey].stops, si, -1))}
                  onDown={() => edit(t => moveItem(t[legKey].stops, si, 1))}
                  onDelete={() => edit(t => { t[legKey].stops.splice(si, 1) })}
                  disableUp={si === 0}
                  disableDown={si === leg.stops.length - 1}
                  deleteTitle="Remove stop"
                />
              </div>
              <input className={inputCls} placeholder="Time (e.g. 7:45 AM)" value={s.time} onChange={e => edit(t => { t[legKey].stops[si].time = e.target.value })} />
              <input className={inputCls} placeholder="What happens (e.g. Breakfast to go)" value={s.text} onChange={e => edit(t => { t[legKey].stops[si].text = e.target.value })} />
            </div>
          ))}
          <button onClick={() => edit(t => { t[legKey].stops.push({ time: '', text: '' }) })} className={`${smallBtn} bg-ember-100 text-ember-700 hover:bg-ember-200`}>+ Add stop</button>
        </div>

        <div>
          <label className="block text-sm font-bold text-dusk-600 mb-1.5">Note (optional)</label>
          <textarea className={`${inputCls} h-24 resize-none`} placeholder="A reminder or safe-travels note…" value={leg.note} onChange={e => edit(t => { t[legKey].note = e.target.value })} />
        </div>
      </div>
      <SaveBar saving={saving} onCancel={onClose} onSave={async () => { setSaving(true); const ok = await onSave(draft); setSaving(false); if (ok) onClose() }} />
    </Modal>
  )
}

function CarpoolTab({ carpool, trip, isAdmin, onSave, onSaveTrip }: { carpool: CarpoolContent | null; trip: TripContent | null; isAdmin: boolean; onSave: (d: CarpoolContent) => Promise<boolean>; onSaveTrip: (t: TripContent) => Promise<boolean> }) {
  const [leg, setLeg] = useState<LegKey>('arrival')
  const [search, setSearch] = useState('')
  const [editIdx, setEditIdx] = useState<number | 'new' | null>(null)
  if (!carpool) return <Loading />

  // Cars are per leg — the active leg's list is what the admin edits, and saves
  // merge it back without touching the other leg, so arrival and departure stay
  // fully independent.
  const cars = carpool[leg] ?? []
  const saveCars = (updated: Car[]) => onSave({ ...carpool, [leg]: updated })

  const lower = search.trim().toLowerCase()
  const filtering = !!lower
  const shown = filtering
    ? cars.filter(c =>
        c.name.toLowerCase().includes(lower) ||
        c.driver.toLowerCase().includes(lower) ||
        c.passengers.some(p => p.toLowerCase().includes(lower)),
      )
    : cars

  const moveCar = (ci: number, dir: -1 | 1) => {
    const d = clone(cars); moveItem(d, ci, dir); saveCars(d)
  }

  const blank: Car = { name: 'New Car', type: 'coed', driver: '', departure: '', passengers: [] }

  return (
    <div className="p-4 pb-32 space-y-4 animate-pop-in">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-3xl font-bold font-display text-dusk-900">Carpool Arrangements</h2>
        {isAdmin && (
          <button onClick={() => setEditIdx('new')} className={`${smallBtn} ${primaryBtn} shrink-0`}>+ Add Car</button>
        )}
      </div>

      {/* Master Arrival / Departure switch — controls both the trip itinerary and
          the car arrangements below, so each leg has its own independent cars. */}
      <div className="grid grid-cols-2 gap-2 bg-white/95 rounded-3xl p-2 shadow-sm" role="tablist" aria-label="Arrival or departure">
        {(['arrival', 'departure'] as const).map(k => {
          const active = k === leg
          return (
            <button
              key={k}
              role="tab"
              aria-selected={active}
              onClick={() => { setLeg(k); setSearch(''); setEditIdx(null) }}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-base font-bold transition-all active:scale-95 ${
                active ? (k === 'arrival' ? 'bg-ember-500 text-white shadow' : 'bg-marigold-400 text-bark-800 shadow') : 'bg-dusk-100 text-dusk-700 hover:bg-dusk-200'
              }`}
            >
              <span className="text-xl">{LEG_META[k].emoji}</span> {LEG_META[k].bubble}
            </button>
          )
        })}
      </div>

      <TripLogistics trip={trip} leg={leg} isAdmin={isAdmin} onSave={onSaveTrip} />

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm font-bold bg-white/95 rounded-2xl px-3.5 py-2.5 shadow-sm flex-wrap">
        <span className="flex items-center gap-1.5 text-dusk-800"><span className="w-3.5 h-3.5 rounded-full bg-pink-600" /> Sisters</span>
        <span className="flex items-center gap-1.5 text-dusk-800"><span className="w-3.5 h-3.5 rounded-full bg-dusk-600" /> Brothers</span>
        <span className="flex items-center gap-1.5 text-dusk-800"><span className="w-3.5 h-3.5 rounded-full bg-purple-600" /> Co-ed</span>
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dusk-400 text-lg">🔍</span>
        <input className={`${inputCls} pl-10`} placeholder="Find your car…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isAdmin && (
        <p className="text-sm text-dusk-700 bg-white/85 rounded-2xl px-3.5 py-2.5">
          You are editing the <span className="font-bold">{LEG_META[leg].bubble.toLowerCase()}</span> cars. Arrival and departure have separate arrangements, so changes here never affect the other. Tap <span className="font-bold">✏️ Edit</span> on a car to change just that one, or use ↑ / ↓ to reorder. Move a passenger to another car from inside the editor.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {shown.map(car => {
          const ci = cars.indexOf(car)
          const t = carTheme(car.type)
          return (
            <div key={ci} className={`rounded-3xl border-2 shadow-sm overflow-hidden ${t.card}`}>
              <div className={`${t.band} px-4 py-3 flex items-center justify-between gap-2`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  {car.type !== 'plain' && <GenderAvatar kind={car.type ?? 'coed'} className="w-11 h-11" />}
                  <h3 className="font-bold font-display text-white text-xl truncate">{car.name}</h3>
                </div>
                {t.label && <span className="bg-white/25 text-white text-sm font-bold px-2.5 py-0.5 rounded-full shrink-0">{t.label}</span>}
              </div>
              <div className="px-4 py-3 flex flex-wrap gap-2 items-center">
                {car.driver && (
                  <span className={`text-base px-3 py-1.5 rounded-full font-bold ring-2 ring-black/10 ${t.driverChip}`}>
                    🚗 {car.driver} · Driver
                  </span>
                )}
                {car.passengers.map((p, i) => (
                  <span
                    key={i}
                    className={`text-base px-3 py-1.5 rounded-full font-semibold ${
                      lower && p.toLowerCase().includes(lower) ? 'bg-marigold-400 text-bark-800' : t.chip
                    }`}
                  >
                    {p}
                  </span>
                ))}
                {car.passengers.length === 0 && !car.driver && <span className="text-base text-dusk-500">No one assigned yet</span>}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2 px-3 py-2.5 border-t border-black/5 bg-white/55">
                  <button onClick={() => setEditIdx(ci)} className={`${smallBtn} ${primaryBtn}`}>✏️ Edit</button>
                  {!filtering && (
                    <div className="ml-auto flex items-center gap-1.5">
                      <button onClick={() => moveCar(ci, -1)} disabled={ci === 0} className="h-10 w-10 grid place-items-center rounded-xl bg-dusk-100 text-dusk-800 hover:bg-dusk-200 disabled:opacity-30 text-xl font-bold active:scale-95" aria-label="Move car up">↑</button>
                      <button onClick={() => moveCar(ci, 1)} disabled={ci === cars.length - 1} className="h-10 w-10 grid place-items-center rounded-xl bg-dusk-100 text-dusk-800 hover:bg-dusk-200 disabled:opacity-30 text-xl font-bold active:scale-95" aria-label="Move car down">↓</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {lower && shown.length === 0 && (
        <div className="text-center py-12 text-dusk-700 bg-white/95 rounded-3xl shadow-sm">
          <p className="text-5xl mb-3">🔍</p>
          <p className="font-bold text-lg">Not found: "{search}"</p>
        </div>
      )}

      {editIdx !== null && (
        <CarCardEditor
          initial={editIdx === 'new' ? [...cars, blank] : cars}
          index={editIdx === 'new' ? cars.length : editIdx}
          onClose={() => setEditIdx(null)}
          onSave={saveCars}
        />
      )}
    </div>
  )
}

// Edits a single car so the admin focuses on one box at a time.
function CarCardEditor({ initial, index, onClose, onSave }: { initial: Car[]; index: number; onClose: () => void; onSave: (d: Car[]) => Promise<boolean> }) {
  const [draft, setDraft] = useState<Car[]>(() => clone(initial))
  const [saving, setSaving] = useState(false)
  const edit = (fn: (d: Car[]) => void) => setDraft(prev => { const d = clone(prev); fn(d); return d })
  const c = draft[index]
  if (!c) return null
  const others = draft
    .map((cc, idx) => ({ value: idx, label: cc.name || `Car ${idx + 1}` }))
    .filter(o => o.value !== index)

  async function removeCar() {
    if (!window.confirm('Delete this entire car?')) return
    setSaving(true)
    const d = clone(draft); d.splice(index, 1)
    const ok = await onSave(d); setSaving(false); if (ok) onClose()
  }

  return (
    <Modal title={`Edit ${c.name || `Car ${index + 1}`}`} onClose={onClose}>
      <div className="space-y-3">
        <input className={inputCls} placeholder="Car name" value={c.name} onChange={e => edit(d => { d[index].name = e.target.value })} />
        <select
          className={`${inputCls} bg-white`}
          value={c.type ?? 'coed'}
          onChange={e => edit(d => { d[index].type = e.target.value as CarType })}
        >
          <option value="sisters">Sisters (pink)</option>
          <option value="brothers">Brothers (blue)</option>
          <option value="coed">Co-ed (purple)</option>
          <option value="plain">Plain (no colour)</option>
        </select>

        {/* Driver */}
        <div className="space-y-2 pt-1">
          <p className="text-sm font-bold text-dusk-600">Driver</p>
          <div className="bg-marigold-50 rounded-2xl p-2 space-y-2 border border-marigold-300">
            <input
              className={`${inputCls} flex-1`}
              value={c.driver}
              placeholder="Driver name"
              onChange={e => edit(d => { d[index].driver = e.target.value })}
            />
            {c.driver.trim() !== '' && (
              <MoveToSelect
                label="Move driver to another car…"
                options={others}
                onMove={target => edit(d => {
                  if (!d[index].driver.trim()) return
                  d[target].passengers.push(d[index].driver.trim())
                  d[index].driver = ''
                })}
              />
            )}
          </div>
        </div>

        {/* Passengers */}
        <div className="space-y-2 pt-1">
          <p className="text-sm font-bold text-dusk-600">Passengers in this car</p>
          {c.passengers.map((p, pi) => (
            <div key={pi} className="bg-dusk-50 rounded-2xl p-2 space-y-2 border border-dusk-200">
              <div className="flex items-center gap-2">
                <input
                  className={`${inputCls} flex-1`}
                  value={p}
                  placeholder="Passenger name"
                  onChange={e => edit(d => { d[index].passengers[pi] = e.target.value })}
                />
                <RowTools
                  onUp={() => edit(d => moveItem(d[index].passengers, pi, -1))}
                  onDown={() => edit(d => moveItem(d[index].passengers, pi, 1))}
                  onDelete={() => edit(d => { d[index].passengers.splice(pi, 1) })}
                  disableUp={pi === 0}
                  disableDown={pi === c.passengers.length - 1}
                  deleteTitle="Remove passenger"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => edit(d => {
                    const car = d[index]
                    const [person] = car.passengers.splice(pi, 1)
                    if (car.driver.trim()) car.passengers.unshift(car.driver.trim())
                    car.driver = person
                  })}
                  className={`${smallBtn} bg-marigold-200 text-bark-800 hover:bg-marigold-300`}
                >
                  🚗 Make driver
                </button>
                <MoveToSelect
                  label="Move to another car…"
                  options={others}
                  onMove={target => edit(d => {
                    const [person] = d[index].passengers.splice(pi, 1)
                    d[target].passengers.push(person)
                  })}
                />
              </div>
            </div>
          ))}
          <AddPerson placeholder="Add a passenger…" onAdd={name => edit(d => { d[index].passengers.push(name) })} />
        </div>

        <button onClick={removeCar} disabled={saving} className={`${smallBtn} bg-red-100 text-red-700 hover:bg-red-200 w-full`}>🗑 Delete this car</button>
      </div>
      <SaveBar saving={saving} onCancel={onClose} onSave={async () => { setSaving(true); const ok = await onSave(draft); setSaving(false); if (ok) onClose() }} />
    </Modal>
  )
}

// ── Fragrance of Zion tab ─────────────────────────────────────────────────────
// Members see a submission form. Admins see the submitted fragrances instead,
// for review — submissions are private to admins and never editable by members.
function FragranceTab({ isAdmin, adminPin, onAuthFail }: { isAdmin: boolean; adminPin: string | null; onAuthFail: () => void }) {
  if (isAdmin) return <FragranceReview adminPin={adminPin} onAuthFail={onAuthFail} />
  return <FragranceForm />
}

function FragranceReview({ adminPin, onAuthFail }: { adminPin: string | null; onAuthFail: () => void }) {
  const [subs, setSubs] = useState<Submission[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    setSubs(null); setErr('')
    fetch(`/api/submissions?pin=${encodeURIComponent(adminPin ?? '')}`)
      .then(async r => {
        if (!r.ok) { if (r.status === 401) onAuthFail(); setErr('Session expired — please re-enter the admin PIN.'); return }
        setSubs(await r.json())
      })
      .catch(() => setErr('Could not load submissions'))
  }, [adminPin, onAuthFail])

  return (
    <div className="p-4 pb-32 space-y-4 animate-pop-in">
      <div>
        <h2 className="text-3xl font-bold font-display text-dusk-900">Fragrance Submissions</h2>
        <p className="text-dusk-700 text-base mt-1.5">Private to admins · {subs ? `${subs.length} received` : 'loading…'}</p>
      </div>

      {err && <p className="text-red-600 text-base font-semibold bg-white/95 rounded-2xl p-4">{err}</p>}
      {!err && subs === null && <p className="text-dusk-600 text-center py-12 text-lg">Loading…</p>}
      {subs && subs.length === 0 && (
        <div className="text-center py-12 text-dusk-700 bg-white/95 rounded-3xl shadow-sm">
          <p className="text-5xl mb-3">🌸</p>
          <p className="font-bold text-lg">No submissions yet</p>
        </div>
      )}
      {subs && subs.map(s => (
        <div key={s.id} className="bg-white border-2 border-dusk-200 rounded-3xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              {s.title && <p className="font-bold font-display text-dusk-900 text-xl leading-tight">{s.title}</p>}
              <p className={s.title ? 'text-dusk-600 text-base mt-0.5' : 'font-bold text-dusk-900 text-xl'}>by {s.name}</p>
            </div>
            <p className="text-dusk-600 text-sm whitespace-nowrap font-semibold">🕑 {formatDate(s.createdAt)}</p>
          </div>
          <p className="text-dusk-800 text-lg mt-3 whitespace-pre-wrap leading-relaxed">{s.body}</p>
        </div>
      ))}
    </div>
  )
}

function FragranceForm() {
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', title: '', summary: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.title.trim()) e.title = 'Title is required'
    if (!form.summary.trim()) e.summary = 'Summary is required'
    return e
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({}); setBusy(true)
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, title: form.title, body: form.summary }),
    })
    setBusy(false)
    if (res.ok) {
      setSubmitted(true)
      setForm({ name: '', title: '', summary: '' })
    } else {
      setErrors({ summary: 'Could not submit — please try again' })
    }
  }

  if (submitted) {
    return (
      <div className="p-6 pb-32 flex flex-col items-center justify-center min-h-[60vh] text-center animate-pop-in">
        <div className="text-6xl mb-4">🌸</div>
        <h2 className="text-3xl font-bold font-display text-ember-700 mb-2">Thank You!</h2>
        <p className="text-dusk-800 text-lg mb-2">Your fragrance has been received and saved for review.</p>
        <p className="text-ember-600 text-base font-bold">May your fragrance rise as a sweet offering before the Lord.</p>
        <button onClick={() => setSubmitted(false)} className="mt-8 text-base text-ember-700 font-bold underline">Submit another</button>
      </div>
    )
  }

  return (
    <div className="p-4 pb-32 animate-pop-in">
      <div className="mb-5">
        <h2 className="text-3xl font-bold font-display text-dusk-900">Fragrance of Zion</h2>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-base font-bold text-dusk-800 mb-1.5">Your Name</label>
          <input className={`${inputCls} ${errors.name ? 'border-red-400' : ''}`} placeholder="Full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          {errors.name && <p className="text-red-600 text-sm mt-1 font-semibold">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-base font-bold text-dusk-800 mb-1.5">Title of Fragrance</label>
          <input className={`${inputCls} ${errors.title ? 'border-red-400' : ''}`} placeholder="Give your fragrance a title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          {errors.title && <p className="text-red-600 text-sm mt-1 font-semibold">{errors.title}</p>}
        </div>

        <div>
          <label className="block text-base font-bold text-dusk-800 mb-1.5">Summary</label>
          <textarea className={`${inputCls} h-48 resize-y ${errors.summary ? 'border-red-400' : ''}`} placeholder="Share with us your beautiful fragrance..." value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} />
          {errors.summary && <p className="text-red-600 text-sm mt-1 font-semibold">{errors.summary}</p>}
        </div>

        <button type="submit" disabled={busy} className="w-full bg-ember-500 hover:bg-ember-600 text-white font-bold py-4 rounded-2xl text-lg transition-colors active:scale-[0.98] disabled:opacity-60">
          {busy ? 'Submitting…' : 'Submit ✨'}
        </button>
      </form>
    </div>
  )
}

// ── Admin panel ───────────────────────────────────────────────────────────────
type AdminMode = 'login' | 'changepin'

function AdminPanel({ mode, setAdminPin, onClose }: { mode: AdminMode; setAdminPin: (p: string | null) => void; onClose: () => void }) {
  // login
  const [pinInput, setPinInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [verifying, setVerifying] = useState(false)

  async function verify() {
    setVerifying(true); setLoginError('')
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', pin: pinInput }),
    })
    const data = await res.json().catch(() => ({ ok: false }))
    setVerifying(false)
    if (data.ok) { setAdminPin(pinInput); onClose() }
    else { setLoginError('Incorrect admin PIN'); setPinInput('') }
  }

  // change pin
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [confirm, setConfirm] = useState('')
  const [pinMsg, setPinMsg] = useState(''); const [pinErr, setPinErr] = useState(''); const [changing, setChanging] = useState(false)

  async function changePin() {
    setPinErr(''); setPinMsg('')
    if (next !== confirm) { setPinErr('New PIN entries do not match'); return }
    setChanging(true)
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change', currentPin: cur, newPin: next }),
    })
    const data = await res.json().catch(() => ({}))
    setChanging(false)
    if (res.ok) {
      setAdminPin(next)
      setPinMsg('Admin PIN updated.')
      setCur(''); setNext(''); setConfirm('')
      setTimeout(() => onClose(), 900)
    } else {
      setPinErr(data.error || 'Could not change PIN')
    }
  }

  const title = mode === 'login' ? 'Admin Login' : 'Change Admin PIN'

  return (
    <Modal title={title} onClose={onClose}>
      {mode === 'login' && (
        <div className="space-y-3">
          <p className="text-base text-dusk-800 leading-relaxed">Enter the admin PIN to edit the schedule, rooms, and carpool, post announcements, and review fragrance submissions on the Fragrance tab.</p>
          <input
            className={inputCls}
            type="password"
            inputMode="numeric"
            placeholder="Admin PIN"
            value={pinInput}
            onChange={e => setPinInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') verify() }}
            autoFocus
          />
          {loginError && <p className="text-red-600 text-base font-semibold">{loginError}</p>}
          <button onClick={verify} disabled={verifying || !pinInput} className="w-full bg-ember-500 hover:bg-ember-600 text-white font-bold py-3.5 rounded-2xl text-base disabled:opacity-60">
            {verifying ? 'Checking…' : 'Unlock Admin'}
          </button>
        </div>
      )}

      {mode === 'changepin' && (
        <div className="space-y-3">
          <p className="text-base text-dusk-800 leading-relaxed">The admin PIN must be 4–8 digits and cannot be the same as the member login passcode. Only an admin can change it.</p>
          <input className={inputCls} type="password" inputMode="numeric" placeholder="Current PIN" value={cur} onChange={e => setCur(e.target.value)} />
          <input className={inputCls} type="password" inputMode="numeric" placeholder="New PIN" value={next} onChange={e => setNext(e.target.value)} />
          <input className={inputCls} type="password" inputMode="numeric" placeholder="Confirm new PIN" value={confirm} onChange={e => setConfirm(e.target.value)} />
          {pinErr && <p className="text-red-600 text-base font-semibold">{pinErr}</p>}
          {pinMsg && <p className="text-green-700 text-base font-semibold">{pinMsg}</p>}
          <button onClick={changePin} disabled={changing || !cur || !next || !confirm} className="w-full bg-ember-500 hover:bg-ember-600 text-white font-bold py-3.5 rounded-2xl text-base disabled:opacity-60">
            {changing ? 'Saving…' : 'Update PIN'}
          </button>
        </div>
      )}
    </Modal>
  )
}

function Loading() {
  return <div className="p-4 pb-32"><div className="text-center py-16 text-dusk-600 text-lg">Loading…</div></div>
}

// ── Install / Add to Home Screen prompt ────────────────────────────────────────
// Helps members turn the web app into a real home-screen icon so it opens
// full-screen like a native app. The two phones differ:
//   • Android Chrome fires a `beforeinstallprompt` event the app can trigger on
//     demand, so the button installs in one tap.
//   • iPhone / iPad Safari exposes no install API at all, so those visitors get
//     the standard "Share → Add to Home Screen" walkthrough instead.
// The card hides itself once the app is installed (opened from the home screen)
// or the member dismisses it for the session.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type DevicePlatform = 'ios' | 'android' | 'other'

function detectPlatform(): DevicePlatform {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent || ''
  // iPadOS 13+ reports itself as a Mac, so also treat a touch-capable "Mac" as iOS.
  const iOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (iOS) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'other'
}

function appIsInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || (navigator as { standalone?: boolean }).standalone === true
}

// The Safari "Share" glyph, so the iPhone steps can point at the exact button.
function ShareIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 h-7 w-7 grid place-items-center rounded-full bg-ember-500 text-white font-bold text-sm">{n}</span>
      <span className="text-dusk-800 text-base leading-snug pt-0.5">{children}</span>
    </li>
  )
}

function InstallSteps({ platform }: { platform: DevicePlatform }) {
  if (platform === 'android') {
    return (
      <div className="space-y-3">
        <ol className="space-y-3">
          <Step n={1}>Tap the <span className="font-bold">⋮ menu</span> in the top-right corner of Chrome.</Step>
          <Step n={2}>Tap <span className="font-bold">Install app</span> (on some phones it reads <span className="font-bold">Add to Home screen</span>).</Step>
          <Step n={3}>Tap <span className="font-bold">Install</span> to confirm — the camp icon lands on your home screen.</Step>
        </ol>
        <p className="text-dusk-500 text-sm leading-snug">Tip: this works best in Google Chrome. If you opened the link inside another app, tap ⋮ → <span className="font-semibold">Open in Chrome</span> first.</p>
      </div>
    )
  }
  // iPhone / iPad (and the generic fallback).
  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        <Step n={1}>
          In <span className="font-bold">Safari</span>, tap the <span className="font-bold">Share</span> button
          <span className="inline-flex items-center justify-center align-middle mx-1 h-6 w-6 rounded-md bg-dusk-100 text-dusk-700"><ShareIcon /></span>
          at the bottom of the screen.
        </Step>
        <Step n={2}>Scroll down and tap <span className="font-bold">Add to Home Screen</span>.</Step>
        <Step n={3}>Tap <span className="font-bold">Add</span> in the top-right — the camp icon appears on your home screen.</Step>
      </ol>
      <p className="text-dusk-500 text-sm leading-snug">Tip: on iPhone this must be done in <span className="font-semibold">Safari</span>. Chrome and in-app browsers don't offer "Add to Home Screen".</p>
    </div>
  )
}

function InstallHowModal({ platform, onClose }: { platform: DevicePlatform; onClose: () => void }) {
  // Default to the visitor's own device, but let them flip to the other set of
  // steps — handy when helping someone next to them with a different phone.
  const [view, setView] = useState<DevicePlatform>(platform === 'android' ? 'android' : 'ios')
  return (
    <Modal title="Add to Home Screen" onClose={onClose}>
      <p className="text-dusk-700 text-base mb-4 leading-relaxed">
        Installing puts a camp icon right on your phone. It opens full-screen like a normal app — no address bar, and it's one tap to get back in.
      </p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {(['ios', 'android'] as const).map(p => (
          <button
            key={p}
            onClick={() => setView(p)}
            className={`py-2.5 rounded-2xl text-base font-bold transition-all active:scale-95 ${
              view === p ? 'bg-ember-500 text-white shadow' : 'bg-dusk-100 text-dusk-700 hover:bg-dusk-200'
            }`}
          >
            {p === 'ios' ? '🍎 iPhone / iPad' : '🤖 Android'}
          </button>
        ))}
      </div>
      <InstallSteps platform={view} />
      <button onClick={onClose} className="mt-5 w-full bg-dusk-100 hover:bg-dusk-200 text-dusk-800 font-bold py-3 rounded-2xl text-base transition-colors">
        Got it
      </button>
    </Modal>
  )
}

function InstallPrompt() {
  const platform = useRef(detectPlatform()).current
  const [installed, setInstalled] = useState(() => appIsInstalled())
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem('foz-install-dismissed') === '1' } catch { return false }
  })
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showHow, setShowHow] = useState(false)

  useEffect(() => {
    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent) }
    const onInstalled = () => { setInstalled(true); setShowHow(false) }
    window.addEventListener('beforeinstallprompt', onBIP)
    window.addEventListener('appinstalled', onInstalled)
    const mq = window.matchMedia?.('(display-mode: standalone)')
    const onMq = () => setInstalled(appIsInstalled())
    mq?.addEventListener?.('change', onMq)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
      mq?.removeEventListener?.('change', onMq)
    }
  }, [])

  function dismiss() {
    setDismissed(true)
    try { sessionStorage.setItem('foz-install-dismissed', '1') } catch { /* ignore */ }
  }

  async function handlePrimary() {
    // Android: fire the browser's real install prompt if it's available.
    if (deferred) {
      await deferred.prompt()
      const choice = await deferred.userChoice.catch(() => null)
      setDeferred(null)
      if (choice?.outcome === 'accepted') dismiss()
      return
    }
    // iPhone, or Android before the event arrives: show the manual steps.
    setShowHow(true)
  }

  // Only nudge where there's a real path to install: iOS Safari, or any browser
  // that has offered us a native prompt. Hidden once installed or dismissed.
  const applicable = platform === 'ios' || deferred != null
  if (installed || (dismissed && !showHow) || (!applicable && !showHow)) {
    return showHow ? <InstallHowModal platform={platform} onClose={() => setShowHow(false)} /> : null
  }

  const label = deferred ? '📲 Install' : platform === 'ios' ? 'Show me how' : 'How to install'

  return (
    <>
      {!dismissed && applicable && (
        <div className="max-w-2xl mx-auto w-full px-4 pt-3 animate-pop-in">
          <div className="relative rounded-3xl bg-gradient-to-br from-ember-500 to-marigold-400 p-[2px] shadow-md">
            <div className="rounded-[1.35rem] bg-white px-3.5 py-3 flex items-center gap-3">
              <div className="shrink-0 h-12 w-12 rounded-2xl bg-ember-50 grid place-items-center text-2xl" aria-hidden>📲</div>
              <div className="min-w-0 flex-1">
                <p className="font-bold font-display text-dusk-900 text-base leading-tight">Install the camp app</p>
                <p className="text-dusk-600 text-sm leading-snug mt-0.5">
                  {platform === 'ios'
                    ? 'Add it to your iPhone home screen for one-tap access.'
                    : platform === 'android'
                    ? 'Add it to your Android home screen for one-tap access.'
                    : 'Add it to your home screen for one-tap access.'}
                </p>
              </div>
              <button onClick={handlePrimary} className={`${smallBtn} ${primaryBtn} shrink-0`}>{label}</button>
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss install prompt"
              className="absolute -top-2 -right-2 h-7 w-7 grid place-items-center rounded-full bg-bark-800 text-white text-sm leading-none shadow-md active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {showHow && <InstallHowModal platform={platform} onClose={() => setShowHow(false)} />}
    </>
  )
}

// ── Lodging map ───────────────────────────────────────────────────────────────
const LODGING_MAP_IMG = '/lodging-map.png'

// Fullscreen pinch-to-zoom + pan viewer for the lodge floor-plan. Built on
// pointer events so the same gestures work for touch, trackpad and mouse: one
// finger pans, two fingers pinch-zoom around their midpoint, a double-tap (or
// double-click) toggles zoom, and the mouse wheel zooms toward the cursor. The
// on-screen +/−/reset controls cover devices without a multi-touch screen.
// Rendered through a portal so it always fills the viewport above the app.
function MapZoomViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const MIN = 1
  const MAX = 6
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  // Refs mirror the live transform so rapid events (wheel, pinch) always read
  // the current value rather than a render-stale closure.
  const scaleRef = useRef(1)
  const txRef = useRef(0)
  const tyRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  // Active pointers by id, holding their latest client coordinates.
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchStart = useRef<{ dist: number; scale: number; mid: { x: number; y: number }; tx: number; ty: number } | null>(null)
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const lastTap = useRef(0)
  // Tracks the current single-touch interaction so we only treat a clean,
  // stationary, single-finger press (or single mouse click) as a tap. Without
  // this, lifting the two fingers of a pinch — or releasing a pan-drag — was
  // misread as a double-tap and fired an unwanted zoom toggle.
  const tapInfo = useRef<{ x: number; y: number; t: number; moved: boolean; multi: boolean } | null>(null)

  // Lock background scroll while the viewer is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Close on Escape for keyboard / desktop users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

  const center = () => {
    const r = containerRef.current?.getBoundingClientRect()
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 }
  }

  // Bound the translation so the image edges can never be dragged fully past the
  // centre of the viewport — derived from the image's laid-out (pre-transform)
  // size so it stays correct for a tall, portrait floor-plan.
  const clampPan = useCallback((nx: number, ny: number, s: number) => {
    const el = containerRef.current
    const img = imgRef.current
    if (!el || !img) return { x: nx, y: ny }
    const maxX = Math.max(0, (img.offsetWidth * s - el.clientWidth) / 2)
    const maxY = Math.max(0, (img.offsetHeight * s - el.clientHeight) / 2)
    return { x: clamp(nx, -maxX, maxX), y: clamp(ny, -maxY, maxY) }
  }, [])

  // Commit a new transform to both the refs and React state in one place.
  const apply = useCallback((s: number, x: number, y: number) => {
    scaleRef.current = s; txRef.current = x; tyRef.current = y
    setScale(s); setTx(x); setTy(y)
  }, [])

  // Apply a new scale while keeping the image point under `pivotClient` fixed —
  // the heart of pinch-zoom, wheel-zoom and double-tap.
  const zoomAround = useCallback((nextScale: number, pivotClient: { x: number; y: number }) => {
    const c = center()
    const pivot = { x: pivotClient.x - c.x, y: pivotClient.y - c.y }
    const ns = clamp(nextScale, MIN, MAX)
    if (ns === 1) { apply(1, 0, 0); return }
    const q = { x: (pivot.x - txRef.current) / scaleRef.current, y: (pivot.y - tyRef.current) / scaleRef.current }
    const cl = clampPan(pivot.x - ns * q.x, pivot.y - ns * q.y, ns)
    apply(ns, cl.x, cl.y)
  }, [apply, clampPan])

  // Wheel / trackpad zoom is registered natively as a non-passive listener so
  // preventDefault() actually stops the page from scrolling or page-zooming
  // underneath the viewer — React's synthetic onWheel is passive and can't.
  // This is what makes zooming feel right on a laptop or desktop.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      zoomAround(scaleRef.current * factor, { x: e.clientX, y: e.clientY })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAround])

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      panStart.current = { x: e.clientX, y: e.clientY, tx: txRef.current, ty: tyRef.current }
      tapInfo.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, moved: false, multi: false }
    } else if (pointers.current.size === 2) {
      panStart.current = null
      pinchStart.current = null // re-initialised on first move with both points
      if (tapInfo.current) tapInfo.current.multi = true // a pinch is never a tap
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    // Any real movement disqualifies this interaction from counting as a tap.
    if (tapInfo.current && !tapInfo.current.moved &&
        Math.hypot(e.clientX - tapInfo.current.x, e.clientY - tapInfo.current.y) > 10) {
      tapInfo.current.moved = true
    }
    const pts = [...pointers.current.values()]

    if (pts.length >= 2) {
      const [a, b] = pts
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const midClient = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const c = center()
      const mid = { x: midClient.x - c.x, y: midClient.y - c.y }
      if (!pinchStart.current) {
        pinchStart.current = { dist, scale: scaleRef.current, mid, tx: txRef.current, ty: tyRef.current }
        return
      }
      const ps = pinchStart.current
      const ns = clamp(ps.scale * (dist / ps.dist), MIN, MAX)
      const q = { x: (ps.mid.x - ps.tx) / ps.scale, y: (ps.mid.y - ps.ty) / ps.scale }
      const raw = ns === 1 ? { x: 0, y: 0 } : { x: mid.x - ns * q.x, y: mid.y - ns * q.y }
      const cl = clampPan(raw.x, raw.y, ns)
      apply(ns, cl.x, cl.y)
    } else if (panStart.current && scaleRef.current > 1) {
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      const cl = clampPan(panStart.current.tx + dx, panStart.current.ty + dy, scaleRef.current)
      apply(scaleRef.current, cl.x, cl.y)
    }
  }

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()]
      panStart.current = { x: p.x, y: p.y, tx: txRef.current, ty: tyRef.current }
    } else if (pointers.current.size === 0) {
      panStart.current = null
    }
  }

  // A double-tap / double-click toggles between fit and 3× at the tap point —
  // but only when the gesture was a genuine stationary single press, so the end
  // of a pinch or a pan-drag can no longer trigger an accidental zoom.
  const onPointerUp = (e: React.PointerEvent) => {
    const ti = tapInfo.current
    endPointer(e)
    if (pointers.current.size !== 0) return // wait until the last finger lifts
    tapInfo.current = null
    const wasTap = !!ti && !ti.moved && !ti.multi && e.timeStamp - ti.t < 300
    if (!wasTap) { lastTap.current = 0; return }
    if (e.timeStamp - lastTap.current < 300) {
      zoomAround(scaleRef.current > 1 ? 1 : 3, { x: e.clientX, y: e.clientY })
      lastTap.current = 0 // consume, so a third tap starts fresh
    } else {
      lastTap.current = e.timeStamp
    }
  }

  const zoomButton = (dir: 1 | -1) => {
    const c = center()
    zoomAround(scaleRef.current * (dir === 1 ? 1.4 : 1 / 1.4), c)
  }

  const reset = () => apply(1, 0, 0)

  const ctrlBtn = 'h-12 w-12 grid place-items-center rounded-full bg-white/95 text-dusk-900 text-2xl font-bold shadow-lg ring-1 ring-black/10 active:scale-95 disabled:opacity-40 transition-transform'

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-bark-800/95 flex flex-col select-none animate-pop-in">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-white">
        <p className="font-bold font-display text-lg drop-shadow">Aspenbrook Lodge map</p>
        <button onClick={onClose} aria-label="Close map" className="h-11 w-11 grid place-items-center rounded-full bg-white/15 hover:bg-white/25 text-2xl leading-none transition-colors active:scale-95">✕</button>
      </div>

      {/* Zoom surface */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden touch-none grid place-items-center"
        style={{ touchAction: 'none', cursor: scale > 1 ? 'grab' : 'auto' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={endPointer}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-full max-h-full object-contain will-change-transform"
          style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: 'center center' }}
        />
      </div>

      {/* Controls + hint */}
      <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 flex flex-col items-center gap-3">
        <p className="text-white/80 text-sm font-semibold text-center">Pinch or double-tap to zoom · drag to move</p>
        <div className="flex items-center gap-3">
          <button onClick={() => zoomButton(-1)} disabled={scale <= MIN} className={ctrlBtn} aria-label="Zoom out">−</button>
          <button onClick={reset} disabled={scale === 1 && tx === 0 && ty === 0} className="h-12 px-5 grid place-items-center rounded-full bg-white/95 text-dusk-900 text-sm font-bold shadow-lg ring-1 ring-black/10 active:scale-95 disabled:opacity-40 transition-transform" aria-label="Reset zoom">Reset</button>
          <button onClick={() => zoomButton(1)} disabled={scale >= MAX} className={ctrlBtn} aria-label="Zoom in">+</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// The Lodging tab: an intro, the tappable floor-plan that opens the zoom viewer,
// and a short "good to know" card transcribing the most useful practical notes
// from the map (which are otherwise only legible once zoomed in). Room numbers
// and the full floor layout live in the image itself.
function LodgingTab() {
  const [open, setOpen] = useState(false)
  return (
    <div className="p-4 pb-32 space-y-4 animate-pop-in">
      <div>
        <h2 className="text-3xl font-bold font-display text-dusk-900">Lodging</h2>
        <p className="text-dusk-700 text-base mt-1.5">Aspenbrook Lodge at Snow Mountain Ranch — tap the map to zoom in on your floor and room.</p>
      </div>

      {/* Tappable floor-plan */}
      <button
        onClick={() => setOpen(true)}
        className="group relative block w-full rounded-3xl overflow-hidden bg-white shadow-sm ring-1 ring-black/5 active:scale-[0.99] transition-transform"
        aria-label="Open the lodge map to zoom in"
      >
        <img
          src={cdn(LODGING_MAP_IMG, 900)}
          alt="Aspenbrook Lodge floor plan — three floors of room numbers, stairs, exits, meeting rooms and lobby"
          loading="lazy"
          decoding="async"
          className="w-full block"
        />
        <span className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-bark-800/80 text-white text-sm font-bold px-3.5 py-2 rounded-full shadow-lg backdrop-blur-sm">
          🔍 Tap to zoom
        </span>
      </button>

      {/* Good to know */}
      <div className="bg-white/95 rounded-3xl p-5 shadow-sm space-y-3">
        <h3 className="text-lg font-bold font-display text-dusk-900">Good to know</h3>
        <ul className="space-y-2.5 text-dusk-800 text-base">
          <li className="flex gap-2.5"><span aria-hidden>🛏️</span><span>47 rooms over three floors — <strong>no elevators</strong>. Rooms sleep up to six (two queen beds + a bunk set); accessible rooms sleep four.</span></li>
          <li className="flex gap-2.5"><span aria-hidden>🧼</span><span>Sheets, blankets, pillows and towels are provided. Bar soap is provided, but <strong>bring your own shampoo, conditioner, shower gel and moisturizer</strong>.</span></li>
          <li className="flex gap-2.5"><span aria-hidden>☕</span><span>Each room has a half-bath, hair-dryer, desk, microwave and mini-fridge. A coffee station, ice and vending machines are in the common area.</span></li>
          <li className="flex gap-2.5"><span aria-hidden>🤫</span><span>Quiet hours are <strong>10pm – 7am</strong>; courtesy hours are in place 24 hours a day. Pets are not permitted in this lodge.</span></li>
          <li className="flex gap-2.5"><span aria-hidden>🚶</span><span>The lodge is about ½ mile from the Administration Building, with lighted walkways to the Pool, KIVA, Buckboard Grill and Administration Building.</span></li>
        </ul>
      </div>

      {open && (
        <MapZoomViewer
          src={cdn(LODGING_MAP_IMG, 1600)}
          alt="Aspenbrook Lodge floor plan — three floors of room numbers, stairs, exits, meeting rooms and lobby"
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string }[] = [
  { id: 'weather',       label: 'Weather' },
  { id: 'announcements', label: 'News' },
  { id: 'schedule',      label: 'Schedule' },
  { id: 'rooms',         label: 'Rooms' },
  { id: 'lodging',       label: 'Lodging Map' },
  { id: 'carpool',       label: 'Carpool' },
  { id: 'fragrance',     label: 'Fragrance' },
]

function MainApp() {
  const [tab, setTab] = useState<Tab>('announcements')
  const [content, setContent] = useState<Content | null>(null)
  const [adminPin, setAdminPinState] = useState<string | null>(null)
  const [adminModal, setAdminModal] = useState<AdminMode | null>(null)

  useEffect(() => {
    setAdminPinState(sessionStorage.getItem('foz-admin-pin'))
  }, [])

  const setAdminPin = useCallback((pin: string | null) => {
    if (pin) sessionStorage.setItem('foz-admin-pin', pin)
    else sessionStorage.removeItem('foz-admin-pin')
    setAdminPinState(pin)
  }, [])

  const loadContent = useCallback(async (fresh = false) => {
    const res = await fetch(fresh ? `/api/content?t=${Date.now()}` : '/api/content')
    setContent(await res.json())
  }, [])

  useEffect(() => { loadContent() }, [loadContent])

  const isAdmin = !!adminPin

  const saveSection = useCallback(async (section: 'schedule' | 'rooms' | 'carpool' | 'trip', data: unknown): Promise<boolean> => {
    const res = await fetch('/api/content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, data, pin: adminPin }),
    })
    if (res.ok) { await loadContent(true); return true }
    if (res.status === 401) {
      setAdminPin(null)
      window.alert('Admin session expired. Please re-enter the admin PIN.')
    } else {
      window.alert('Could not save changes. Please try again.')
    }
    return false
  }, [adminPin, loadContent, setAdminPin])

  const onAuthFail = useCallback(() => {
    setAdminPin(null)
    window.alert('Admin session expired. Please re-enter the admin PIN.')
  }, [setAdminPin])

  return (
    <div className="min-h-screen flex flex-col app-bg">
      {/* Admin bar — sits above the banner so it never covers the artwork */}
      <div className="bg-bark-800 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto w-full px-3 py-2.5 flex items-center justify-end gap-2 flex-wrap">
          {!isAdmin ? (
            <button
              onClick={() => setAdminModal('login')}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-sm font-bold px-4 py-2 rounded-full transition-colors active:scale-95"
            >
              🔑 Admin
            </button>
          ) : (
            <>
              <span className="mr-auto flex items-center gap-1.5 text-marigold-300 text-sm font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-marigold-400 animate-pulse" /> Admin mode
              </span>
              <button onClick={() => setAdminModal('changepin')} className="bg-white/15 hover:bg-white/25 text-white text-sm font-bold px-3.5 py-2 rounded-full transition-colors active:scale-95">🔐 PIN</button>
              <button onClick={() => setAdminPin(null)} className="bg-marigold-400 hover:bg-marigold-300 text-bark-800 text-sm font-bold px-3.5 py-2 rounded-full transition-colors active:scale-95" title="Exit admin mode">✕ Exit Admin</button>
            </>
          )}
        </div>
      </div>

      {/* App banner — the large camp banner is back on every tab; the emblem
          logo sits at its top-right corner within the artwork. */}
      <header className="max-w-2xl mx-auto w-full px-4 pt-3">
        <img
          src={cdn(BANNER_IMG, 1024)}
          alt="ISBA Summer Camp 2026 — West Central Region — Realizing our hope in the future of the gospel"
          decoding="async"
          fetchPriority="high"
          className="w-full block rounded-3xl shadow-md ring-1 ring-black/5"
        />
      </header>

      {/* One-time nudge showing members how to install the app to their phone */}
      <InstallPrompt />

      {/* Tab content */}
      <div className="flex-1 max-w-2xl mx-auto w-full">
        {tab === 'weather'       && <WeatherTab />}
        {tab === 'announcements' && <AnnouncementsTab isAdmin={isAdmin} adminPin={adminPin} onAuthFail={onAuthFail} />}
        {tab === 'schedule'      && <ScheduleTab days={content?.schedule ?? null} isAdmin={isAdmin} onSave={d => saveSection('schedule', d)} />}
        {tab === 'rooms'         && <RoomsTab rooms={content?.rooms ?? null} isAdmin={isAdmin} onSave={d => saveSection('rooms', d)} />}
        {tab === 'lodging'       && <LodgingTab />}
        {tab === 'carpool'       && <CarpoolTab carpool={content?.carpool ?? null} trip={content?.trip ?? null} isAdmin={isAdmin} onSave={d => saveSection('carpool', d)} onSaveTrip={t => saveSection('trip', t)} />}
        {tab === 'fragrance'     && <FragranceTab isAdmin={isAdmin} adminPin={adminPin} onAuthFail={onAuthFail} />}
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-dusk-100 z-40 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(31,43,55,0.08)]">
        <div className="max-w-2xl mx-auto flex">
          {TABS.map(t => {
            const active = t.id === tab
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-label={t.label}
                aria-current={active ? 'page' : undefined}
                className={`relative flex-1 flex flex-col items-center gap-1 py-3 px-1 transition-colors ${
                  active ? 'text-ember-600' : 'text-dusk-400 hover:text-dusk-700'
                }`}
              >
                {t.id === 'fragrance'
                  ? <span className="text-2xl leading-none" aria-hidden>🌸</span>
                  : <Icon name={t.id} className="w-6 h-6" />}
                <span className="text-xs font-bold leading-none">{t.label}</span>
                {active && <div className="absolute bottom-0 h-1 w-9 bg-ember-500 rounded-full" />}
              </button>
            )
          })}
        </div>
      </nav>

      <HelpBanner />

      {adminModal && (
        <AdminPanel
          mode={adminModal}
          setAdminPin={setAdminPin}
          onClose={() => setAdminModal(null)}
        />
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
function App() {
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('foz-unlocked') === '1') setUnlocked(true)
  }, [])

  // Register the service worker so the app can be installed to the home screen
  // (and loads faster on repeat visits). Failures are non-fatal — the app works
  // exactly the same without it.
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* ignore */ })
    }
  }, [])

  function unlock() {
    sessionStorage.setItem('foz-unlocked', '1')
    setUnlocked(true)
  }

  if (!unlocked) return <PasscodeScreen onUnlock={unlock} />
  return <MainApp />
}

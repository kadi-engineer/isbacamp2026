// Default content seeded into the `settings` table on first read.
// Admins can edit all of this in the app; the database is the source of truth
// once seeded, so edits persist across deploys and project renames.

// ── Camp schedule (June 21–25, 2026) ─────────────────────────────────────────
// Transcribed from the official ISBA Summer Camp Schedule 2026. Admins can edit
// every day and event in the app under Schedule.
export const DEFAULT_SCHEDULE = [
  {
    label: 'Sun',
    date: 'Sunday, June 21',
    events: [
      { time: '7:00 AM', title: 'WCR Arrival to 1st Denver', note: 'West Central Region arrives' },
      { time: '5:00 PM', title: 'Dinner', note: '1 hour' },
      { time: '6:00 PM', title: 'Orientation', note: 'P. Jorge · 1 hour' },
      { time: '7:00 PM', title: 'Depart to YMCA of the Rockies', note: '1 hr 30 min' },
      { time: '9:00 PM', title: 'Go to Lodging', note: '' },
    ],
  },
  {
    label: 'Mon',
    date: 'Monday, June 22',
    events: [
      { time: '7:00 AM', title: 'Wake Up & Get Ready', note: '' },
      { time: '7:45 AM', title: 'Breakfast', note: 'Until 8:45 AM' },
      { time: '8:55 AM', title: 'Prayer Time & New Song', note: 'Prayer: M. Jeff' },
      { time: '9:00 AM', title: 'Education #1', note: 'Educator: P. Jorge · 9:00–10:15 AM' },
      { time: '10:15 AM', title: 'Break', note: '15 min' },
      { time: '10:30 AM', title: 'Habits, the Power to Change Myself', note: 'Educator: P. Dean · 10:30–11:45 AM' },
      { time: '11:45 AM', title: 'Lunch', note: 'Until 12:45 PM' },
      { time: '1:00 PM', title: "God's Word", note: 'Educator: E. Glenn · 1:00–2:15 PM' },
      { time: '2:15 PM', title: 'Break', note: '40 min · 2:55 PM New Song / Prayer: M. Uriel' },
      { time: '3:00 PM', title: 'Laughter, a Gift of God', note: 'Educator: E. Anthony · 3:00–4:15 PM' },
      { time: '4:30 PM', title: 'Truth Book Test', note: 'The Mystery of God & the Spring of the Water of Life, Chap 25–35 · M. Casey · 4:30–5:30 PM' },
      { time: '5:30 PM', title: 'Break / Change into Sports Attire', note: '30 min' },
      { time: '6:00 PM', title: 'Dinner / Go to Softball Field', note: '1 hour' },
      { time: '7:00 PM', title: 'Kickball & Star Gazing', note: 'M. Uriel, E. Glenn · 2 hours' },
      { time: '9:00 PM', title: 'Go to Lodging', note: '' },
    ],
  },
  {
    label: 'Tue',
    date: 'Tuesday, June 23',
    events: [
      { time: '7:00 AM', title: 'Wake Up & Get Ready', note: '' },
      { time: '7:45 AM', title: 'Breakfast', note: 'Until 8:45 AM' },
      { time: '8:55 AM', title: 'Prayer Time & New Song', note: 'Prayer: E. Glenn' },
      { time: '9:00 AM', title: 'The Glory We Will Enjoy in Heaven', note: 'Educator: M. Casey · 9:00–10:15 AM' },
      { time: '10:15 AM', title: 'Break', note: '15 min' },
      { time: '10:30 AM', title: 'Prophecies of Daniel & Revelation and the Mystery of God', note: 'Educator: M. Jeff · 10:30–11:45 AM' },
      { time: '11:45 AM', title: 'Lunch', note: 'Until 12:45 PM' },
      { time: '1:00 PM', title: 'Vision of the Gospel Worker', note: 'Educator: M. Uriel · 1:00–2:15 PM' },
      { time: '2:15 PM', title: 'Break', note: '40 min · 2:55 PM New Song / Prayer: M. Uriel' },
      { time: '3:00 PM', title: 'Team Building Activities', note: 'M. Casey, M. Jeff · 3:00–4:30 PM' },
      { time: '4:30 PM', title: 'Break', note: '30 min' },
      { time: '5:00 PM', title: 'Dinner', note: '1 hour' },
      { time: '6:00 PM', title: 'Go to Lodging & Prepare for Service', note: '' },
      { time: '7:00 PM', title: 'Third Day Worship', note: 'P. Jorge Correa · Announcer: M. Uriel · Closing Prayer: P. Dean' },
      { time: '9:00 PM', title: 'Announce Winners for Written Test', note: 'M. Uriel · 1 hour' },
      { time: '10:00 PM', title: 'Go to Lodging', note: '' },
    ],
  },
  {
    label: 'Wed',
    date: 'Wednesday, June 24',
    events: [
      { time: '7:00 AM', title: 'Wake Up & Get Ready', note: '' },
      { time: '7:45 AM', title: 'Breakfast', note: 'Until 8:45 AM' },
      { time: '8:55 AM', title: 'Prayer Time & New Song', note: 'Prayer: M. Casey' },
      { time: '9:00 AM', title: 'Outdoor Activities', note: '2 hr 45 min' },
      { time: '1:00 PM', title: 'Hiking', note: '4 hours' },
      { time: '4:00 PM', title: 'Sports', note: 'Football: M. Jeff · Soccer: M. Uriel · Basketball: E. Anthony · 2 hours' },
      { time: '6:00 PM', title: 'Dinner', note: '1 hour' },
      { time: '7:00 PM', title: 'Outdoor Activities', note: '1 hour' },
      { time: '8:00 PM', title: 'Fragrance of Zion', note: 'M. Jeff · 1 hour' },
      { time: '9:00 PM', title: 'Go to Lodging', note: '' },
    ],
  },
  {
    label: 'Thu',
    date: 'Thursday, June 25',
    events: [
      { time: '7:00 AM', title: 'Wake Up & Get Ready', note: '' },
      { time: '7:45 AM', title: 'Breakfast to Go', note: '' },
      { time: 'Morning', title: 'Depart to Respective Zions', note: 'Safe travels home!' },
    ],
  },
];

// ── Room arrangements ────────────────────────────────────────────────────────
// Transcribed from the official ISBA 2026 Room Assignments sheet. Each group is
// colour-coded by gender — `sisters` shows pink, `brothers` shows blue. For the
// member groups the first person listed is that group's chaperone
// (`chaperone: true`); the overseer groups have no in-group chaperone
// (`chaperone: false`). Edit any of this in the app under Room Arrangements.
export const DEFAULT_ROOMS = [
  { room: '1', gender: 'sisters', chaperone: true, occupants: ['Antwinette', "Sa'ryah", 'Amilia', 'Laelyah', 'Younique', 'Deysi'] },
  { room: '2', gender: 'sisters', chaperone: true, occupants: ['Gene', 'Anafeli', 'Ziryhana', 'Chloe', 'Cailyn', 'Tailynn'] },
  { room: '3', gender: 'sisters', chaperone: true, occupants: ['Gigi', 'Kayla', 'Aaliyah', 'Love', 'Jada', 'Savana'] },
  { room: '4', gender: 'sisters', chaperone: true, occupants: ['Ajanai', 'Mariah', 'Isabella', 'Dezanay', 'Neveah'] },
  { room: '5', gender: 'sisters', chaperone: true, occupants: ['Shanice', 'Maya', 'Sofia', 'Eunice', 'Amaiah', 'Lily'] },
  { room: '6', gender: 'brothers', chaperone: true, occupants: ['Stephan', 'Alexander', 'Tristan', 'James', 'Javon', 'Kai'] },
  { room: '7', gender: 'sisters', chaperone: true, occupants: ['Brittany', 'Abby', 'Alanys', 'Anastasia', 'Melony', 'Perla'] },
  { room: '8', gender: 'brothers', chaperone: true, occupants: ['D Jonny', 'Daniel', 'Jesus', 'Gamble', 'Makai', 'Angel'] },
  { room: '9', gender: 'brothers', chaperone: true, occupants: ['B.Zack', 'Derrick', 'Jose', 'Aldo', 'Adam', 'Adrian'] },
  { room: '10', gender: 'sisters', chaperone: true, occupants: ['Micaela', 'Esperanza', 'Naomi', 'Melody', 'Kylee'] },
  { room: '11', gender: 'brothers', chaperone: true, occupants: ['M Ray', 'Andy', 'Aiden', 'Joshua', 'Fernando', 'Logan'] },
  { room: '12', gender: 'brothers', chaperone: true, occupants: ['Stephan', 'Keven', 'Aiden', 'LeAndre', 'Alan', 'Jonah'] },
  { room: '13', gender: 'sisters', chaperone: true, occupants: ['Ralinda', 'Alice', 'Jessica', 'Vanessa', 'Monique (June 23–24th)', 'Cassie (June 23–24th)'] },
  { room: '14', gender: 'brothers', chaperone: true, occupants: ['D. Gustavo', 'Hugo', 'Jayden', 'Matias', 'Anthony', 'Kingston'] },
  { room: '15', gender: 'brothers', chaperone: false, occupants: ['Gabriel', 'Jovanny', 'Rowan'] },
  // Overseers (no in-group chaperone) — listed in the room roster as their own
  // groups: ministers/elders together, and the pastors together.
  { room: '16', gender: 'brothers', chaperone: false, occupants: ['E. Anthony', 'E. Glenn', 'M. Uriel', 'M. Casey', 'M. Jeff'] },
  { room: '17', gender: 'brothers', chaperone: false, occupants: ['P. Jorge', 'P. Dean'] },
];

// ── Carpool / transportation ─────────────────────────────────────────────────
// Transcribed from the Transportation arrangements. Each vehicle has a `type`
// that drives its colour and the student image shown:
//   sisters → pink   |   brothers → blue   |   coed → purple (mixed vehicles)
//   plain   → no colour coding, no badge, no avatar (left intentionally neutral).
// The first person is the driver; the rest are passengers. Admins can move
// drivers and passengers within and between vehicles in the app.
//
// Car arrangements are kept SEPARATELY for the trip to camp (`arrival`) and the
// trip home (`departure`). The two lists are fully independent — editing or
// deleting cars on one leg never affects the other. Departure starts as a copy
// of arrival so admins have a sensible starting point to adjust, since the ride
// home is often similar but may differ.
const DEFAULT_CARS = [
  { name: 'Car 1', type: 'sisters', driver: 'Antwinette', departure: '', passengers: ["Sa'ryah", 'Amilia', 'Laelyah'] },
  { name: 'Car 2', type: 'sisters', driver: 'Gene', departure: '', passengers: ['Sofia', 'Ziryhana', 'Love', 'Tailynn', 'Lily'] },
  { name: 'Car 3', type: 'sisters', driver: 'Gigi', departure: '', passengers: ['Kayla', 'Aaliyah', 'Jada', 'Savanna'] },
  { name: 'Car 4', type: 'sisters', driver: 'S. Michelle Rois', departure: '', passengers: ['Ajanai', 'Mariah', 'Isabella'] },
  { name: 'Car 5', type: 'sisters', driver: 'Shanice', departure: '', passengers: ['Anafeli', 'Sofia', 'Eunice', 'Amaiah'] },
  { name: 'Car 6', type: 'brothers', driver: 'Stephan', departure: '', passengers: ['Alexander', 'Javon', 'Kai'] },
  { name: 'Car 7', type: 'sisters', driver: 'Brittany', departure: '', passengers: ['Abby', 'Alanys', 'Anastasia'] },
  { name: 'Car 8', type: 'brothers', driver: 'D Jonny', departure: '', passengers: ['Gamble', 'Jose', 'Aldo', 'Stephen', 'Makai'] },
  { name: 'Car 9', type: 'brothers', driver: 'B.Zack', departure: '', passengers: ['Rowan', 'Jesus', 'Tristan'] },
  { name: 'Car 10', type: 'sisters', driver: 'Kadijah Jones', departure: '', passengers: ['Micaela', 'Esperanza', 'Naomi'] },
  { name: 'Car 11', type: 'brothers', driver: 'M Ray', departure: '', passengers: ['Kingston', 'James', 'Anthony'] },
  { name: 'Car 12', type: 'brothers', driver: 'Daniel', departure: '', passengers: ['Keven', 'Aiden', 'LeAndre'] },
  { name: 'Car 13', type: 'sisters', driver: 'S. Kailee', departure: '', passengers: ['Jessica', 'Vanessa', 'Monique (June 23–24th)', 'Cassie (June 23–24th)'] },
  { name: 'Car 14', type: 'coed', driver: 'S. Madessen', departure: '', passengers: ['Younique', 'Hugo', 'Jayden', 'Matias'] },
  { name: 'Car 15 (Trailer)', type: 'brothers', driver: 'D. Mark', departure: '', passengers: ['Jovanny', 'Gabriel', 'Joshua'] },
  { name: 'Car 16', type: 'coed', driver: 'B. Steven / D. Michele', departure: '', passengers: ['Tristan', 'James', 'Neveah'] },
  { name: 'Car 17', type: 'sisters', driver: 'Michelle Wingate', departure: '', passengers: ['Deysi', 'Dezanay', 'Melody'] },
  { name: 'Car 18', type: 'sisters', driver: 'D. Paloma', departure: '', passengers: ['Melony', 'Perla'] },
  { name: 'Car 20', type: 'sisters', driver: 'S. Kim', departure: '', passengers: ['Chloe', 'Cailyn', 'Kylee'] },
  { name: 'Car 21', type: 'brothers', driver: 'M. Uriel', departure: '', passengers: ['Andy', 'Aiden', 'Joshua', 'Angel'] },
  { name: 'Car 22', type: 'plain', driver: 'P. Jorge', departure: '', passengers: ['P. Dean', 'E. Jennifer'] },
  { name: 'Car 23', type: 'plain', driver: 'E. Anthony', departure: '', passengers: ['P. Dean', 'E. Jennifer'] },
];

export const DEFAULT_CARPOOL = {
  arrival: DEFAULT_CARS,
  departure: JSON.parse(JSON.stringify(DEFAULT_CARS)),
};

// ── Trip logistics (arrival to camp / departure home) ────────────────────────
// Shown at the top of the Carpool tab as two bubbles. Stored in the database so
// admins can edit it in the app. The departure plans are intentionally left
// empty — the car departure arrangements are not finalised yet, so the admin
// fills this in from the app once they are ready (the member view shows a
// friendly "coming soon" note until then).
export const DEFAULT_TRIP = {
  arrival: {
    heading: 'Heading to Camp',
    date: 'Sunday, June 21',
    note: 'We depart from 1st Denver right after the Orientation. Drivers, please make sure your car is cleaned so we can serve the ISBA prophets gracefully. Thank you!',
    stops: [
      { time: '7:00 AM', text: 'West Central Region arrives at 1st Denver' },
      { time: '6:00 PM', text: 'Orientation with P. Jorge at 1st Denver' },
      { time: '7:00 PM', text: 'Depart 1st Denver → YMCA of the Rockies (Snow Mountain Ranch) · about 1 hr 30 min' },
    ],
  },
  departure: {
    heading: 'Heading Home',
    date: 'Thursday, June 25',
    note: '🚗 Car arrangements for the trip home are still being finalised and will be shared here once confirmed. For now, here is the departure-day schedule.',
    stops: [
      { time: '7:00 AM', text: 'Wake up & get ready' },
      { time: '7:45 AM', text: 'Breakfast to go' },
      { time: 'Morning', text: 'Depart YMCA of the Rockies → your respective Zions · safe travels home!' },
    ] as { time: string; text: string }[],
  },
};

// Initial admin PIN. Intentionally different from the member login passcode.
// Admins can change it in the app under the Admin bar → PIN.
export const DEFAULT_ADMIN_PIN = '2026';

// The member login passcode. The admin PIN is never allowed to equal this.
export const MEMBER_PASSCODE = '1925';

import { db } from "./index.js";
import { settings } from "./schema.js";
import { eq } from "drizzle-orm";
import {
  DEFAULT_SCHEDULE,
  DEFAULT_ROOMS,
  DEFAULT_CARPOOL,
  DEFAULT_TRIP,
  DEFAULT_ADMIN_PIN,
} from "./defaults.js";

export type SectionKey = "schedule" | "rooms" | "carpool" | "trip";

const SECTION_DEFAULTS: Record<SectionKey, unknown> = {
  schedule: DEFAULT_SCHEDULE,
  rooms: DEFAULT_ROOMS,
  carpool: DEFAULT_CARPOOL,
  trip: DEFAULT_TRIP,
};

// Maps a logical section to the row key used in the `settings` table. The
// rooms data model changed (flat colour-coded rooms with chaperones), so it
// uses a fresh key to guarantee the new defaults are seeded rather than any
// previously stored building-shaped data. The carpool key was bumped to v3
// when cars 22 & 23 became "plain" (uncoloured) so the corrected arrangement
// re-seeds cleanly, and to v4 when car arrangements were split into independent
// `arrival` and `departure` lists (so deleting one leg's cars can no longer wipe
// the other) — the bump re-seeds the full roster for both legs cleanly. Rooms
// were bumped to v4 and schedule to v3 when both were reconciled against the
// official ISBA 2026 camp document (corrected room rosters, added overseer
// groups, fixed a prayer-time leader).
const SECTION_DB_KEY: Record<SectionKey, string> = {
  schedule: "schedule_v3",
  rooms: "rooms_v4",
  carpool: "carpool_v4",
  trip: "trip_v2",
};

async function readRaw(key: string): Promise<string | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row ? row.value : null;
}

async function writeRaw(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

// Carpool car arrangements are kept per leg: { arrival: Car[], departure: Car[] }.
// Earlier versions stored a single flat array. Normalise both legacy and partial
// shapes into the leg-keyed object so reads always hand the client two
// independent lists. A legacy array becomes the arrival list, with departure
// seeded as a deep copy so the two legs start identical but can diverge — and so
// no previously entered arrangement is ever lost in the migration.
function normalizeCarpool(value: unknown): { arrival: unknown[]; departure: unknown[] } {
  if (Array.isArray(value)) {
    return { arrival: value, departure: JSON.parse(JSON.stringify(value)) };
  }
  if (value && typeof value === "object") {
    const v = value as { arrival?: unknown; departure?: unknown };
    return {
      arrival: Array.isArray(v.arrival) ? v.arrival : [],
      departure: Array.isArray(v.departure) ? v.departure : [],
    };
  }
  return { arrival: [], departure: [] };
}

// Returns a content section, seeding the default into the database the first
// time it is requested so the database becomes the durable source of truth.
export async function getSection(key: SectionKey): Promise<unknown> {
  const dbKey = SECTION_DB_KEY[key];
  const raw = await readRaw(dbKey);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      return key === "carpool" ? normalizeCarpool(parsed) : parsed;
    } catch {
      return SECTION_DEFAULTS[key];
    }
  }
  const def = SECTION_DEFAULTS[key];
  await writeRaw(dbKey, JSON.stringify(def));
  return def;
}

export async function setSection(key: SectionKey, data: unknown): Promise<void> {
  await writeRaw(SECTION_DB_KEY[key], JSON.stringify(data));
}

export async function getAdminPin(): Promise<string> {
  const raw = await readRaw("admin_pin");
  if (raw !== null) return raw;
  await writeRaw("admin_pin", DEFAULT_ADMIN_PIN);
  return DEFAULT_ADMIN_PIN;
}

export async function setAdminPin(pin: string): Promise<void> {
  await writeRaw("admin_pin", pin);
}

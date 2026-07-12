import webpush from "web-push";
import { db } from "./index.js";
import { settings, pushSubscriptions } from "./schema.js";
import { eq } from "drizzle-orm";

// Web Push notifications for new announcements.
//
// The app collects no names or logins. A member who wants alerts taps a
// "Notify me" toggle, which stores their browser's anonymous push subscription
// in the `push_subscriptions` table. When an admin posts an announcement the
// server signs a message with the trip's VAPID keys and hands it to each
// device's push service (Apple's or Google's), which wakes the installed app's
// service worker to display the notification — even with the app closed.

// VAPID is the standard that lets a push service trust messages from this
// server. The keypair is generated once, on first use, and kept in the
// `settings` table (the same private store that already holds the admin PIN).
// Keeping it in the database means there is nothing to configure by hand and no
// secret is ever exposed to the browser — only the public key is handed out.
const VAPID_SETTINGS_KEY = "vapid_keys";

// A `mailto:`/URL "subject" is required by the push protocol so a push service
// can contact the sender if a subscription misbehaves. It is not a secret.
const VAPID_SUBJECT = "mailto:no-reply@isbacamp2026.netlify.app";

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

async function loadVapidKeys(): Promise<VapidKeys> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, VAPID_SETTINGS_KEY));

  if (row) {
    try {
      const parsed = JSON.parse(row.value) as Partial<VapidKeys>;
      if (parsed.publicKey && parsed.privateKey) {
        return { publicKey: parsed.publicKey, privateKey: parsed.privateKey };
      }
    } catch {
      /* fall through and regenerate */
    }
  }

  const keys = webpush.generateVAPIDKeys();
  // Seed the keypair the first time it is needed. `onConflictDoNothing` guards
  // the rare race where two requests generate keys at once — the first write
  // wins and the loser re-reads it below.
  await db
    .insert(settings)
    .values({ key: VAPID_SETTINGS_KEY, value: JSON.stringify(keys) })
    .onConflictDoNothing();

  const [stored] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, VAPID_SETTINGS_KEY));
  if (stored) {
    try {
      const parsed = JSON.parse(stored.value) as VapidKeys;
      if (parsed.publicKey && parsed.privateKey) return parsed;
    } catch {
      /* ignore and use freshly generated keys */
    }
  }
  return keys;
}

// The public half of the VAPID keypair, which the browser needs in order to
// subscribe. Safe to expose.
export async function getVapidPublicKey(): Promise<string> {
  const { publicKey } = await loadVapidKeys();
  return publicKey;
}

interface PushAnnouncement {
  id: number;
  title: string;
  body: string;
}

// Notify every opted-in device about a freshly posted announcement. Failures
// for one device never affect the others or the caller — the only side effect
// is pruning subscriptions a push service reports as permanently gone (404/410),
// which happens when someone resets their phone or clears their browser.
export async function sendAnnouncementPush(a: PushAnnouncement): Promise<void> {
  const subs = await db.select().from(pushSubscriptions);
  if (subs.length === 0) return;

  const { publicKey, privateKey } = await loadVapidKeys();
  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);

  const payload = JSON.stringify({
    title: a.title,
    body: a.body.length > 140 ? `${a.body.slice(0, 139)}…` : a.body,
    url: "/",
    tag: `announcement-${a.id}`,
  });

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, s.endpoint));
        }
        // Any other error (transient network/push-service hiccup) is ignored;
        // the device stays subscribed and will get the next announcement.
      }
    }),
  );
}

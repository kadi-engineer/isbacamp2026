import { createFileRoute } from '@tanstack/react-router';
import { db } from '../../../db/index.js';
import { pushSubscriptions } from '../../../db/schema.js';
import { getVapidPublicKey } from '../../../db/push.js';
import { eq } from 'drizzle-orm';

// Endpoints for the per-device "Notify me about announcements" toggle.
//
//   GET    – hand the browser the VAPID public key it needs to subscribe.
//   POST   – store this browser's push subscription (opt in).
//   DELETE – forget this browser's push subscription (opt out).
//
// There are no usernames: a subscription is tied only to the browser's own push
// `endpoint` plus the anonymous client id already used for reactions.
export const Route = createFileRoute('/api/push')({
  server: {
    handlers: {
      GET: async () => {
        const publicKey = await getVapidPublicKey();
        // The key is fixed for the life of the trip, so let the browser and edge
        // cache it rather than hitting the database on every visit.
        return Response.json(
          { publicKey },
          {
            headers: {
              'Cache-Control': 'public, max-age=0, must-revalidate',
              'Netlify-CDN-Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
          },
        );
      },

      POST: async ({ request }) => {
        let payload: { clientId?: unknown; subscription?: unknown };
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: 'Invalid body' }, { status: 400 });
        }

        const clientId =
          typeof payload.clientId === 'string' ? payload.clientId.trim().slice(0, 100) : '';
        const sub = payload.subscription as
          | { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
          | undefined;
        const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : '';
        const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : '';
        const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : '';

        if (!clientId || !endpoint || !p256dh || !auth) {
          return Response.json({ error: 'Invalid subscription' }, { status: 400 });
        }

        // Upsert on the unique endpoint so re-enabling on the same browser
        // refreshes its keys/client id instead of creating a duplicate row.
        await db
          .insert(pushSubscriptions)
          .values({ clientId, endpoint, p256dh, auth })
          .onConflictDoUpdate({
            target: pushSubscriptions.endpoint,
            set: { clientId, p256dh, auth },
          });

        return Response.json({ ok: true }, { status: 201 });
      },

      DELETE: async ({ request }) => {
        const url = new URL(request.url);
        let endpoint = url.searchParams.get('endpoint') ?? '';
        if (!endpoint) {
          try {
            const body = await request.json();
            if (typeof body?.endpoint === 'string') endpoint = body.endpoint;
          } catch {
            /* no body – fall through */
          }
        }
        if (!endpoint) {
          return Response.json({ error: 'Missing endpoint' }, { status: 400 });
        }

        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
        return new Response(null, { status: 204 });
      },
    },
  },
});

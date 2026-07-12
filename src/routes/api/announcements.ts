import { createFileRoute } from '@tanstack/react-router';
import { db } from '../../../db/index.js';
import { announcements, announcementReactions } from '../../../db/schema.js';
import { getAdminPin } from '../../../db/content.js';
import { desc, eq, sql } from 'drizzle-orm';

export const Route = createFileRoute('/api/announcements')({
  server: {
    handlers: {
      GET: async () => {
        const rows = await db
          .select()
          .from(announcements)
          .orderBy(desc(announcements.pinned), desc(announcements.createdAt));

        // Aggregate emoji reaction counts per announcement. These totals are the
        // same for everyone, so they stay safely cacheable at the edge — each
        // visitor's own reactions are tracked client-side and reconciled through
        // the dedicated /api/reactions endpoint after they tap.
        const counts = await db
          .select({
            announcementId: announcementReactions.announcementId,
            emoji: announcementReactions.emoji,
            count: sql<number>`count(*)::int`,
          })
          .from(announcementReactions)
          .groupBy(announcementReactions.announcementId, announcementReactions.emoji);

        const byId = new Map<number, Record<string, number>>();
        for (const c of counts) {
          const m = byId.get(c.announcementId) ?? {};
          m[c.emoji] = Number(c.count);
          byId.set(c.announcementId, m);
        }
        const withReactions = rows.map((r) => ({ ...r, reactions: byId.get(r.id) ?? {} }));

        // Cache at the Netlify edge so a burst of members loading the app at
        // once collapses to a single database read. New posts and reaction
        // tallies surface within a few seconds, and admins bypass the cache with
        // a cache-busting query param after posting.
        return Response.json(withReactions, {
          headers: {
            'Cache-Control': 'public, max-age=0, must-revalidate',
            'Netlify-CDN-Cache-Control':
              'public, s-maxage=20, stale-while-revalidate=300',
          },
        });
      },
      POST: async ({ request }) => {
        const { title, body, pinned, passcode } = await request.json();
        const adminPin = await getAdminPin();
        if (passcode !== adminPin) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const [row] = await db
          .insert(announcements)
          .values({ title, body, pinned: pinned ?? false })
          .returning();

        // Fan out push notifications without blocking the response. Triggering
        // the background function returns a 202 right away, so the admin's
        // "Post" finishes immediately no matter how many devices are subscribed;
        // the slow per-device delivery happens off to the side. A trigger
        // failure never fails the post — the announcement is already saved.
        try {
          const target = new URL('/.netlify/functions/announcement-push-background', request.url);
          await fetch(target, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: row.id, title: row.title, body: row.body, secret: adminPin }),
          });
        } catch {
          /* notifications are best-effort; the announcement is already saved */
        }

        return Response.json(row, { status: 201 });
      },
      DELETE: async ({ request }) => {
        const url = new URL(request.url);
        const id = Number(url.searchParams.get('id'));
        const passcode = url.searchParams.get('passcode');
        const adminPin = await getAdminPin();
        if (passcode !== adminPin) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        await db.delete(announcements).where(eq(announcements.id, id));
        return new Response(null, { status: 204 });
      },
    },
  },
});

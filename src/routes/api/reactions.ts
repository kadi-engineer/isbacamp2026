import { createFileRoute } from '@tanstack/react-router';
import { db } from '../../../db/index.js';
import { announcementReactions } from '../../../db/schema.js';
import { and, eq, sql } from 'drizzle-orm';

// The app has no usernames. Each visitor is identified only by an anonymous,
// randomly generated client id their browser keeps in localStorage. That id is
// enough to let a person toggle their own reaction on and off without us ever
// needing to know who they are. Reactions are limited to this small palette so
// the column never stores arbitrary input.
const ALLOWED_EMOJI = ['🙏', '❤️', '🙌', '🔥', '😊'];

export const Route = createFileRoute('/api/reactions')({
  server: {
    handlers: {
      // Toggle one emoji reaction for one client on one announcement. Returns the
      // refreshed totals for that announcement plus the set of emojis this client
      // currently has on it, so the browser can reconcile its optimistic update
      // against the authoritative database state.
      POST: async ({ request }) => {
        let payload: { announcementId?: unknown; emoji?: unknown; clientId?: unknown };
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: 'Invalid body' }, { status: 400 });
        }

        const announcementId = Number(payload.announcementId);
        const emoji = payload.emoji;
        const clientId =
          typeof payload.clientId === 'string' ? payload.clientId.trim().slice(0, 100) : '';

        if (
          !Number.isInteger(announcementId) ||
          announcementId <= 0 ||
          typeof emoji !== 'string' ||
          !ALLOWED_EMOJI.includes(emoji) ||
          !clientId
        ) {
          return Response.json({ error: 'Invalid reaction' }, { status: 400 });
        }

        const match = and(
          eq(announcementReactions.announcementId, announcementId),
          eq(announcementReactions.clientId, clientId),
          eq(announcementReactions.emoji, emoji),
        );

        try {
          const existing = await db
            .select({ id: announcementReactions.id })
            .from(announcementReactions)
            .where(match);

          if (existing.length > 0) {
            await db.delete(announcementReactions).where(match);
          } else {
            await db
              .insert(announcementReactions)
              .values({ announcementId, clientId, emoji })
              .onConflictDoNothing();
          }
        } catch {
          // A foreign-key violation means the announcement no longer exists.
          return Response.json({ error: 'Announcement not found' }, { status: 404 });
        }

        const counts = await db
          .select({
            emoji: announcementReactions.emoji,
            count: sql<number>`count(*)::int`,
          })
          .from(announcementReactions)
          .where(eq(announcementReactions.announcementId, announcementId))
          .groupBy(announcementReactions.emoji);

        const mineRows = await db
          .select({ emoji: announcementReactions.emoji })
          .from(announcementReactions)
          .where(
            and(
              eq(announcementReactions.announcementId, announcementId),
              eq(announcementReactions.clientId, clientId),
            ),
          );

        const reactions: Record<string, number> = {};
        for (const c of counts) reactions[c.emoji] = Number(c.count);
        const mine = mineRows.map((r) => r.emoji);

        return Response.json({ reactions, mine });
      },
    },
  },
});

import { createFileRoute } from '@tanstack/react-router';
import {
  getSection,
  setSection,
  getAdminPin,
  type SectionKey,
} from '../../../db/content.js';

const SECTIONS: SectionKey[] = ['schedule', 'rooms', 'carpool', 'trip'];

export const Route = createFileRoute('/api/content')({
  server: {
    handlers: {
      // Public to logged-in members: returns all editable content sections.
      GET: async () => {
        const [schedule, rooms, carpool, trip] = await Promise.all([
          getSection('schedule'),
          getSection('rooms'),
          getSection('carpool'),
          getSection('trip'),
        ]);
        // Schedule/rooms/carpool change rarely, so cache at the edge to absorb
        // many members loading at once. Admin saves bypass the cache with a
        // cache-busting query param so edits show up immediately for them.
        return Response.json(
          { schedule, rooms, carpool, trip },
          {
            headers: {
              'Cache-Control': 'public, max-age=0, must-revalidate',
              'Netlify-CDN-Cache-Control':
                'public, s-maxage=30, stale-while-revalidate=300',
            },
          },
        );
      },
      // Admin only: replaces a single content section.
      PUT: async ({ request }) => {
        const { section, data, pin } = await request.json();
        const adminPin = await getAdminPin();
        if (pin !== adminPin) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!SECTIONS.includes(section)) {
          return Response.json({ error: 'Unknown section' }, { status: 400 });
        }
        // `trip` is a plain object; `carpool` is a { arrival, departure } object
        // of car lists; every other section is a plain array.
        const isObject = (d: unknown) =>
          typeof d === 'object' && d !== null && !Array.isArray(d);
        let valid: boolean;
        if (section === 'trip') {
          valid = isObject(data);
        } else if (section === 'carpool') {
          valid =
            isObject(data) &&
            Array.isArray((data as { arrival?: unknown }).arrival) &&
            Array.isArray((data as { departure?: unknown }).departure);
        } else {
          valid = Array.isArray(data);
        }
        if (!valid) {
          return Response.json({ error: 'Invalid data' }, { status: 400 });
        }
        await setSection(section as SectionKey, data);
        return Response.json({ ok: true });
      },
    },
  },
});

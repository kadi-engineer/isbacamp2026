import { createFileRoute } from '@tanstack/react-router';
import { db } from '../../../db/index.js';
import { submissions } from '../../../db/schema.js';
import { getAdminPin } from '../../../db/content.js';
import { desc } from 'drizzle-orm';

export const Route = createFileRoute('/api/submissions')({
  server: {
    handlers: {
      // Admin only: list every Fragrance of Zion submission.
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const pin = url.searchParams.get('pin');
        const adminPin = await getAdminPin();
        if (pin !== adminPin) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const rows = await db
          .select()
          .from(submissions)
          .orderBy(desc(submissions.createdAt));
        return Response.json(rows);
      },
      // Open to members: record a submission. We store the member's name, the
      // title of their fragrance, and the free-form summary. The created_at
      // timestamp is captured automatically by the database.
      POST: async ({ request }) => {
        const { name, title, body } = await request.json();
        if (!name?.trim() || !body?.trim()) {
          return Response.json({ error: 'Name and summary required' }, { status: 400 });
        }
        const [row] = await db
          .insert(submissions)
          .values({
            name: name.trim(),
            title: title?.trim() || null,
            body: body.trim(),
          })
          .returning();
        return Response.json(row, { status: 201 });
      },
    },
  },
});

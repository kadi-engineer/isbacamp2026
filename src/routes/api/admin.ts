import { createFileRoute } from '@tanstack/react-router';
import { getAdminPin, setAdminPin } from '../../../db/content.js';
import { MEMBER_PASSCODE } from '../../../db/defaults.js';

export const Route = createFileRoute('/api/admin')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = await request.json();
        const adminPin = await getAdminPin();

        if (payload.action === 'verify') {
          return Response.json({ ok: payload.pin === adminPin });
        }

        if (payload.action === 'change') {
          const { currentPin, newPin } = payload;
          if (currentPin !== adminPin) {
            return Response.json({ error: 'Current PIN is incorrect' }, { status: 401 });
          }
          if (typeof newPin !== 'string' || !/^\d{4,8}$/.test(newPin)) {
            return Response.json({ error: 'New PIN must be 4–8 digits' }, { status: 400 });
          }
          if (newPin === MEMBER_PASSCODE) {
            return Response.json(
              { error: 'Admin PIN cannot be the same as the member login passcode' },
              { status: 400 },
            );
          }
          await setAdminPin(newPin);
          return Response.json({ ok: true });
        }

        return Response.json({ error: 'Unknown action' }, { status: 400 });
      },
    },
  },
});

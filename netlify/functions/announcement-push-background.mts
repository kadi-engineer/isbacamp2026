import { getAdminPin } from "../../db/content.js";
import { sendAnnouncementPush } from "../../db/push.js";

// Fans out push notifications for a freshly posted announcement.
//
// Delivering a Web Push to every opted-in device takes as long as the slowest
// device's push service responds, which grows with the number of subscribers.
// Running it here — a background function — keeps the admin's "Post" request
// snappy: the announcements API triggers this endpoint and gets an immediate
// 202 back, while the actual delivery (up to 15 minutes) happens off to the
// side. The `secret` is the admin PIN, validated server-to-server so a random
// visitor can't poke this endpoint to spam notifications.
export default async (req: Request): Promise<Response> => {
  let payload: { id?: number; title?: string; body?: string; secret?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const adminPin = await getAdminPin();
  if (!payload.secret || payload.secret !== adminPin) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (typeof payload.id !== "number" || !payload.title || !payload.body) {
    return new Response("Bad request", { status: 400 });
  }

  try {
    await sendAnnouncementPush({ id: payload.id, title: payload.title, body: payload.body });
  } catch {
    // Best-effort: the announcement itself is already saved. The 202 was sent
    // to the caller long ago, so there is nothing to report back here.
  }

  // Return value is ignored — the client already received its 202.
  return new Response(null, { status: 200 });
};

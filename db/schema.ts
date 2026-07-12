import { pgTable, serial, text, timestamp, boolean, integer, unique, index } from "drizzle-orm/pg-core";

export const announcements = pgTable("announcements", {
  id: serial().primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  pinned: boolean("pinned").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Emoji reactions on announcements. The app has no usernames, so each visitor
// is identified by an anonymous, randomly generated `client_id` stored in their
// browser's localStorage. The unique constraint guarantees one client can give
// a given announcement each emoji at most once (toggling deletes the row), while
// still allowing different emojis from the same client. Deleting an announcement
// cascades to its reactions.
export const announcementReactions = pgTable(
  "announcement_reactions",
  {
    id: serial().primaryKey(),
    announcementId: integer("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    unique("announcement_reactions_unique").on(t.announcementId, t.clientId, t.emoji),
    // The News tab tallies reactions with `count(*) ... GROUP BY announcement_id,
    // emoji` on every load. Without an index matching that grouping the database
    // scans the whole table, so the tally slows down as taps accumulate. This
    // index lets the count come straight from a compact index instead.
    index("announcement_reactions_announcement_id_emoji_idx").on(t.announcementId, t.emoji),
  ],
);

// Devices that have opted in to push notifications for new announcements. The
// app has no usernames, so each row carries the same anonymous `client_id` used
// for reactions plus the browser's Web Push subscription (its unique `endpoint`
// and the two encryption keys the push service requires). `endpoint` is unique
// so re-subscribing the same browser updates its row instead of duplicating it.
// Rows are pruned automatically when a push service reports the subscription as
// gone (the person reset their phone or cleared their browser).
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial().primaryKey(),
  clientId: text("client_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Key-value store for editable content sections (schedule, rooms, carpool)
// and app settings such as the admin PIN. Values are stored as JSON text.
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Fragrance of Zion member submissions. Members provide their name, the title
// of their fragrance, and a free-form summary (no length limit). The date/time
// is captured automatically. `category` and `contact` are legacy nullable
// columns kept for backwards compatibility with earlier submissions.
export const submissions = pgTable("submissions", {
  id: serial().primaryKey(),
  name: text("name").notNull(),
  title: text("title"),
  category: text("category"),
  body: text("body").notNull(),
  contact: text("contact"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  // The admin Fragrance list reads every submission newest-first. An index on
  // the sort column keeps that read fast as submissions grow.
  index("submissions_created_at_idx").on(t.createdAt),
]);

CREATE TABLE "announcement_reactions" (
	"id" serial PRIMARY KEY,
	"announcement_id" integer NOT NULL,
	"client_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "announcement_reactions_unique" UNIQUE("announcement_id","client_id","emoji")
);
--> statement-breakpoint
ALTER TABLE "announcement_reactions" ADD CONSTRAINT "announcement_reactions_announcement_id_announcements_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE;
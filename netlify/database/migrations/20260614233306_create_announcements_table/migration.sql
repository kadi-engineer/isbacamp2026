CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"pinned" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);

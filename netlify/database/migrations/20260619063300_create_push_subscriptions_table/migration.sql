CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY,
	"client_id" text NOT NULL,
	"endpoint" text NOT NULL UNIQUE,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);

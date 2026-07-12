ALTER TABLE "submissions" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "category" DROP NOT NULL;
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_challenges` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`difficulty` text DEFAULT 'Unrated' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`date` text,
	`time_limit` text,
	`memory_limit` text,
	`author` text,
	`statement` text NOT NULL,
	`input_format` text,
	`output_format` text,
	`constraints` text,
	`samples` text DEFAULT '[]' NOT NULL,
	`content_html` text,
	`tests` text DEFAULT '[]' NOT NULL,
	`checker` text DEFAULT '{"type":"token"}' NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_challenges`("slug", "title", "difficulty", "tags", "date", "time_limit", "memory_limit", "author", "statement", "input_format", "output_format", "constraints", "samples", "content_html", "tests", "checker", "schema_version", "created_at", "updated_at") SELECT "slug", "title", "difficulty", "tags", "date", "time_limit", "memory_limit", "author", "statement", "input_format", "output_format", "constraints", "samples", "content_html", "tests", "checker", "schema_version", "created_at", "updated_at" FROM `challenges`;--> statement-breakpoint
DROP TABLE `challenges`;--> statement-breakpoint
ALTER TABLE `__new_challenges` RENAME TO `challenges`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `challenges_date_unique` ON `challenges` (`date`);
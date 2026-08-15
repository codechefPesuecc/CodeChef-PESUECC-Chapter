CREATE TABLE `challenges` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`difficulty` text DEFAULT 'Unrated' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`date` text NOT NULL,
	`time_limit` text,
	`memory_limit` text,
	`author` text,
	`statement` text NOT NULL,
	`input_format` text,
	`output_format` text,
	`constraints` text,
	`samples` text DEFAULT '[]' NOT NULL,
	`tests` text DEFAULT '[]' NOT NULL,
	`checker` text DEFAULT '{"type":"token"}' NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `submissions` ADD `ranked` integer DEFAULT true NOT NULL;
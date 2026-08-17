ALTER TABLE `attempts` ADD `flags` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attempts` ADD `flags_breakdown` text DEFAULT '{}' NOT NULL;
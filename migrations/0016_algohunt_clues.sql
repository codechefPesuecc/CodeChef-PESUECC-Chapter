CREATE TABLE `ah_clues` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`label` text NOT NULL,
	`text` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `ah_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ah_clues_event_idx` ON `ah_clues` (`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ah_clues_event_label_unique` ON `ah_clues` (`event_id`,`label`);
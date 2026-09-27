CREATE TABLE `recruitment_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`cycle` text NOT NULL,
	`domains` text NOT NULL,
	`year_of_study` text NOT NULL,
	`branch` text NOT NULL,
	`phone` text NOT NULL,
	`heard_from` text,
	`responses` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`reviewer_notes` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recruitment_applications_user_id_cycle_unique` ON `recruitment_applications` (`user_id`,`cycle`);--> statement-breakpoint
ALTER TABLE `users` ADD `phone` text;
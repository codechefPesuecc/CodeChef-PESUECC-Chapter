CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_slug` text NOT NULL,
	`user_id` text NOT NULL,
	`language` text NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`runtime_ms` integer,
	`elapsed_seconds` integer,
	`flags` integer DEFAULT 0 NOT NULL,
	`flags_breakdown` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`name` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_handle_unique` ON `users` (`handle`);
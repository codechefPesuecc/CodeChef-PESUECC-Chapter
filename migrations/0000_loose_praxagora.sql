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
	`username` text NOT NULL,
	`email` text NOT NULL,
	`srn` text,
	`prn` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_srn_unique` ON `users` (`srn`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_prn_unique` ON `users` (`prn`);
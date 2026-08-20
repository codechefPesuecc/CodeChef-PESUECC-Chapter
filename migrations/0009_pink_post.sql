CREATE TABLE `monstr_contests` (
	`id` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`title` text NOT NULL,
	`join_code` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`allowed_languages` text NOT NULL,
	`started_at` integer,
	`ends_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monstr_contests_join_code_unique` ON `monstr_contests` (`join_code`);--> statement-breakpoint
CREATE TABLE `monstr_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`contest_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`contest_id`) REFERENCES `monstr_contests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monstr_participants_contest_id_user_id_unique` ON `monstr_participants` (`contest_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `monstr_problems` (
	`id` text PRIMARY KEY NOT NULL,
	`contest_id` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`statement` text NOT NULL,
	`input_format` text,
	`output_format` text,
	`constraints` text,
	`time_limit` text,
	`memory_limit` text,
	`samples` text DEFAULT '[]' NOT NULL,
	`content_html` text,
	`tests` text DEFAULT '[]' NOT NULL,
	`checker` text DEFAULT '{"type":"token"}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`contest_id`) REFERENCES `monstr_contests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `monstr_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`contest_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`user_id` text NOT NULL,
	`language` text NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`runtime_ms` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`contest_id`) REFERENCES `monstr_contests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`problem_id`) REFERENCES `monstr_problems`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `users` ADD `is_teacher` integer DEFAULT false NOT NULL;
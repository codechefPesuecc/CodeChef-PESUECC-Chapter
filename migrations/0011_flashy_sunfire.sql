CREATE TABLE `recruitment_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`is_open` integer DEFAULT false NOT NULL,
	`form_url` text,
	`cycle` text,
	`closes_on` text,
	`updated_at` integer NOT NULL,
	`updated_by` text
);

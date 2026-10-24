CREATE TABLE `ah_integrity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text NOT NULL,
	`device_id` text NOT NULL,
	`reasons` text NOT NULL,
	`left_at` integer NOT NULL,
	`returned_at` integer,
	FOREIGN KEY (`event_id`) REFERENCES `ah_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `ah_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ah_integrity_events_event_left_idx` ON `ah_integrity_events` (`event_id`,`left_at`);--> statement-breakpoint
CREATE INDEX `ah_integrity_events_team_left_idx` ON `ah_integrity_events` (`team_id`,`left_at`);--> statement-breakpoint
CREATE TABLE `ah_team_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text NOT NULL,
	`device_id` text NOT NULL,
	`kind` text NOT NULL,
	`user_agent` text,
	`first_ip` text,
	`last_ip` text,
	`login_count` integer DEFAULT 0 NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `ah_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `ah_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ah_team_devices_event_idx` ON `ah_team_devices` (`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ah_team_devices_team_device_unique` ON `ah_team_devices` (`team_id`,`device_id`);--> statement-breakpoint
ALTER TABLE `ah_events` ADD `ends_at` integer;
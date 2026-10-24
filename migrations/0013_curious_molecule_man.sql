CREATE TABLE `ah_announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`message` text NOT NULL,
	`priority` text DEFAULT 'INFO' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `ah_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ah_announcements_event_created_idx` ON `ah_announcements` (`event_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ah_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`team_id` text,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`ip` text,
	`user_agent` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ah_audit_event_created_idx` ON `ah_audit_logs` (`event_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ah_audit_team_created_idx` ON `ah_audit_logs` (`team_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ah_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`difficulty` text DEFAULT 'Unrated' NOT NULL,
	`statement` text NOT NULL,
	`input_format` text,
	`output_format` text,
	`constraints` text,
	`samples` text DEFAULT '[]' NOT NULL,
	`content_html` text,
	`checker` text DEFAULT '{"type":"token"}' NOT NULL,
	`time_limit` text DEFAULT '2s' NOT NULL,
	`memory_limit` text DEFAULT '256MB' NOT NULL,
	`languages` text,
	`reference_solution` text,
	`brute_solution` text,
	`editorial` text,
	`author` text,
	`verified_at` integer,
	`source_sha256` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `ah_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ah_challenges_event_slug_unique` ON `ah_challenges` (`event_id`,`slug`);--> statement-breakpoint
CREATE TABLE `ah_code_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text NOT NULL,
	`stage_id` text,
	`submitted_code` text,
	`result` text NOT NULL,
	`code_id` text,
	`ip` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `ah_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `ah_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ah_code_attempts_team_created_idx` ON `ah_code_attempts` (`team_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ah_code_attempts_event_created_idx` ON `ah_code_attempts` (`event_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ah_code_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `ah_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ah_code_batches_event_idx` ON `ah_code_batches` (`event_id`);--> statement-breakpoint
CREATE TABLE `ah_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`serial` integer NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`used_by_team_id` text,
	`used_after_stage_id` text,
	`used_at` integer,
	`disabled_at` integer,
	`disabled_by` text,
	`disabled_reason` text,
	`placement_note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `ah_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`batch_id`) REFERENCES `ah_code_batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ah_codes_event_status_idx` ON `ah_codes` (`event_id`,`status`);--> statement-breakpoint
CREATE INDEX `ah_codes_used_by_idx` ON `ah_codes` (`used_by_team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ah_codes_code_unique` ON `ah_codes` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `ah_codes_event_serial_unique` ON `ah_codes` (`event_id`,`serial`);--> statement-breakpoint
CREATE TABLE `ah_disqualifications` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	`revoked_by` text,
	`revoke_reason` text,
	FOREIGN KEY (`event_id`) REFERENCES `ah_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `ah_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ah_events` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`is_test` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`max_team_size` integer DEFAULT 4 NOT NULL,
	`ranking_mode` text DEFAULT 'SOLVED_THEN_TIME' NOT NULL,
	`leaderboard_visible` integer DEFAULT true NOT NULL,
	`submissions_enabled` integer DEFAULT true NOT NULL,
	`codes_enabled` integer DEFAULT true NOT NULL,
	`started_at` integer,
	`paused_at` integer,
	`ended_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ah_events_slug_unique` ON `ah_events` (`slug`);--> statement-breakpoint
CREATE TABLE `ah_stage_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text NOT NULL,
	`stage_id` text NOT NULL,
	`challenge_solved` integer DEFAULT false NOT NULL,
	`challenge_solved_at` integer,
	`solved_submission_id` text,
	`code_redeemed` integer DEFAULT false NOT NULL,
	`code_redeemed_at` integer,
	`redeemed_code_id` text,
	`completed` integer DEFAULT false NOT NULL,
	`completed_at` integer,
	`completion_request_id` text,
	`manual_override` integer DEFAULT false NOT NULL,
	`override_reason` text,
	`override_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `ah_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `ah_teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`stage_id`) REFERENCES `ah_stages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ah_stage_progress_team_idx` ON `ah_stage_progress` (`team_id`);--> statement-breakpoint
CREATE INDEX `ah_stage_progress_event_idx` ON `ah_stage_progress` (`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ah_stage_progress_team_stage_unique` ON `ah_stage_progress` (`team_id`,`stage_id`);--> statement-breakpoint
CREATE TABLE `ah_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`stage_number` integer NOT NULL,
	`challenge_id` text NOT NULL,
	`points` integer DEFAULT 100 NOT NULL,
	`is_final` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `ah_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`challenge_id`) REFERENCES `ah_challenges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ah_stages_event_number_unique` ON `ah_stages` (`event_id`,`stage_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `ah_stages_event_challenge_unique` ON `ah_stages` (`event_id`,`challenge_id`);--> statement-breakpoint
CREATE TABLE `ah_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text NOT NULL,
	`stage_id` text NOT NULL,
	`challenge_id` text NOT NULL,
	`language` text NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'QUEUED' NOT NULL,
	`verdict` text,
	`passed` integer,
	`total` integer,
	`failed_on` integer,
	`detail` text,
	`runtime_ms` integer,
	`client_request_id` text,
	`created_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`event_id`) REFERENCES `ah_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `ah_teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`stage_id`) REFERENCES `ah_stages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`challenge_id`) REFERENCES `ah_challenges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ah_submissions_team_created_idx` ON `ah_submissions` (`team_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ah_submissions_event_created_idx` ON `ah_submissions` (`event_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `ah_submissions_team_request_unique` ON `ah_submissions` (`team_id`,`client_request_id`);--> statement-breakpoint
CREATE TABLE `ah_team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`is_captain` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `ah_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ah_team_members_team_idx` ON `ah_team_members` (`team_id`);--> statement-breakpoint
CREATE TABLE `ah_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_code` text NOT NULL,
	`team_name` text NOT NULL,
	`college` text,
	`password_hash` text NOT NULL,
	`session_epoch` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'REGISTERED' NOT NULL,
	`checked_in_at` integer,
	`finished_at` integer,
	`disqualified_at` integer,
	`disqualification_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `ah_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ah_teams_event_idx` ON `ah_teams` (`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ah_teams_event_code_unique` ON `ah_teams` (`event_id`,`team_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `ah_teams_event_name_unique` ON `ah_teams` (`event_id`,`team_name`);--> statement-breakpoint
CREATE TABLE `ah_test_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`idx` integer NOT NULL,
	`input` text NOT NULL,
	`output` text NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `ah_challenges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ah_test_cases_challenge_idx_unique` ON `ah_test_cases` (`challenge_id`,`idx`);--> statement-breakpoint
CREATE TABLE `ah_volunteers` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `ah_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ah_volunteers_event_user_unique` ON `ah_volunteers` (`event_id`,`user_id`);
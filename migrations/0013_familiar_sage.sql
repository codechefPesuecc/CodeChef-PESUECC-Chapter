DROP INDEX `challenges_date_unique`;--> statement-breakpoint
CREATE INDEX `challenges_date_idx` ON `challenges` (`date`);
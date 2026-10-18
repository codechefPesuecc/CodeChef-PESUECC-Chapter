DROP INDEX IF EXISTS `challenges_date_unique`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `challenges_date_idx` ON `challenges` (`date`);

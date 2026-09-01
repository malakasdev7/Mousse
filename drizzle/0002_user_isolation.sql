CREATE INDEX `idx_audit_records_owner_kind` ON `audit_records` (`owner_id`,`kind`);
--> statement-breakpoint
PRAGMA optimize;

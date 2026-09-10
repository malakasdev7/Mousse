CREATE TABLE `audit_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `owner_id` text NOT NULL,
  `record_id` integer,
  `kind` text NOT NULL,
  `action` text NOT NULL CHECK (`action` IN ('create', 'update', 'delete')),
  `before_json` text,
  `after_json` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_owner_created` ON `audit_logs` (`owner_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_record` ON `audit_logs` (`record_id`, `kind`);
--> statement-breakpoint
PRAGMA optimize;

CREATE TABLE `applicants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rental_id` integer NOT NULL,
	`received_at` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`source` text DEFAULT 'landlord' NOT NULL,
	`draft` integer DEFAULT false NOT NULL,
	`form_step` integer DEFAULT 1 NOT NULL,
	`full_name` text NOT NULL,
	`phone` text,
	`email` text,
	`emergency` text,
	`occupants` integer,
	`other_adults` text,
	`pets` text,
	`move_in_on` text,
	`has_voucher` integer,
	`voucher_cents` integer,
	`voucher_program` text,
	`answers` text,
	`custom_answers` text,
	`landlord_checks` text,
	`consent` text,
	`signature_path` text,
	`signed_name` text,
	`signed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`rental_id`) REFERENCES `rentals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `applicants_rental` ON `applicants` (`rental_id`,`received_at`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reference_id` integer NOT NULL,
	`at` text NOT NULL,
	`method` text NOT NULL,
	`result` text NOT NULL,
	FOREIGN KEY (`reference_id`) REFERENCES `references`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attempts_reference` ON `attempts` (`reference_id`);--> statement-breakpoint
CREATE TABLE `background` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`applicant_id` integer NOT NULL,
	`no_convictions` integer DEFAULT false NOT NULL,
	`convictions` text,
	`assessment` text,
	`reviewed_on` text,
	`outcome` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`applicant_id`) REFERENCES `applicants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `background_applicant` ON `background` (`applicant_id`);--> statement-breakpoint
CREATE TABLE `criteria` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rental_id` integer NOT NULL,
	`code` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`params` text DEFAULT '{}' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`rental_id`) REFERENCES `rentals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `criteria_rental` ON `criteria` (`rental_id`,`order`);--> statement-breakpoint
CREATE TABLE `criteria_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rental_id` integer NOT NULL,
	`at` text NOT NULL,
	`before` text,
	`after` text,
	`reason` text NOT NULL,
	FOREIGN KEY (`rental_id`) REFERENCES `rentals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `criteria_history_rental` ON `criteria_history` (`rental_id`);--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`applicant_id` integer NOT NULL,
	`kind` text NOT NULL,
	`conditions` text,
	`reasons` text,
	`note` text,
	`report_influenced` integer DEFAULT false NOT NULL,
	`at` text NOT NULL,
	`notice_required` integer DEFAULT false NOT NULL,
	`notice_status` text DEFAULT 'not_required' NOT NULL,
	FOREIGN KEY (`applicant_id`) REFERENCES `applicants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `decisions_applicant` ON `decisions` (`applicant_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`applicant_id` integer NOT NULL,
	`type` text NOT NULL,
	`label` text,
	`file_path` text NOT NULL,
	`mime` text,
	`added_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	`checked_at` text,
	`income_id` integer,
	`pay_gross_cents` integer,
	`pay_frequency` text,
	`monthly_cents` integer,
	FOREIGN KEY (`applicant_id`) REFERENCES `applicants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`income_id`) REFERENCES `incomes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `documents_applicant` ON `documents` (`applicant_id`);--> statement-breakpoint
CREATE TABLE `incomes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`applicant_id` integer NOT NULL,
	`kind` text NOT NULL,
	`employer` text,
	`title` text,
	`start_on` text,
	`monthly_cents` integer,
	`phone` text,
	`supervisor` text,
	`person` text,
	`order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`applicant_id`) REFERENCES `applicants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `incomes_applicant` ON `incomes` (`applicant_id`);--> statement-breakpoint
CREATE TABLE `letters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`decision_id` integer NOT NULL,
	`kind` text NOT NULL,
	`body` text,
	`pdf_path` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	`sent_at` text,
	`sent_method` text,
	FOREIGN KEY (`decision_id`) REFERENCES `decisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `letters_decision` ON `letters` (`decision_id`);--> statement-breakpoint
CREATE TABLE `movein` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rental_id` integer NOT NULL,
	`applicant_id` integer,
	`handover_on` text,
	`rooms` text,
	`meters` text,
	`keys` integer,
	`alarms_tested` integer,
	`signatures` text,
	`pdf_path` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	`done_at` text,
	FOREIGN KEY (`rental_id`) REFERENCES `rentals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`applicant_id`) REFERENCES `applicants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `movein_rental` ON `movein` (`rental_id`);--> statement-breakpoint
CREATE TABLE `references` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`applicant_id` integer NOT NULL,
	`kind` text NOT NULL,
	`residence_id` integer,
	`income_id` integer,
	`contact_name` text,
	`contact_phone` text,
	`owner_confirmed` integer DEFAULT false NOT NULL,
	`confirm_source` text,
	`answers` text,
	`notes` text,
	`unreachable` integer DEFAULT false NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`applicant_id`) REFERENCES `applicants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`residence_id`) REFERENCES `residences`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`income_id`) REFERENCES `incomes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `references_applicant` ON `references` (`applicant_id`);--> statement-breakpoint
CREATE TABLE `rentals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`street` text NOT NULL,
	`unit` text,
	`city` text,
	`state` text,
	`zip` text,
	`rent_cents` integer NOT NULL,
	`bedrooms` integer DEFAULT 1 NOT NULL,
	`bathrooms` real,
	`available_on` text,
	`deposit_cents` integer,
	`fee_cents` integer DEFAULT 0 NOT NULL,
	`smoking_policy` text DEFAULT 'non_smoking' NOT NULL,
	`notes` text,
	`review_mode` text DEFAULT 'compare' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	`closed_at` text,
	`is_sample` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`applicant_id` integer NOT NULL,
	`service` text,
	`company_name` text,
	`company_address` text,
	`company_phone` text,
	`report_date` text,
	`evictions` text,
	`landlord_collections_cents` integer,
	`score` integer,
	`no_score` integer DEFAULT false NOT NULL,
	`score_model` text,
	`score_range` text,
	`score_date` text,
	`key_factors` text,
	`file_paths` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`applicant_id`) REFERENCES `applicants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reports_applicant` ON `reports` (`applicant_id`);--> statement-breakpoint
CREATE TABLE `residences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`applicant_id` integer NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`address` text NOT NULL,
	`from_month` text,
	`to_month` text,
	`current` integer DEFAULT false NOT NULL,
	`type` text,
	`rent_cents` integer,
	`landlord_name` text,
	`landlord_phone` text,
	`landlord_email` text,
	`reason` text,
	FOREIGN KEY (`applicant_id`) REFERENCES `applicants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `residences_applicant` ON `residences` (`applicant_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `timers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`applicant_id` integer NOT NULL,
	`kind` text NOT NULL,
	`started_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`resolved_at` text,
	`method` text,
	`notification_ids` text,
	FOREIGN KEY (`applicant_id`) REFERENCES `applicants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `timers_applicant` ON `timers` (`applicant_id`);
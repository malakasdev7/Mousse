CREATE TABLE `users` (`id` text PRIMARY KEY NOT NULL,`email` text NOT NULL,`name` text,`role` text DEFAULT 'admin' NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `suppliers` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`owner_id` text,`name` text NOT NULL,`contact` text,`notes` text,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint
CREATE TABLE `ingredients` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`owner_id` text,`supplier_id` integer,`name` text NOT NULL,`purchase_unit` text NOT NULL,`purchased_quantity` real NOT NULL,`price_cents` integer NOT NULL,`fraction_unit` text DEFAULT 'g' NOT NULL,`expires_at` text,`last_purchase_at` text,`active` integer DEFAULT true NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint
CREATE TABLE `purchase_history` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`ingredient_id` integer NOT NULL,`supplier_id` integer,`quantity` real NOT NULL,`price_cents` integer NOT NULL,`purchased_at` text NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action,FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint
CREATE TABLE `packaging_items` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`owner_id` text,`name` text NOT NULL,`category` text NOT NULL,`pack_quantity` real NOT NULL,`price_cents` integer NOT NULL,`supplier_id` integer,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint
CREATE TABLE `recipes` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`owner_id` text,`name` text NOT NULL,`yield_quantity` real NOT NULL,`yield_unit` text NOT NULL,`waste_percent` real DEFAULT 0 NOT NULL,`notes` text,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint
CREATE TABLE `recipe_items` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`recipe_id` integer NOT NULL,`ingredient_id` integer NOT NULL,`quantity` real NOT NULL,`unit` text NOT NULL,FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE no action,FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint
CREATE TABLE `products` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`owner_id` text,`recipe_id` integer,`name` text NOT NULL,`recipe_quantity` real NOT NULL,`labor_minutes` real DEFAULT 0 NOT NULL,`hourly_labor_cents` integer DEFAULT 0 NOT NULL,`delivery_cents` integer DEFAULT 0 NOT NULL,`commission_percent` real DEFAULT 0 NOT NULL,`tax_percent` real DEFAULT 0 NOT NULL,`target_margin_percent` real DEFAULT 50 NOT NULL,`markup` real,`include_fixed_cost` integer DEFAULT true NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint
CREATE TABLE `product_components` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`product_id` integer NOT NULL,`packaging_item_id` integer,`ingredient_id` integer,`quantity` real DEFAULT 1 NOT NULL,`component_type` text NOT NULL,FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,FOREIGN KEY (`packaging_item_id`) REFERENCES `packaging_items`(`id`) ON UPDATE no action ON DELETE no action,FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint
CREATE TABLE `fixed_expenses` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`owner_id` text,`name` text NOT NULL,`category` text NOT NULL,`monthly_cents` integer NOT NULL,`active` integer DEFAULT true NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint
CREATE TABLE `price_simulations` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`owner_id` text,`product_id` integer,`scenario` text NOT NULL,`inputs_json` text NOT NULL,`suggested_price_cents` integer NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action);
--> statement-breakpoint
CREATE TABLE `audit_records` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`owner_id` text,`kind` text NOT NULL,`payload_json` text NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
--> statement-breakpoint
CREATE INDEX `idx_ingredients_owner_name` ON `ingredients` (`owner_id`,`name`);
--> statement-breakpoint
CREATE INDEX `idx_purchase_history_ingredient_date` ON `purchase_history` (`ingredient_id`,`purchased_at`);
--> statement-breakpoint
CREATE INDEX `idx_recipes_owner_name` ON `recipes` (`owner_id`,`name`);
--> statement-breakpoint
CREATE INDEX `idx_products_owner_name` ON `products` (`owner_id`,`name`);
--> statement-breakpoint
CREATE INDEX `idx_audit_records_kind` ON `audit_records` (`kind`);
--> statement-breakpoint
PRAGMA optimize;

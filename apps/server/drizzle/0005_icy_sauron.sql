CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`type` text NOT NULL,
	`damage` integer DEFAULT 0 NOT NULL,
	`defense` integer DEFAULT 0 NOT NULL,
	`heal_amount` integer DEFAULT 0 NOT NULL,
	`price` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_inventory_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`item_type` integer NOT NULL,
	`quantity` integer NOT NULL,
	`acquired_at` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_inventory_items`("id", "player_id", "item_type", "quantity", "acquired_at") SELECT "id", "player_id", "item_type", "quantity", "acquired_at" FROM `inventory_items`;--> statement-breakpoint
DROP TABLE `inventory_items`;--> statement-breakpoint
ALTER TABLE `__new_inventory_items` RENAME TO `inventory_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_items_player_item_unique` ON `inventory_items` (`player_id`,`item_type`);
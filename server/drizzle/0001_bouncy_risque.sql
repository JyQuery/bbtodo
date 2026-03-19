CREATE TABLE `task_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`tag` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_tags_task_position_idx` ON `task_tags` (`task_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_tags_task_tag_idx` ON `task_tags` (`task_id`,`tag`);
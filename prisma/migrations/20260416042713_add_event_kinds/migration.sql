-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "assigned_host_id" INTEGER;

-- CreateTable
CREATE TABLE "event_type_co_hosts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "event_type_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_type_co_hosts_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_type_co_hosts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_event_types" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#006BFF',
    "kind" TEXT NOT NULL DEFAULT 'one-on-one',
    "max_invitees" INTEGER NOT NULL DEFAULT 1,
    "user_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "event_types_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_event_types" ("color", "created_at", "duration", "id", "name", "slug", "updated_at", "user_id") SELECT "color", "created_at", "duration", "id", "name", "slug", "updated_at", "user_id" FROM "event_types";
DROP TABLE "event_types";
ALTER TABLE "new_event_types" RENAME TO "event_types";
CREATE UNIQUE INDEX "event_types_slug_key" ON "event_types"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "event_type_co_hosts_event_type_id_user_id_key" ON "event_type_co_hosts"("event_type_id", "user_id");

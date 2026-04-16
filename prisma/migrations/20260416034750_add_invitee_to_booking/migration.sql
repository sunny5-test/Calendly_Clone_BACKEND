-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_bookings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "event_type_id" INTEGER NOT NULL,
    "invitee_id" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "start_time" DATETIME NOT NULL,
    "end_time" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "bookings_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bookings_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_bookings" ("created_at", "email", "end_time", "event_type_id", "id", "name", "start_time", "status", "updated_at") SELECT "created_at", "email", "end_time", "event_type_id", "id", "name", "start_time", "status", "updated_at" FROM "bookings";
DROP TABLE "bookings";
ALTER TABLE "new_bookings" RENAME TO "bookings";
CREATE INDEX "bookings_event_type_id_start_time_end_time_idx" ON "bookings"("event_type_id", "start_time", "end_time");
CREATE INDEX "bookings_invitee_id_idx" ON "bookings"("invitee_id");
CREATE INDEX "bookings_status_idx" ON "bookings"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

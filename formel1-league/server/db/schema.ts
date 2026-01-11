import { mysqlTable, text, serial } from "drizzle-orm/mysql-core";

export const racers = mysqlTable("racers", {
  id: serial().primaryKey(),
  name: text().notNull(),
});

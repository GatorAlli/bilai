import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  varchar,
  integer,
  uuid,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: timestamp("expires_at", {
      precision: 6,
      withTimezone: true,
    }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", {
      precision: 6,
      withTimezone: true,
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      precision: 6,
      withTimezone: true,
    }).notNull(),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      precision: 6,
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      precision: 6,
      withTimezone: true,
    }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at", {
      precision: 6,
      withTimezone: true,
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      precision: 6,
      withTimezone: true,
    }).notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", {
      precision: 6,
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", {
      precision: 6,
      withTimezone: true,
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      precision: 6,
      withTimezone: true,
    }).notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const cats = pgTable(
  "cats",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    name: text().notNull(),
    breed: text().notNull(),
    ageMonths: integer().notNull(), // Age is to be inserted in months here
    // Values come from lib/locations.ts. An area is a city neighbourhood or
    // an upazila inside the district.
    area: text().notNull(),
    district: text().notNull(),
    gender: text().notNull(),
    description: text(),
    // 'available' | 'pending' | 'adopted'
    status: text().notNull().default("available"),
    // 'yes' | 'no' | 'unknown'
    vaccinated: text().notNull().default("unknown"),
    neutered: text().notNull().default("unknown"), // spayed or neutered
    temperament: text(),
    rehomingReason: text("rehoming_reason"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("cats_status_idx").on(table.status),
    index("cats_district_idx").on(table.district),
    index("cats_breed_idx").on(table.breed),
  ],
);

export const catImages = pgTable(
  "cat_images",
  {
    id: uuid().primaryKey().defaultRandom(),
    catId: integer("cat_id")
      .notNull()
      .references(() => cats.id, { onDelete: "cascade" }),
    // Storage key/path of the uploaded file
    key: text().notNull(),
    url: text().notNull(),
    caption: text(),
    // 0 = cover photo
    position: integer().notNull(),
  },
  (table) => [index("cat_images_catId_idx").on(table.catId)],
);

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
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
  phone: text("phone").unique(),
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
    // How adopters may reach the lister. The number comes from their profile.
    contactWhatsapp: boolean("contact_whatsapp").notNull().default(false),
    contactCall: boolean("contact_call").notNull().default(false),
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
    check(
      "cats_contact_method_check",
      sql`${table.contactWhatsapp} or ${table.contactCall}`,
    ),
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
    // Shared image bytes; base64 keeps the Neon HTTP transport simple.
    data: text(),
    // 0 = cover photo
    position: integer().notNull(),
  },
  (table) => [index("cat_images_catId_idx").on(table.catId)],
);

// Chat (see docs/chat/chat_button_plan.md). One thread per pair of users, shared
// across all of one owner's cats. Threads deliberately have no foreign key to
// cats: a conversation outlives the listing that started it.
export const chatThreads = pgTable(
  "chat_threads",
  {
    id: uuid().primaryKey().defaultRandom(),
    // Ably Chat room name, "dm:<userA>:<userB>"
    roomName: text("room_name").notNull().unique(),
    // userA < userB, so a pair has one row whoever starts the chat. Sort the
    // two ids with JavaScript's `<` (code-unit order) before inserting.
    userA: text("user_a")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userB: text("user_b")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Who opened the conversation; only used to rate-limit new threads.
    startedBy: text("started_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  },
  (table) => [
    unique("chat_threads_pair_key").on(table.userA, table.userB),
    // COLLATE "C" compares bytes, matching JavaScript's `<` for the ASCII ids
    // better-auth generates. The default collation can order mixed-case ids
    // differently (e.g. "a" < "B"), which would reject valid pairs.
    check(
      "chat_threads_ordered_check",
      sql`${table.userA} collate "C" < ${table.userB} collate "C"`,
    ),
    index("chat_threads_user_b_idx").on(table.userB),
    index("chat_threads_started_by_created_idx").on(
      table.startedBy,
      table.createdAt,
    ),
  ],
);

// Postgres copy of every Ably chat message, written by the Ably webhook and
// keyed by Ably's message serial so redelivered webhooks are harmless.
export const chatMessages = pgTable(
  "chat_messages",
  {
    serial: text().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    text: text().notNull(),
    // Latest Ably version serial applied. Version serials sort as strings, so
    // an older update or delete that arrives late can be ignored.
    versionSerial: text("version_serial").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("chat_messages_thread_created_idx").on(
      table.threadId,
      table.createdAt,
    ),
  ],
);

// When each user last read each thread; drives the unread badge.
export const chatReads = pgTable(
  "chat_reads",
  {
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.threadId, table.userId] })],
);

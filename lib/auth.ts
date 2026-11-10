import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { normalizeBdPhone, PHONE_ERROR, PHONE_TAKEN_ERROR } from "@/lib/phone";

export const auth = betterAuth({
  user: {
    additionalFields: {
      phone: { type: "string", required: true },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Runs right before any new user row is written.
        before: async (user, context) => {
          const raw = String((user as { phone?: string }).phone ?? "").trim();

          // Google sign-up has no phone field. Let it through; the number is
          // collected later, when the person lists their first cat.
          // Email sign-up must always bring a valid number.
          if (!raw && context?.path !== "/sign-up/email") return;

          const phone = normalizeBdPhone(raw);
          if (!phone) throw new APIError("BAD_REQUEST", { message: PHONE_ERROR });

          const taken = await db
            .select({ id: schema.user.id })
            .from(schema.user)
            .where(eq(schema.user.phone, phone))
            .limit(1);
          if (taken.length > 0) {
            throw new APIError("BAD_REQUEST", { message: PHONE_TAKEN_ERROR });
          }

          return { data: { ...user, phone } }; // saved as 8801712345678
        },
      },
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
    autoSignIn: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
});

export const getSession = async () =>
  auth.api.getSession({
    headers: await headers(),
  });

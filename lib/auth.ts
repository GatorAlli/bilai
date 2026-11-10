import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { normalizeBdPhone, PHONE_ERROR } from "@/lib/phone";

export const auth = betterAuth({
  user: {
  additionalFields: {
    phone: { type: "string", required: true },
  },
},

databaseHooks: {
  user: {
    create: {
      before: async (user) => {
        const phone = normalizeBdPhone(String((user as { phone?: string }).phone ?? ""));
        if (!phone) throw new APIError("BAD_REQUEST", { message: PHONE_ERROR });

        const taken = await db
          .select({ id: schema.user.id })
          .from(schema.user)
          .where(eq(schema.user.phone, phone))
          .limit(1);
        if (taken.length > 0) {
          throw new APIError("BAD_REQUEST", {
            message: "An account with this phone number already exists.",
          });
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

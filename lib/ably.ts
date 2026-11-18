import "server-only";
import { createHttpClient } from "@ably/pubsub-server";

// Stateless HTTP client used only to sign token requests for browser clients
// (see app/api/ably-token/route.ts). Declaring the server side here, rather
// than in the device SDK, keeps this traffic out of Ably's monthly-active-user
// billing for the app's own backend.
export const ablyServerClient = createHttpClient({
  key: process.env.ABLY_API_KEY!,
});

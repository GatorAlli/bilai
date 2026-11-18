import { getSession } from "@/lib/auth";
import { ablyServerClient } from "@/lib/ably";

// Signs an Ably token request scoped to the signed-in user's id, so the
// browser never sees ABLY_API_KEY. Ably's client SDKs call this via
// ClientOptions.authUrl whenever they need a (new) token.
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return new Response("Not signed in", { status: 401 });
  }

  const tokenRequest = await ablyServerClient.auth.createTokenRequest({
    clientId: session.user.id,
  });

  return Response.json(tokenRequest);
}

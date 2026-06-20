import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureTrialSubscription } from "@/lib/subscription";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next") ?? "/dashboard";
  const next = nextRaw.startsWith("/") ? nextRaw : "/dashboard";

  if (code) {
    const isRecovery = next === "/reset-password";
    const fallback = isRecovery
      ? `${origin}/forgot-password?error=recovery`
      : `${origin}/login?error=oauth`;

    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;
      const isNewOAuthUser =
        !isRecovery &&
        !!user &&
        user.app_metadata?.provider === "google" &&
        user.user_metadata?.onboarding_completed !== true &&
        Date.now() - createdAt < 5 * 60 * 1000;

      if (isNewOAuthUser) {
        await supabase.auth.updateUser({
          data: {
            ...user.user_metadata,
            onboarding_started_at:
              (user.user_metadata?.onboarding_started_at as string | undefined) ??
              new Date().toISOString(),
          },
        });

        try {
          const adminSupabase = createAdminClient();
          await ensureTrialSubscription(user.id, adminSupabase);
        } catch (e) {
          console.error("ensureTrialSubscription after OAuth signup failed", e);
        }

        const onboardingResponse = NextResponse.redirect(`${origin}/onboarding`);
        response.cookies.getAll().forEach((cookie) => {
          onboardingResponse.cookies.set(cookie);
        });
        return onboardingResponse;
      }

      return response;
    }

    return NextResponse.redirect(fallback);
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}

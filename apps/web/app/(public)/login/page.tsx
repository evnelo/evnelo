import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, googleEnabled, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/ui/form-field";

export const metadata = { title: "Sign in", robots: "noindex" };

const errorText: Record<string, string> = {
  Verification: "That sign-in link has expired or was already used. Request a new one.",
  AccessDenied: "You can't sign in with that account.",
  Configuration: "Sign-in isn't configured on this instance yet. Check RESEND_API_KEY.",
  Default: "Something went wrong signing you in. Try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; sent?: string; error?: string; email?: string }> }) {
  const { next, sent, error, email } = await searchParams;
  if (await auth()) redirect(next && next.startsWith("/") ? next : "/dashboard");
  const redirectTo = next && next.startsWith("/") ? next : "/dashboard";

  async function sendLink(formData: FormData) {
    "use server";
    const address = String(formData.get("email") ?? "").trim().toLowerCase();
    const to = String(formData.get("next") ?? "/dashboard");
    try {
      await signIn("resend", { email: address, redirectTo: to, redirect: false });
    } catch (e) {
      if (e instanceof AuthError) redirect(`/login?error=${e.type}`);
      throw e;
    }
    redirect(`/login?sent=1&email=${encodeURIComponent(address)}${to !== "/dashboard" ? `&next=${encodeURIComponent(to)}` : ""}`);
  }
  async function google() {
    "use server";
    await signIn("google", { redirectTo });
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="display text-4xl">Sign in</h1>
      {sent ? (
        <div className="mt-6 rounded-lg border bg-card p-5">
          <p className="font-medium">Check your email</p>
          <p className="mt-1 text-sm text-muted-foreground">We sent a sign-in link{email ? ` to ${email}` : ""}. It works once and expires in 15 minutes.</p>
          <p className="mt-4 text-sm"><a href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="underline underline-offset-4">Use a different email</a></p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <p className="text-sm text-muted-foreground">No password. We'll email you a link that signs you in, and create your account the first time.</p>
          {error && <FormMessage error={errorText[error] ?? errorText.Default} />}
          <form action={sendLink} className="space-y-3">
            <input type="hidden" name="next" value={redirectTo} />
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" autoFocus defaultValue={email} className="mt-1.5" />
            </div>
            <Button type="submit" className="w-full">Email me a sign-in link</Button>
          </form>
          {googleEnabled && (
            <>
              <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
              <form action={google}><Button type="submit" variant="outline" className="w-full">Continue with Google</Button></form>
            </>
          )}
        </div>
      )}
    </div>
  );
}

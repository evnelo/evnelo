export const metadata = { title: "Waitlist", robots: "noindex" };

export default function OfferExpiredPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="display text-4xl">This spot is no longer reserved</h1>
      <p className="mt-3 text-sm text-muted-foreground">The offer expired or was already used. You are still on the waitlist: if another spot opens, the host can offer it to you again.</p>
    </div>
  );
}

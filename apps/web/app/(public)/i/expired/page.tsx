export const metadata = { title: "Invitation", robots: "noindex" };

export default function InviteExpiredPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="display text-4xl">This invitation is no longer valid</h1>
      <p className="mt-3 text-sm text-muted-foreground">It may have expired or been used the maximum number of times. Ask the host for a new link.</p>
    </div>
  );
}

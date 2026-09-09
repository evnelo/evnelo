export default function NoAccessPage() {
  return (
    <div>
      <h1 className="display text-3xl">No access</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your role in this organization doesn't allow that. Ask an owner or admin to change it.</p>
    </div>
  );
}

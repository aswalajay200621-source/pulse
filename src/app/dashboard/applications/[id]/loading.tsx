export default function ApplicationDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded bg-muted/50" />
      <div className="h-36 rounded-xl border border-border bg-card/50 p-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-border bg-card/50 p-4" />
        ))}
      </div>
    </div>
  );
}

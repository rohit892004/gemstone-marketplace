export default function NewsLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading market news">
      <div className="h-8 w-56 animate-pulse bg-line" />
      <div className="flex gap-2">
        <div className="h-8 w-20 animate-pulse bg-line" />
        <div className="h-8 w-16 animate-pulse bg-line" />
        <div className="h-8 w-16 animate-pulse bg-line" />
      </div>
      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-56 animate-pulse border border-line bg-surface-raised" />
        ))}
      </ul>
    </div>
  );
}

export default function ReferenceLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading the reference library">
      <div className="h-8 w-80 animate-pulse bg-line" />
      <div className="h-4 w-full max-w-2xl animate-pulse bg-line" />
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-40 animate-pulse border border-line bg-surface-raised" />
        ))}
      </ul>
    </div>
  );
}

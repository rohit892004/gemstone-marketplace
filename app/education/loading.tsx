export default function EducationLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading education and research">
      <div className="h-8 w-72 animate-pulse rounded bg-line" />
      <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-line" />
      <div className="flex gap-2">
        <div className="h-8 w-16 animate-pulse rounded-full bg-line" />
        <div className="h-8 w-24 animate-pulse rounded-full bg-line" />
        <div className="h-8 w-20 animate-pulse rounded-full bg-line" />
      </div>
      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-56 animate-pulse rounded-lg border border-line bg-surface-raised" />
        ))}
      </ul>
    </div>
  );
}

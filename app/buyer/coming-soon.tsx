/** Empty state for tabs that go live in the next update. */
export function ComingSoon({ title, empty }: { title: string; empty: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface-raised p-8 text-center">
      <h2 className="text-lg font-semibold text-ink">{empty}</h2>
      <p className="mt-2 text-sm text-ink-soft">
        {title} go live in the next update. Nothing is lost: anything you do here will show up once they are available.
      </p>
    </div>
  );
}

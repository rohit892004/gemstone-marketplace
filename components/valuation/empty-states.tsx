/** Empty states for the valuation lists. Server-safe. */
export function EmptyValuations() {
  return (
    <div className="border border-dashed border-line bg-surface-raised p-8 text-center">
      <h2 className="font-heading text-2xl text-ink">No valuation requests yet</h2>
      <p className="mt-2 text-sm text-ink-soft">Start a valuation to get an indicative estimate for a stone. You can also request one from any listing.</p>
    </div>
  );
}

export function EmptyReports() {
  return (
    <div className="border border-dashed border-line bg-surface-raised p-8 text-center">
      <h2 className="font-heading text-2xl text-ink">No saved reports yet</h2>
      <p className="mt-2 text-sm text-ink-soft">When a valuation is complete, its report and PDF appear here.</p>
    </div>
  );
}

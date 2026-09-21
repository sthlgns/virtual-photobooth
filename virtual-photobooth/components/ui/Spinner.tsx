export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-muted">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-surface/20 border-t-flash" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}
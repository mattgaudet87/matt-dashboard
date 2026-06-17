// Stub shown on nav destinations whose full UI lands in a later build phase.
export default function Placeholder({
  title,
  phase,
}: {
  title: string;
  phase: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 max-w-xs text-sm text-slate-400">
        This section gets built in {phase}. For now, head back to Today.
      </p>
    </div>
  );
}

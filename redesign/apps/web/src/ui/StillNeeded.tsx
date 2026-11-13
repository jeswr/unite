/** What a statement still needs before it passes, in plain words (from `stillNeeded()`). */
export function StillNeeded({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="font-bold text-agree">The rule the host pledged is met.</p>;
  return (
    <div>
      <h3 className="mb-1">Still needed</h3>
      <ul className="list-disc pl-6">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

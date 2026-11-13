import { EXAMPLE_BANNER_TEXT } from '@unite/shared';

/** Rule 10: shown on every page of an example assembly. */
export function ExampleBanner() {
  return (
    <div role="note" className="border-b border-unsure bg-[#fff8e1] text-ink">
      <p className="mx-auto max-w-read px-4 py-2 text-base">
        <strong>Example.</strong> {EXAMPLE_BANNER_TEXT.replace(/^Example\.\s*/, '')}
      </p>
    </div>
  );
}

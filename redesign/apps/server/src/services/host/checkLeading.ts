import { findLeadingPhrases } from '@unite/shared';

/**
 * The leading-wording check for a host's question and probes (section 6.3), phrase-list version
 * only. The AI version, `checkLeading(text)` with CHECK_LEADING_SYSTEM, belongs to the picture
 * part of the build; this is its fallback, so the host console works on its own and both can be
 * joined at merge.
 */
export interface LeadingCheck {
  leading: boolean;
  why: string;
  suggestion: string;
}

const tidy = (s: string) => {
  const t = s
    .replace(/\s+([,?.!])/g, '$1')
    .replace(/^[\s,]+/, '')
    .replace(/^that\s+/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return t ? t[0]!.toUpperCase() + t.slice(1) : t;
};

export function checkLeadingFallback(text: string): LeadingCheck {
  const found = findLeadingPhrases(text);
  if (found.length === 0) return { leading: false, why: 'No leading wording was found.', suggestion: text };
  let suggestion = text;
  for (const p of found) suggestion = suggestion.replace(new RegExp(p.replace(/'/g, "['’]").replace(/ /g, '\\s+'), 'gi'), ' ');
  suggestion = tidy(suggestion);
  const quoted = found.map((p) => `“${p}”`).join(' and ');
  return {
    leading: true,
    why: `It uses ${quoted}, which tells people the answer you expect. Ask it so that any answer is easy to give.`,
    suggestion: suggestion || text,
  };
}

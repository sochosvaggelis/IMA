/** Collapses the whitespace a paste drags along with it. */
const clean = (value: string) => value.trim().replace(/\s+/g, ' ')

/**
 * Adds what was typed into a list field to its values. Several can arrive at
 * once, separated by commas or new lines (a pasted list); one already in the
 * list in any capitalisation is skipped — "abb" and "ABB" are one maker, and
 * the spelling already there wins.
 */
export function addEntries(values: string[], text: string): { values: string[]; skipped: string[] } {
  const next = [...values]
  const skipped: string[] = []
  for (const value of text.split(/[,\n]/).map(clean).filter(Boolean)) {
    if (next.some((v) => v.toLowerCase() === value.toLowerCase())) skipped.push(value)
    else next.push(value)
  }
  return { values: next, skipped }
}

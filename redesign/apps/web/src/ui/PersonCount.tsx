/** A number of people, in words: "1 person", "48 people". */
export function personCount(n: number): string {
  return `${n} ${n === 1 ? 'person' : 'people'}`;
}

export function PersonCount({ n }: { n: number }) {
  return <span>{personCount(n)}</span>;
}

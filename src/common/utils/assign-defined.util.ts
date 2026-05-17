export function assignDefined<T extends object>(
  target: T,
  source: Partial<T>,
): void {
  for (const [key, value] of Object.entries(source) as [
    keyof T,
    T[keyof T],
  ][]) {
    if (value !== undefined) {
      target[key] = value;
    }
  }
}

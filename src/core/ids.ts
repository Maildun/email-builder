const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Random block id such as `b_k3x9q2mf`. Collision-safe for any realistic document. */
export function createId(prefix = 'b'): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  let id = `${prefix}_`;
  for (const byte of bytes) {
    id += ALPHABET[byte % ALPHABET.length];
  }
  return id;
}

/** Id that is not present in `taken`; records it there. */
export function createUniqueId(taken: Set<string>, prefix = 'b'): string {
  let id = createId(prefix);
  while (taken.has(id)) {
    id = createId(prefix);
  }
  taken.add(id);
  return id;
}

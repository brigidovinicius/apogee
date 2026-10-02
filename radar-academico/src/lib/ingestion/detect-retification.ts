export type RevisionSignal = "retification" | "extension" | "republication" | null;

export function detectRetification(text: string): RevisionSignal {
  const value = text.toLowerCase();
  if (/retificaç(ão|ões)|errata|alteração/.test(value)) return "retification";
  if (/prazo prorrogado|prorrogaç(ão|ões)|novo cronograma/.test(value)) return "extension";
  if (/republicaç(ão|ões)/.test(value)) return "republication";
  return null;
}
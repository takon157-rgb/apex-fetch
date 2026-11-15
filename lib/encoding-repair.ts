const MOJIBAKE_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  // Emoji/icon sequences in the original UI were decoded as Windows-1252 text.
  ['≡ƒòÆ', '🕒'],
  ['≡ƒôÑ', '📋'],
  ['≡ƒôè', '📊'],
  ['≡ƒÜ½', '🚫'],
  ['≡ƒÜÇ', '🚀'],
  ['≡ƒÅó', '🏢'],
  ['≡ƒôì', '📍'],
  ['≡ƒÆ░', '💰'],
  ['≡ƒÆ╝', '💼'],
  ['≡ƒÄ»', '✨'],
  ['≡ƒôä', '📂'],
  ['≡ƒöì', '🔍'],
  ['≡ƒùæ∩╕Å', '🗑️'],
  ['≡ƒùæ', '🗑️'],
  ['ΓÜá∩╕Å', '⚠️'],
  ['ΓÜí', '👋'],
  ['Γ£ô', '✓'],
  ['Γ£¿', '✍️'],
  ['Γ£à', '✅'],
  ['Γ£ò', '×'],
  ['Γ¥î', '🗑️'],
  ['Γ¡É', '🏆'],
  ['Γåù', '↗'],
  ['Γå╗', '↻'],
  ['ΓëÑ', '≥'],
  ['ΓÇª', '…'],
  ['ΓÇö', '—'],
  ['ΓÇô', '–'],
  ['├ù', '×'],
];

/** Repair known, already-committed UTF-8-as-legacy-encoding strings in UI text. */
export function repairMojibake(text: string): string {
  return MOJIBAKE_REPLACEMENTS.reduce(
    (result, [broken, replacement]) => result.split(broken).join(replacement),
    text,
  );
}

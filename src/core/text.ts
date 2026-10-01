/** « LE PUITS DE MIRA » → « Le puits de Mira »: a name in capitals, as a sentence. */
export const sentence = (name: string): string => {
  const lower = name.charAt(0) + name.slice(1).toLowerCase();
  // Proper names keep their capital.
  return lower.replace(
    /\b(mira|nhalis|ilyra|seris|kael|noa|aren|deren|ilyan|vaela)\b/g,
    (n) => n.charAt(0).toUpperCase() + n.slice(1),
  );
};

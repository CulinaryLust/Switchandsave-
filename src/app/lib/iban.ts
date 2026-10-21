/** Prüft eine IBAN per ISO-7064-Prüfsumme (Mod 97). */
export function ibanGueltig(roh: string): boolean {
  const iban = roh.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("DE") && iban.length !== 22) return false;
  const umgestellt = iban.slice(4) + iban.slice(0, 4);
  const ziffern = umgestellt.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const ch of ziffern) rest = (rest * 10 + Number(ch)) % 97;
  return rest === 1;
}

export function ibanMaskieren(roh: string): string {
  const iban = roh.replace(/\s+/g, "").toUpperCase();
  return `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`;
}

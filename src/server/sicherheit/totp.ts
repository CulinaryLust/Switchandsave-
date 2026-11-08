// Zeitbasierte Einmalpasswörter nach RFC 6238 (kompatibel mit Google Authenticator, 1Password, Authy).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Kodieren(buf: Buffer): string {
  let bits = 0;
  let wert = 0;
  let aus = "";
  for (const byte of buf) {
    wert = (wert << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      aus += ALPHABET[(wert >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) aus += ALPHABET[(wert << (5 - bits)) & 31];
  return aus;
}

export function base32Dekodieren(text: string): Buffer {
  const sauber = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let wert = 0;
  const aus: number[] = [];
  for (const z of sauber) {
    const i = ALPHABET.indexOf(z);
    if (i < 0) throw new Error("Ungültiges Base32-Zeichen im TOTP-Geheimnis.");
    wert = (wert << 5) | i;
    bits += 5;
    if (bits >= 8) {
      aus.push((wert >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(aus);
}

export function neuesGeheimnis(): string {
  return base32Kodieren(randomBytes(20));
}

export function totp(geheimnis: string, zeitMs = Date.now(), schritt = 30, stellen = 6): string {
  const zaehler = Math.floor(zeitMs / 1000 / schritt);
  const puffer = Buffer.alloc(8);
  puffer.writeBigUInt64BE(BigInt(zaehler));
  const h = createHmac("sha1", base32Dekodieren(geheimnis)).update(puffer).digest();
  const o = h[h.length - 1] & 15;
  const code = ((h.readUInt32BE(o) & 0x7fffffff) % 10 ** stellen).toString();
  return code.padStart(stellen, "0");
}

/** Prüft den Code mit einer Toleranz von einem Zeitschritt (Uhrabweichung). */
export function totpPruefen(geheimnis: string, code: string, zeitMs = Date.now()): boolean {
  const eingabe = Buffer.from(code.replace(/\s/g, ""));
  if (eingabe.length !== 6) return false;
  return [-1, 0, 1].some((d) => {
    const erwartet = Buffer.from(totp(geheimnis, zeitMs + d * 30_000));
    return timingSafeEqual(erwartet, eingabe);
  });
}

export function otpauthUri(geheimnis: string, konto: string, aussteller = "Switchandsave"): string {
  return `otpauth://totp/${encodeURIComponent(`${aussteller}:${konto}`)}?secret=${geheimnis}&issuer=${encodeURIComponent(aussteller)}&algorithm=SHA1&digits=6&period=30`;
}

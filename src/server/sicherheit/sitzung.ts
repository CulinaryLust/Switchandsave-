// Signierte Sitzungs-Cookies für den Betreiberbereich. Nutzt nur Web Crypto, damit es auch in der Middleware läuft.

export const SITZUNG_COOKIE = "sas_admin";
export const SITZUNG_DAUER_S = 8 * 60 * 60;

const ENTWICKLUNG_GEHEIMNIS = "nur-fuer-entwicklung-nicht-im-livebetrieb-verwenden";

function geheimnis(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen.");
  return ENTWICKLUNG_GEHEIMNIS;
}

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

async function hmac(text: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(geheimnis()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
}

function gleich(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sitzungErstellen(benutzer: string, jetztS = Math.floor(Date.now() / 1000)): Promise<string> {
  const nutzlast = b64url(new TextEncoder().encode(JSON.stringify({ u: benutzer, exp: jetztS + SITZUNG_DAUER_S })));
  return `${nutzlast}.${await hmac(nutzlast)}`;
}

export async function sitzungPruefen(token: string | undefined, jetztS = Math.floor(Date.now() / 1000)): Promise<string | null> {
  if (!token) return null;
  const [nutzlast, signatur] = token.split(".");
  if (!nutzlast || !signatur || !gleich(signatur, await hmac(nutzlast))) return null;
  try {
    const json = atob(nutzlast.replace(/-/g, "+").replace(/_/g, "/"));
    const { u, exp } = JSON.parse(new TextDecoder().decode(Uint8Array.from(json, (c) => c.charCodeAt(0)))) as { u: string; exp: number };
    return typeof u === "string" && typeof exp === "number" && exp > jetztS ? u : null;
  } catch {
    return null;
  }
}

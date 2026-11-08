import { beforeEach, describe, expect, it } from "vitest";
import { anmelden, sperrenZuruecksetzen } from "@/server/sicherheit/anmeldung";
import { sitzungErstellen, sitzungPruefen } from "@/server/sicherheit/sitzung";
import { base32Dekodieren, base32Kodieren, totp, totpPruefen } from "@/server/sicherheit/totp";
import { entschluesseln, verschluesseln } from "@/server/sicherheit/verschluesselung";

describe("IBAN-Verschlüsselung", () => {
  it("verschlüsselt mit Zufalls-IV und entschlüsselt verlustfrei", () => {
    const a = verschluesseln("DE02120300000000202051");
    const b = verschluesseln("DE02120300000000202051");
    expect(a).not.toContain("DE0212");
    expect(a).not.toBe(b);
    expect(entschluesseln(a)).toBe("DE02120300000000202051");
  });
  it("erkennt manipulierte Daten", () => {
    const [v, iv, tag, daten] = verschluesseln("DE02120300000000202051").split(":");
    const kaputt = [v, iv, tag, Buffer.from("x" + Buffer.from(daten, "base64url").toString("latin1"), "latin1").toString("base64url")].join(":");
    expect(() => entschluesseln(kaputt)).toThrow();
  });
});

describe("TOTP (RFC 6238)", () => {
  // Testvektor aus RFC 6238, Anhang B: Geheimnis "12345678901234567890", SHA1
  const geheimnis = base32Kodieren(Buffer.from("12345678901234567890"));
  it("kodiert Base32 umkehrbar", () => {
    expect(geheimnis).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Dekodieren(geheimnis).toString()).toBe("12345678901234567890");
  });
  it("liefert die Referenzwerte", () => {
    expect(totp(geheimnis, 59_000, 30, 8)).toBe("94287082");
    expect(totp(geheimnis, 1_111_111_109_000, 30, 8)).toBe("07081804");
    expect(totp(geheimnis, 59_000)).toBe("287082");
  });
  it("toleriert einen Zeitschritt Abweichung, nicht mehr", () => {
    const t = 1_700_000_000_000;
    expect(totpPruefen(geheimnis, totp(geheimnis, t - 30_000), t)).toBe(true);
    expect(totpPruefen(geheimnis, totp(geheimnis, t - 90_000), t)).toBe(false);
    expect(totpPruefen(geheimnis, "12345", t)).toBe(false);
  });
});

describe("Betreiber-Sitzung", () => {
  it("prüft Signatur und Ablauf", async () => {
    const token = await sitzungErstellen("admin", 1000);
    expect(await sitzungPruefen(token, 1001)).toBe("admin");
    expect(await sitzungPruefen(token, 1000 + 9 * 3600)).toBeNull();
    const [nutzlast, sig] = token.split(".");
    const fremd = Buffer.from(JSON.stringify({ u: "angreifer", exp: 99999999999 })).toString("base64url");
    expect(await sitzungPruefen(`${fremd}.${sig}`, 1001)).toBeNull();
    expect(await sitzungPruefen(`${nutzlast}.${sig.slice(0, -2)}xx`, 1001)).toBeNull();
    expect(await sitzungPruefen(undefined)).toBeNull();
  });
});

describe("Anmeldung mit zweitem Faktor", () => {
  const geheimnis = base32Kodieren(Buffer.from("12345678901234567890"));
  beforeEach(() => {
    sperrenZuruecksetzen();
    process.env.ADMIN_USER = "admin";
    process.env.ADMIN_PASSWORD = "richtig-langes-passwort";
    process.env.ADMIN_TOTP_SECRET = geheimnis;
  });
  it("verlangt Passwort und gültigen Code", () => {
    const t = 1_700_000_000_000;
    const basis = { benutzer: "admin", passwort: "richtig-langes-passwort", schluessel: "ip1" };
    expect(anmelden({ ...basis, code: "000000" }, t).ok).toBe(false);
    expect(anmelden({ ...basis, passwort: "falsch", code: totp(geheimnis, t) }, t).ok).toBe(false);
    expect(anmelden({ ...basis, code: totp(geheimnis, t) }, t).ok).toBe(true);
  });
  it("sperrt nach fünf Fehlversuchen für 15 Minuten", () => {
    const t = 1_700_000_000_000;
    for (let i = 0; i < 5; i++) anmelden({ benutzer: "admin", passwort: "falsch", code: "", schluessel: "ip2" }, t);
    const r = anmelden({ benutzer: "admin", passwort: "richtig-langes-passwort", code: totp(geheimnis, t), schluessel: "ip2" }, t);
    expect(r).toEqual({ ok: false, fehler: expect.stringContaining("Fehlversuche") });
    expect(anmelden({ benutzer: "admin", passwort: "richtig-langes-passwort", code: totp(geheimnis, t + 16 * 60_000), schluessel: "ip2" }, t + 16 * 60_000).ok).toBe(true);
  });
});

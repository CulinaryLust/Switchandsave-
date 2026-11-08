"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { anmelden } from "@/server/sicherheit/anmeldung";
import { SITZUNG_COOKIE, SITZUNG_DAUER_S, sitzungErstellen } from "@/server/sicherheit/sitzung";
import * as repo from "@/server/repo";

export type LoginState = { fehler?: string; benutzer?: string };

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "lokal";
  const r = anmelden({ benutzer: String(form.get("benutzer") ?? ""), passwort: String(form.get("passwort") ?? ""), code: String(form.get("code") ?? ""), schluessel: ip });
  repo.protokolliere({ typ: r.ok ? "admin.anmeldung" : "admin.anmeldung_fehlgeschlagen", akteur: "betreiber", data: { benutzer: String(form.get("benutzer") ?? "").slice(0, 40) } });
  if (!r.ok) return { fehler: r.fehler, benutzer: String(form.get("benutzer") ?? "").slice(0, 80) };
  (await cookies()).set(SITZUNG_COOKIE, await sitzungErstellen(r.benutzer), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SITZUNG_DAUER_S,
  });
  redirect("/admin");
}

export async function logoutAction() {
  (await cookies()).delete(SITZUNG_COOKIE);
  redirect("/admin/login");
}

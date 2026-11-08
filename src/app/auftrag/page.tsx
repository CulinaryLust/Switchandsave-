import Link from "next/link";
import { TARIFE, VERSORGER } from "@/domain/demoData";
import { berechneKosten } from "@/domain/kosten";
import { netzgebietById } from "@/domain/netzgebiet";
import * as repo from "@/server/repo";
import { vollmachtText, WIDERRUFSBELEHRUNG_KURZ } from "@/server/rechtstexte";
import { eur, parseVergleich } from "../lib/eingabe";
import { AuftragForm } from "./AuftragForm";
import { ZusatzForm } from "./ZusatzForm";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AuftragSeite({ searchParams }: Props) {
  const params = await searchParams;
  const query = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : (v ?? "")])) as Record<string, string>;
  const parsed = parseVergleich(params);
  const tarif = TARIFE.find((t) => t.id === query.tarif);
  const netz = query.netz ? netzgebietById(query.netz) : undefined;
  if (!parsed.success || !tarif || !netz) {
    return (
      <div className="notice bad">
        Unvollständige Angaben. <Link href="/vergleich">Bitte Vergleich neu starten.</Link>
      </div>
    );
  }
  const kosten = berechneKosten(tarif, netz, parsed.data.verbrauch);
  const versorger = VERSORGER.find((v) => v.id === tarif.versorgerId)!;
  const kunde = query.konto ? repo.kundeByToken(query.konto) : undefined;
  if (query.konto && !kunde) return <div className="notice bad">Kundenkonto nicht gefunden.</div>;
  const kanalFehlt = kunde && !tarif.kanaele.includes(kunde.modus === "vollmacht" ? "procheck24" : "check24_affiliate");

  return (
    <>
      <h1>Wechsel beauftragen</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          {tarif.name} <span className="muted">von {versorger.name}</span>
        </h3>
        <dl className="kv">
          <dt>Kosten im 1. Jahr</dt>
          <dd>{eur(kosten.jahreskostenErstesJahr)} (inkl. {eur(kosten.bonusImErstenJahr)} Bonus)</dd>
          <dt>Verbrauchsstelle</dt>
          <dd>
            {parsed.data.strasse}, {parsed.data.plz} ({netz.netzbetreiber})
          </dd>
          <dt>Bisheriger Versorger</dt>
          <dd>{parsed.data.versorger} (Kündigung übernimmt der neue Versorger)</dd>
        </dl>
      </div>
      {kunde && kanalFehlt && (
        <div className="notice warn">
          Dieser Tarif ist in Ihrem Servicemodell ({kunde.modus === "vollmacht" ? "Rundum-Service" : "Erinnerungsservice"}) nicht abschließbar.{" "}
          <Link href={`/vergleich?konto=${kunde.token}&sparte=${parsed.data.sparte}`}>Bitte einen anderen Tarif wählen.</Link>
        </div>
      )}
      {kunde && !kanalFehlt && (
        <ZusatzForm versteckt={query} vorname={kunde.vorname} modus={kunde.modus} ibanMaskiert={kunde.ibanMaskiert} widerruf={WIDERRUFSBELEHRUNG_KURZ} />
      )}
      {!kunde && <AuftragForm
        versteckt={query}
        vollmachtMoeglich={tarif.kanaele.includes("procheck24")}
        erinnerungMoeglich={tarif.kanaele.includes("check24_affiliate")}
        vollmachtText={vollmachtText({ vorname: "[Vorname]", nachname: "[Nachname]" })}
        widerruf={WIDERRUFSBELEHRUNG_KURZ}
      />}
    </>
  );
}

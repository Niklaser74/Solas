# Dimensas — beräkningsmotor

Svensk-först systemdesigner för Victron-baserade el-/solsystem: från **last →
dimensionering → komponentval → kabel/säkring → BOM/offert**. Det här
repositoryt innehåller i nuläget **beräkningsmotorn** (Fas 0–2 i roadmapen) —
rena, testbara funktioner som senare driver guide-UI:t, BOM och PDF-export.

> ⚠️ **Disclaimer:** Verktyget är endast ett **planeringshjälpmedel**. Alla
> resultat — särskilt kabelarea och säkringar — måste verifieras mot gällande
> standard (IEC/svensk praxis) och mot tillverkarnas datablad innan
> installation. Dimensas är ett **oberoende** verktyg för Victron-system och
> är inte kopplat till eller godkänt av Victron Energy.

## Status

Detta är grunden — **steg 1–6 + 8** som rena funktioner med enhets- och
integrationstester. Inget UI, ingen backend och inget val av molnplattform är
gjort ännu (det skjuts till en senare fas, se roadmap i projektbriefen).

## Modulkarta (`src/engine`)

| Modul | Steg | Ansvar |
|---|---|---|
| `load.ts` | 1 | Behovsanalys: apparatlista → daglig energi, topplast, surge |
| `systemVoltage.ts` | 2 | Tumregel för 12/24/48 V + override |
| `battery.ts` | 3 | Batteribank i Ah (DoD, temperaturderating, verkningsgrad) |
| `solar.ts` | 4 | Soleffekt i Wp + MPPT-kontroll |
| `inverter.ts` | 5 | Växelriktarkrav från topplast + surge |
| `distribution.ts` | 6 | DC-distribution: busbar, shunt, GX |
| `cable.ts` | 8 | **Kabelarea + spänningsfall + säkring** (kvalitetsstämpeln) |
| `units.ts` | — | Delade konstanter (resistivitet, IEC-areor, ampacitet, säkringar) |
| `index.ts` | 1→8 | `designSystem()` som trär ihop stegen |

Datamodellen (komponent, projekt, zon, placering, **kabeldragning**) finns i
`src/data/types.ts`, med en illustrativ Victron-seed i `src/data/seed.ts`.
Den kurerade komponentdatabasen — produktens moat — byggs i Fas 1.

## Designprinciper

- **Rena funktioner, inga sidoeffekter** → triviala att enhetstesta.
- **Svensk/nordisk praxis:** IEC (inte ABYC/NEC), temperaturderating, snöfaktor,
  värsta-månad-soltimmar för off-grid.
- **Fram + retur dubblas automatiskt** i spänningsfallsberäkningen
  (`Vdrop = 2·L·I·ρ / A`).
- **Säkringen skyddar kabeln:** `sizeCableSegment()` väljer säkring från lasten
  och dimensionerar sedan kabeln så att dess ampacitet ≥ säkringen.
- **Identifierare på engelska, dokumentation och etiketter på svenska.**

## Kör

```bash
npm install
npm run test:run   # enhets- + integrations- + datavalideringstester
npm run typecheck  # strikt TypeScript
```

## Exempel

```ts
import { designSystem } from "./src/engine/index.js";

const result = designSystem({
  appliances: [
    { name: "Kylskåp", watt: 45, hoursPerDay: 24, surgeWatt: 135 },
    { name: "LED", watt: 10, hoursPerDay: 4, quantity: 4 },
  ],
  battery: { autonomyDays: 3, dod: 0.5, tempFactor: 0.9 },
  solar: { peakSunHoursWorstMonth: 1.5, snowFactor: 0.7 },
  mainCable: { lengthM: 2.5 },
});

result.battery.requiredAh;          // Ah-behov
result.mainCable.area.selectedAreaMm2; // vald kabelarea (mm²)
result.mainCable.fuse.ratingA;      // säkring (A)
```

## Roadmap (kommande faser)

- **Fas 3:** Guide-UI (PWA/React) + BOM/PDF-export, off-grid stuga/husbil.
- **Fas 3b:** Fysisk layout-planerare (Steg 7) — 2D zon-canvas, kabeldragning
  → längder matar Steg 8.
- **Fas 4:** Konton + Stripe.
- **Fas 5:** Installatörsläge: white-label, grönt avdrag-netto, kundbibliotek.

Se projektbriefen för fullständig vision, affärsmodell och risker.

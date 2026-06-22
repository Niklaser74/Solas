/**
 * Komponent-selektion — rena, delade funktioner.
 *
 * Returnerar de katalogkomponenter som är *kompatibla* med ett
 * dimensioneringsresultat, sorterade så att det första elementet är det som
 * auto-väljs (minsta passande). Både `assembleBom` (auto = `[0]`) och guidens
 * modellväljare (hela listan) använder dessa så att logiken har en sanning.
 */

import type { DesignSystemResult } from "../engine/index.js";
import type { Component } from "../data/types.js";
import { SEED_COMPONENTS } from "../data/seed.js";

export function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function byType(components: readonly Component[], typ: Component["typ"]): Component[] {
  return components.filter((c) => c.typ === typ);
}

/** Växelriktare: rätt systemspänning, klarar kontinuerlig + surge. Minsta först. */
export function eligibleInverters(
  design: DesignSystemResult,
  components: readonly Component[] = SEED_COMPONENTS,
): Component[] {
  const vsys = design.systemVoltage.voltage;
  return byType(components, "inverter")
    .filter((c) => (num(c.specs.systemVoltageV) ?? vsys) === vsys)
    .filter((c) => (num(c.specs.continuousW) ?? 0) >= design.inverter.requiredContinuousW)
    .filter((c) => {
      const surge = num(c.specs.surgeW);
      return surge === undefined || surge >= design.inverter.requiredSurgeW;
    })
    .sort((a, b) => (num(a.specs.continuousW) ?? 0) - (num(b.specs.continuousW) ?? 0));
}

/** Shuntar (accessory med maxCurrentA) som klarar märkströmmen. Minsta först. */
export function eligibleShunts(
  design: DesignSystemResult,
  components: readonly Component[] = SEED_COMPONENTS,
): Component[] {
  return byType(components, "accessory")
    .filter((c) => num(c.specs.maxCurrentA) !== undefined)
    .filter((c) => (num(c.specs.maxCurrentA) ?? 0) >= design.distribution.shuntRatingA)
    .sort((a, b) => (num(a.specs.maxCurrentA) ?? 0) - (num(b.specs.maxCurrentA) ?? 0));
}

/** Huvudkablar (metervara) med tillräcklig area. Minsta först. Tom om area saknas. */
export function eligibleCables(
  design: DesignSystemResult,
  components: readonly Component[] = SEED_COMPONENTS,
): Component[] {
  const area = design.mainCable.area.selectedAreaMm2;
  if (area === null) return [];
  return byType(components, "cable")
    .filter((c) => (num(c.specs.areaMm2) ?? 0) >= area)
    .sort((a, b) => (num(a.specs.areaMm2) ?? 0) - (num(b.specs.areaMm2) ?? 0));
}

/** Säkringar med tillräcklig märkström. Minsta först. Tom om behov saknas. */
export function eligibleFuses(
  design: DesignSystemResult,
  components: readonly Component[] = SEED_COMPONENTS,
): Component[] {
  const rating = design.mainCable.fuse.ratingA;
  if (rating === null) return [];
  return byType(components, "fuse")
    .filter((c) => (num(c.specs.ratingA) ?? 0) >= rating)
    .sort((a, b) => (num(a.specs.ratingA) ?? 0) - (num(b.specs.ratingA) ?? 0));
}

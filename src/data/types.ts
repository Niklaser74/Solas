/**
 * Datamodell (utkast enligt projektbrief §4).
 *
 * Komponentdatabasen är produktens moat — kurerad, underhållen Victron-
 * specdata. Typerna här är skelettet; den faktiska databasen byggs i Fas 1.
 *
 * `Zon`, `Placering` och `Kabeldragning` finns med redan nu (även om den
 * fysiska layout-planeraren är Fas 3b) så att den inte blir en retrofit —
 * `Kabeldragning` är ett förstklassigt objekt från start (brief §5).
 */

import type { SystemVoltage } from "../engine/units.js";

/** Komponenttyp i databasen. */
export type ComponentType =
  | "mppt"
  | "inverter"
  | "battery"
  | "panel"
  | "gx"
  | "cable"
  | "fuse"
  | "busbar"
  | "accessory";

/** Kategori för grönt avdrag (brief §6). */
export type GreenTechCategory = "sol" | "batteri" | "laddbox" | "ingen";

/** Anslutningstyp/pol på en komponent. */
export type ConnectionType =
  | "dc_plus"
  | "dc_minus"
  | "pv_plus"
  | "pv_minus"
  | "ac_in"
  | "ac_out"
  | "ve_bus"
  | "ve_direct"
  | "ve_can";

/** En anslutningspunkt på en komponent (position + typ). */
export interface ConnectionPoint {
  /** Stabil identifierare inom komponenten, t.ex. "batt+". */
  id: string;
  typ: ConnectionType;
  /** Position relativt komponentens övre vänstra hörn, mm. */
  x: number;
  y: number;
}

/** Fysiska mått, mm. */
export interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

/** Monteringskrav (clearance/orientering). */
export interface MountingRequirements {
  /** Fritt utrymme runt komponenten, mm (för ventilation/kylning). */
  clearanceMm?: number;
  /** Krävd orientering, t.ex. "stående". */
  orientation?: string;
}

/**
 * En komponent i databasen. `specs` är avsiktligt löst typad (jsonb i
 * lagret) men kärnfälten är explicita för validering.
 */
export interface Component {
  id: string;
  typ: ComponentType;
  modell: string;
  /** Victron-artikelnummer, t.ex. "SCC110512000". */
  victronArtikelnr?: string;
  /** Fritt specblock (V, A, W, Wp, Ah, kapacitet, anslutningar...). */
  specs: Record<string, number | string | boolean>;
  matt?: Dimensions;
  anslutningspunkter?: ConnectionPoint[];
  monteringskrav?: MountingRequirements;
  /**
   * Produktbild som ritas i layouten i stället för en platshållare. Lagras
   * normalt som en (nedskalad) data-URL för egna produkter, men kan vara vilken
   * bild-URL som helst.
   */
  bildUrl?: string;
  /** Pris i SEK. */
  prisSek: number;
  aterforsaljare?: string;
  gronTeknikKategori: GreenTechCategory;
}

/** Projekttyp. */
export type ProjectType = "stuga" | "husbil" | "bat" | "villa" | "offgrid";

/** Ett sparat projekt. */
export interface Project {
  id: string;
  userId: string;
  namn: string;
  typ: ProjectType;
  systemVoltage: SystemVoltage;
  /** Lastdata (apparatlista m.m.), löst typad i lagret. */
  last: Record<string, unknown>;
  /** Platsdata (lat/long/instrålning). */
  platsdata?: Record<string, unknown>;
  /** Valda komponent-id:n. */
  valdaKomponenter: string[];
  skapad: string;
  uppdaterad: string;
}

/** En fysisk yta i ett projekt (fri yta som användaren ritar). */
export interface Zone {
  id: string;
  projektId: string;
  namn: string;
  /** Mått, mm. */
  width: number;
  height: number;
  typ: "plat" | "fack" | "motorrum" | "vagg";
}

/** En komponent placerad på en zon. */
export interface Placement {
  id: string;
  zonId: string;
  komponentId: string;
  /** Position på zonen, mm. */
  x: number;
  y: number;
  /** Rotation i grader. */
  rotation: number;
}

/**
 * En kabelrun mellan två anslutningspunkter (förstklassigt objekt redan i
 * v1). `beraknadLangd` matar Steg 8.
 */
export interface CableRun {
  id: string;
  projektId: string;
  /** Från placering + pol. */
  fran: { placeringId: string; polId: string };
  /** Till placering + pol. */
  till: { placeringId: string; polId: string };
  /** Dragväg som polyline, mm. Tom i v1 (manuell längd). */
  path: Array<{ x: number; y: number }>;
  /** Slack i procent (böjradie/marginal). */
  slackProcent: number;
  /** Beräknad enkelvägslängd, m (matar Steg 8). */
  beraknadLangd: number;
  /** Kabeltyp och area (fylls från Steg 8). */
  kabeltyp?: string;
  areaMm2?: number;
}

/** Abonnemangsnivå. */
export type Plan = "free" | "privat" | "installator";

/** Användare/tenant. */
export interface User {
  id: string;
  plan: Plan;
  org?: string;
  /** White-label-branding för installatörsläge. */
  branding?: Record<string, unknown>;
}

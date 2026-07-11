import type { FlightResult, ReturnItinerary } from "../api";
import type { GlobeArc, GlobePoint } from "pandora-components-web/globe";

// Both the outbound (FlightResult) and the return itinerary carry the leg/geo
// fields these mappers read; a full FlightResult is assignable to this.
type Itinerary = ReturnItinerary;

// App-side mapping: turn flight itineraries into the generic GeoGlobe {arcs,points}
// shape. Outbound = sky blue, Return = amber. Keeps all FlightResult coupling here
// (out of the generic globe component).
const OUT = { arc: ["rgba(56,189,248,0.95)", "rgba(125,211,252,0.35)"] as [string, string], marker: 0xeaf6ff };
const RET = { arc: ["rgba(251,146,60,0.95)", "rgba(253,186,116,0.4)"] as [string, string], marker: 0xffd8a8 };

function legArcs(r: Itinerary, style: typeof OUT): GlobeArc[] {
  return r.legs.map((l) => ({
    from: { lat: l.fromLat, lng: l.fromLon },
    to: { lat: l.toLat, lng: l.toLon },
    color: style.arc,
    animateMarker: true,
    markerColor: style.marker,
    durationMs: Math.min(14000, Math.max(5000, ((l.durationMinutes || 120) / 70) * 1000)),
  }));
}

export function itineraryArcs(out: FlightResult | null, ret?: Itinerary | null): GlobeArc[] {
  const arcs: GlobeArc[] = [];
  if (out?.legs?.length) arcs.push(...legArcs(out, OUT));
  if (ret?.legs?.length) arcs.push(...legArcs(ret, RET));
  return arcs;
}

export function itineraryPoints(out: FlightResult | null, ret?: Itinerary | null): GlobePoint[] {
  const pts: GlobePoint[] = [];
  if (out?.legs?.length) {
    const first = out.legs[0];
    pts.push({ lat: first.fromLat, lng: first.fromLon, label: `${first.fromCity} (${first.from})`, color: "#34d399" });
    out.legs.slice(1).forEach((l) =>
      pts.push({ lat: l.fromLat, lng: l.fromLon, label: `Layover · ${l.fromCity} (${l.from})`, color: "#fbbf24" })
    );
    const last = out.legs[out.legs.length - 1];
    pts.push({ lat: last.toLat, lng: last.toLon, label: `${last.toCity} (${last.to})`, color: "#f87171" });
  }
  if (ret?.legs?.length) {
    ret.legs.slice(1).forEach((l) =>
      pts.push({ lat: l.fromLat, lng: l.fromLon, label: `Return layover · ${l.fromCity} (${l.from})`, color: "#fb923c" })
    );
  }
  return pts;
}

import { useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";

/**
 * GeoGlobe (ui.geo-globe) — one data-driven 3D globe for the whole fleet.
 *
 * Renders BOTH weighted points (finance-tracker's activity map) AND great-circle
 * arcs with an optional craft marker animated along any arc (flight-scanner's
 * route view). Zero app-domain coupling — the caller maps its data into the
 * {points, arcs} shape and supplies its own hover-tooltip HTML / imagery.
 *
 * Heavy deps (react-globe.gl + three) are PEER dependencies and this component is
 * exported only from the `pandora-components-web/globe` subpath, so apps that
 * don't render a globe never pull three.js. react-globe.gl can't render under
 * jsdom — lazy-import + mock this module in unit tests.
 *
 * Merged from flight-scanner's GeoGlobe (superset) + finance-tracker's points
 * globe (hover tooltips, transparent background, configurable atmosphere).
 */

const RAD = Math.PI / 180;

export interface GlobePoint {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  /** 0..1 — drives dot radius/altitude for weighted-point use. */
  weight?: number;
  /** Arbitrary caller payload, available to pointLabelHtml for rich tooltips. */
  [key: string]: unknown;
}

export interface GlobeArc {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  /** Solid color or a [start,end] gradient. */
  color?: string | [string, string];
  /** Animate a marker mesh flying along this arc, looping. */
  animateMarker?: boolean;
  /** three.js hex color for the animated marker. */
  markerColor?: number;
  /** Marker loop period in ms (longer arcs typically slower). */
  durationMs?: number;
}

export interface GeoGlobeProps {
  points?: GlobePoint[];
  arcs?: GlobeArc[];
  globeImageUrl?: string;
  bumpImageUrl?: string;
  /** Background image. Omit (and set backgroundColor) for a transparent globe. */
  backgroundImageUrl?: string;
  backgroundColor?: string;
  showAtmosphere?: boolean;
  atmosphereColor?: string;
  atmosphereAltitude?: number;
  /** Hover tooltip HTML for a point (finance's money/visits card). When set, the
   *  floating 3D text labels are suppressed in favor of hover tooltips. */
  pointLabelHtml?: (p: GlobePoint) => string;
  /** Fixed pixel height. Omit to fill the parent (h-full w-full). */
  height?: number;
}

function gcInterp(lat1: number, lon1: number, lat2: number, lon2: number, t: number): [number, number] {
  const φ1 = lat1 * RAD, λ1 = lon1 * RAD, φ2 = lat2 * RAD, λ2 = lon2 * RAD;
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d === 0) return [lat1, lon1];
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return [Math.atan2(z, Math.sqrt(x * x + y * y)) / RAD, Math.atan2(y, x) / RAD];
}

function angularDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = lat1 * RAD, φ2 = lat2 * RAD, dφ = (lat2 - lat1) * RAD, dλ = (lon2 - lon1) * RAD;
  return 2 * Math.asin(Math.sqrt(Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2));
}

function makeMarker(color: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.2, 14), mat);
  body.geometry.rotateX(Math.PI / 2);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.18, 1.1), mat);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 0.7), mat);
  tail.position.z = -1.7;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.8), mat);
  fin.position.z = -1.7;
  fin.position.y = 0.4;
  g.add(body, wing, tail, fin);
  return g;
}

const DEFAULT_GRADIENT = ["rgba(56,189,248,0.95)", "rgba(125,211,252,0.35)"];

export function GeoGlobe({
  points = [],
  arcs = [],
  globeImageUrl = "/earth-blue-marble.jpg",
  bumpImageUrl = "/earth-topology.png",
  backgroundImageUrl,
  backgroundColor = "rgba(0,0,0,0)",
  showAtmosphere = true,
  atmosphereColor = "#5eb1ef",
  atmosphereAltitude = 0.2,
  pointLabelHtml,
  height,
}: GeoGlobeProps) {
  const globeRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<THREE.Group[]>([]);
  const rafRef = useRef<number | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: height ?? el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  const arcData = useMemo(
    () =>
      arcs.map((a) => ({
        startLat: a.from.lat, startLng: a.from.lng, endLat: a.to.lat, endLng: a.to.lng,
        color: a.color ?? DEFAULT_GRADIENT,
      })),
    [arcs]
  );

  const pointData = useMemo(
    () => points.map((p) => ({ ...p, radius: 0.3 + (p.weight ?? 0.35) * 0.6 })),
    [points]
  );

  // Animate a marker mesh along each arc flagged animateMarker.
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const cleanup = () => {
      const g = globeRef.current;
      markersRef.current.forEach((m) => {
        g?.scene?.().remove(m);
        m.traverse((o: any) => {
          o.geometry?.dispose?.();
          o.material?.dispose?.();
        });
      });
      markersRef.current = [];
    };
    cleanup();

    const flying = arcs.filter((a) => a.animateMarker);
    if (!flying.length) return;

    const segs = flying.map((a) => ({
      a,
      peak: Math.max(0.12, 0.5 * (angularDistance(a.from.lat, a.from.lng, a.to.lat, a.to.lng) / Math.PI)),
      period: (a.durationMs ?? 7000) / 1000,
    }));

    let tries = 0;
    const start = (ts0: number) => {
      const g = globeRef.current;
      if (!g || typeof g.getCoords !== "function" || typeof g.scene !== "function") {
        if (tries++ < 120) rafRef.current = requestAnimationFrame(() => start(ts0));
        return;
      }
      const scene = g.scene();
      markersRef.current = segs.map((s) => {
        const m = makeMarker(s.a.markerColor ?? 0xeaf6ff);
        scene.add(m);
        return m;
      });
      (window as any).__geoGlobeMarkers = markersRef.current;

      const tmp = new THREE.Vector3();
      const animate = (ts: number) => {
        const elapsed = (ts - ts0) / 1000;
        segs.forEach((s, i) => {
          const m = markersRef.current[i];
          if (!m) return;
          const t = (elapsed / s.period) % 1;
          const tn = Math.min(1, t + 0.012);
          const [lat, lon] = gcInterp(s.a.from.lat, s.a.from.lng, s.a.to.lat, s.a.to.lng, t);
          const [latN, lonN] = gcInterp(s.a.from.lat, s.a.from.lng, s.a.to.lat, s.a.to.lng, tn);
          const alt = s.peak * Math.sin(Math.PI * t) + 0.01;
          const altN = s.peak * Math.sin(Math.PI * tn) + 0.01;
          const c = g.getCoords(lat, lon, alt);
          const cN = g.getCoords(latN, lonN, altN);
          m.position.set(c.x, c.y, c.z);
          tmp.set(cN.x, cN.y, cN.z);
          m.lookAt(tmp);
        });
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame((ts) => start(ts));
    return cleanup;
  }, [arcs]);

  // Frame all geometry (spherical centroid handles the antimeridian); idle auto-rotate.
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const coords: [number, number][] = [];
    arcs.forEach((a) => coords.push([a.from.lat, a.from.lng], [a.to.lat, a.to.lng]));
    points.forEach((p) => coords.push([p.lat, p.lng]));
    try {
      const c = g.controls();
      c.autoRotate = coords.length === 0;
      c.autoRotateSpeed = 0.35;
    } catch {
      /* not ready */
    }
    if (!coords.length) return;
    let x = 0, y = 0, z = 0;
    coords.forEach(([la, lo]) => {
      x += Math.cos(la * RAD) * Math.cos(lo * RAD);
      y += Math.cos(la * RAD) * Math.sin(lo * RAD);
      z += Math.sin(la * RAD);
    });
    x /= coords.length; y /= coords.length; z /= coords.length;
    const lng = Math.atan2(y, x) / RAD;
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) / RAD;
    let maxAngle = 0;
    for (let i = 0; i < coords.length; i++)
      for (let j = i + 1; j < coords.length; j++)
        maxAngle = Math.max(maxAngle, angularDistance(coords[i][0], coords[i][1], coords[j][0], coords[j][1]) / RAD);
    const altitude = Math.min(3.4, Math.max(1.5, 1.2 + maxAngle / 55));
    try {
      g.pointOfView({ lat, lng, altitude }, 1200);
    } catch {
      /* ignore */
    }
  }, [arcs, points]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const showFloatingLabels = !pointLabelHtml;

  return (
    <div ref={wrapRef} className="w-full" style={height ? { height } : { height: "100%" }}>
      {size.w > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          globeImageUrl={globeImageUrl}
          bumpImageUrl={bumpImageUrl}
          backgroundImageUrl={backgroundImageUrl}
          backgroundColor={backgroundColor}
          showAtmosphere={showAtmosphere}
          atmosphereColor={atmosphereColor}
          atmosphereAltitude={atmosphereAltitude}
          arcsData={arcData}
          arcColor={(d: any) => d.color}
          arcStroke={0.5}
          arcDashLength={0.4}
          arcDashGap={0.12}
          arcDashAnimateTime={4000}
          arcAltitudeAutoScale={0.5}
          pointsData={pointData}
          pointLat="lat"
          pointLng="lng"
          pointColor={(d: any) => d.color ?? "#38bdf8"}
          pointAltitude={(d: any) => 0.012 + 0.55 * (d.weight ?? 0)}
          pointRadius={(d: any) => d.radius}
          pointLabel={pointLabelHtml ? (d: any) => pointLabelHtml(d as GlobePoint) : undefined}
          labelsData={showFloatingLabels ? pointData.filter((p: any) => p.label) : []}
          labelLat="lat"
          labelLng="lng"
          labelText="label"
          labelColor={() => "#e2e8f0"}
          labelSize={0.9}
          labelDotRadius={0.32}
          labelResolution={2}
        />
      )}
    </div>
  );
}

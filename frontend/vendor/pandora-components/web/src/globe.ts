// pandora-components-web/globe — heavy 3D globe, kept out of the main barrel so
// apps that don't render a globe never pull react-globe.gl + three (both optional
// peer deps). Import from "pandora-components-web/globe".
export { GeoGlobe } from "./components/GeoGlobe";
export type { GeoGlobeProps, GlobePoint, GlobeArc } from "./components/GeoGlobe";

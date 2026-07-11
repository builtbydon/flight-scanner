import { useEffect, useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { Card, Spinner } from "pandora-components-web";
import { getDestination, type DestinationInfo } from "../api";

const TYPE_LABEL: Record<string, string> = {
  attraction: "Attraction",
  museum: "Museum",
  viewpoint: "Viewpoint",
  artwork: "Artwork",
  gallery: "Gallery",
  theme_park: "Theme park",
  zoo: "Zoo",
  aquarium: "Aquarium",
  monument: "Monument",
  memorial: "Memorial",
  castle: "Castle",
  ruins: "Ruins",
  archaeological_site: "Historic site",
  park: "Park",
  nature_reserve: "Nature reserve",
  garden: "Garden",
};

export function DestinationPanel({ iata, city }: { iata: string; city: string }) {
  const [info, setInfo] = useState<DestinationInfo | null | "loading">("loading");

  useEffect(() => {
    let alive = true;
    setInfo("loading");
    getDestination(iata)
      .then((d) => alive && setInfo(d))
      .catch(() => alive && setInfo(null));
    return () => {
      alive = false;
    };
  }, [iata]);

  if (info === "loading") {
    return (
      <Card padded={false} className="flex items-center gap-2 p-4 text-xs text-text-muted">
        <Spinner size={13} /> Loading things to do in {city}…
      </Card>
    );
  }

  if (!info) {
    return (
      <Card padded={false} className="p-4">
        <p className="text-xs text-text-muted">No destination info available for {city}.</p>
      </Card>
    );
  }

  return (
    <Card padded={false} className="p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="mt-0.5 shrink-0 text-brand-400" />
          <div>
            <p className="text-sm font-semibold text-text-primary">{info.city}</p>
            <p className="text-xs text-text-muted">{info.country}</p>
          </div>
        </div>
        {info.wikivoyageUrl && (
          <a
            href={info.wikivoyageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300"
          >
            Wikivoyage <ExternalLink size={11} />
          </a>
        )}
      </div>

      {info.summary && (
        <p className="mb-3 text-[12px] leading-relaxed text-text-secondary line-clamp-4">
          {info.summary}
        </p>
      )}

      {info.attractions.length > 0 && (
        <>
          <p className="mb-2 text-xs font-semibold text-text-primary">Things to do nearby</p>
          <ul className="space-y-1">
            {info.attractions.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-xs">
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 text-text-secondary hover:text-brand-300"
                  >
                    <span className="truncate">{a.name}</span>
                    <ExternalLink size={10} className="shrink-0" />
                  </a>
                ) : (
                  <span className="min-w-0 truncate text-text-secondary">{a.name}</span>
                )}
                <span className="shrink-0 text-[10px] text-text-muted">
                  {a.distKm != null ? `${a.distKm} km` : (a.type ? (TYPE_LABEL[a.type] ?? a.type) : "")}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {info.attractions.length === 0 && !info.summary && (
        <p className="text-xs text-text-muted">No attraction data found for this area.</p>
      )}
    </Card>
  );
}

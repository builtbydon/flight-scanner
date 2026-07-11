import { useEffect, useMemo, useState } from "react";
import { Plane, PlaneTakeoff, ExternalLink } from "lucide-react";
import { Button, Card, EmptyState, PageShell, useToast } from "pandora-components-web";
import { searchFlights, type FlightResult, type SearchParams, type SearchResponse } from "./api";
import { SearchForm } from "./components/SearchForm";
import { ResultsList, sortFlightResults } from "./components/ResultsList";
import { GeoGlobe } from "pandora-components-web/globe";
import { LegTimeline } from "./components/LegTimeline";
import { AirlineCard } from "./components/AirlineCard";
import { googleFlightsUrl, kayakUrl } from "./lib/booking";
import { itineraryArcs, itineraryPoints } from "./lib/globeData";
import { DestinationPanel } from "./components/DestinationPanel";

export default function App() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [selected, setSelected] = useState<FlightResult | null>(null);
  const [activeMaxStops, setActiveMaxStops] = useState<number | null>(null);

  const visibleResults = useMemo(() => {
    if (!data) return [];
    if (activeMaxStops == null) return data.results;
    return data.results.filter((result) => result.stops <= activeMaxStops);
  }, [data, activeMaxStops]);

  useEffect(() => {
    if (!data) return;
    if (selected && visibleResults.some((result) => result.id === selected.id)) return;
    setSelected(sortFlightResults(visibleResults)[0] ?? null);
  }, [data, selected, visibleResults]);

  const onSearch = async (p: SearchParams) => {
    const nextMaxStops = p.maxStops ?? null;
    setActiveMaxStops(nextMaxStops);
    setLoading(true);
    setSelected(null);
    try {
      const res = await searchFlights(p);
      setData(res);
      const nextVisibleResults = nextMaxStops == null
        ? res.results
        : res.results.filter((result) => result.stops <= nextMaxStops);
      setSelected(sortFlightResults(nextVisibleResults)[0] ?? null);
      if (res.notice) toast.info(res.notice);
    } catch (e: any) {
      toast.error(e?.message || "Search failed.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const openLink = (url: string) => window.open(url, "_blank", "noopener,noreferrer");
  const activeQuery = data ? { ...data.query, maxStops: activeMaxStops } : null;

  // Distinct airline codes across the selected outbound (and return) legs, so we
  // can show each carrier's experience card for the chosen itinerary.
  const airlineCodes = selected
    ? Array.from(
        new Set(
          [...selected.legs, ...(data?.returnItinerary?.legs ?? [])]
            .map((l) => l.airlineCode)
            .filter(Boolean),
        ),
      )
    : [];

  return (
    <PageShell title="Flight Scanner" icon={<Plane size={18} />}>
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <p className="mb-4 text-xs text-text-muted">
          Visual flight search — map your route, compare times, and jump straight to booking.
        </p>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
          {/* Left column: search + results */}
          <div className="space-y-4">
            <SearchForm
              onSearch={onSearch}
              loading={loading}
              onMaxStopsChange={setActiveMaxStops}
            />
            {data && (
              <ResultsList results={visibleResults} selectedId={selected?.id ?? null} onSelect={setSelected} />
            )}
          </div>

          {/* Right column: globe + itinerary detail */}
          <div className="space-y-4">
            <div className="relative h-[360px] overflow-hidden rounded-lg border border-surface-700/50 bg-surface-950 sm:h-[460px]">
              <GeoGlobe
                arcs={itineraryArcs(selected, data?.returnItinerary)}
                points={itineraryPoints(selected, data?.returnItinerary)}
              />
              {data?.returnItinerary && (
                <div className="absolute left-3 top-3 z-[500] flex gap-3 rounded-lg bg-surface-900/80 px-3 py-1.5 text-[11px] backdrop-blur">
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-full bg-sky-400" />Outbound</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-full bg-orange-400" />Return</span>
                </div>
              )}
            </div>

            {selected ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card padded title={`${data?.query.originCity} → ${data?.query.destinationCity} · ${selected.priceText}`}>
                  <LegTimeline result={selected} />

                  {data?.returnItinerary && (
                    <div className="mt-4 border-t border-surface-700/40 pt-3">
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-orange-300">
                        <span className="inline-block h-2 w-3 rounded-full bg-orange-400" />
                        Return · {data.query.destinationCity} → {data.query.originCity}
                        {data.query.returnDate && (
                          <span className="text-xs font-normal text-text-muted">on {data.query.returnDate}</span>
                        )}
                      </h3>
                      <LegTimeline result={data.returnItinerary} />
                      <p className="mt-2 text-[10px] text-text-muted">
                        Representative return flight for your date (drawn in orange on the globe). Round-trip
                        pricing is bundled by Google across your outbound choice, so no separate return price is shown.
                      </p>
                    </div>
                  )}

                  {data && (() => {
                    const gfUrl = selected.bookingUrl || data.bookingUrl || googleFlightsUrl(activeQuery ?? data.query);
                    const kkUrl = kayakUrl(activeQuery ?? data.query, selected);
                    const toBookingOptions = gfUrl.includes("/travel/flights/booking");
                    return (
                    <div className="mt-4 border-t border-surface-700/40 pt-3">
                      <p className="mb-2 text-xs font-semibold text-text-secondary">Book this flight</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" icon={<ExternalLink size={13} />} data-href={gfUrl} onClick={() => openLink(gfUrl)}>
                          {toBookingOptions ? "Book on Google Flights" : "Open on Google Flights"}
                        </Button>
                        <Button size="sm" variant="secondary" icon={<ExternalLink size={13} />} data-href={kkUrl} onClick={() => openLink(kkUrl)}>
                          Search on Kayak
                        </Button>
                      </div>
                      <p className="mt-2 text-[10px] text-text-muted">
                        {toBookingOptions ? (
                          <>
                            Opens Google Flights straight to <strong>this exact flight's booking options</strong>
                            {selected.legs[0]?.flightNumber ? <> ({selected.airlines.join(" / ")} {selected.legs[0].flightNumber})</> : null}
                            {" "}— the list of places to book it. Kayak opens filtered to the same flight.
                          </>
                        ) : (
                          <>
                            Opens Google Flights and Kayak filtered to this itinerary — route, date, cabin
                            {selected.airlines.length ? <>, and {selected.airlines.join(" / ")}</> : null}
                            {selected.stops === 0 ? ", nonstop" : null} — so your selected flight is right at the top.
                            {" "}(Round trips and connections can't deep-link to a single booking page, so you make the final pick there.)
                          </>
                        )}
                      </p>
                    </div>
                    );
                  })()}
                </Card>

                <div className="space-y-3">
                  <h2 className="text-sm font-bold text-text-primary">Airline experience</h2>
                  {airlineCodes.length ? (
                    airlineCodes.map((code) => <AirlineCard key={code} code={code} />)
                  ) : (
                    <p className="text-xs text-text-muted">No airline code resolved for this itinerary.</p>
                  )}

                  {data?.query.destination && (
                    <>
                      <h2 className="pt-1 text-sm font-bold text-text-primary">
                        Things to do · {data.query.destinationCity}
                      </h2>
                      <DestinationPanel
                        iata={data.query.destination}
                        city={data.query.destinationCity ?? data.query.destination}
                      />
                    </>
                  )}
                </div>
              </div>
            ) : (
              <Card padded={false} className="py-10">
                <EmptyState
                  icon={<PlaneTakeoff size={28} />}
                  title="Plot a flight on the globe"
                  message="Search a route and date, then pick a result to see its map, layovers, times, and booking links."
                />
              </Card>
            )}

            {data && (
              <p className="text-right text-[10px] text-text-muted">
                source: {data.source}
                {data.cached ? " · cached" : ""}
              </p>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

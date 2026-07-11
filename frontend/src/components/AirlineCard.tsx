import { useEffect, useState } from "react";
import { Badge, Card, Spinner } from "pandora-components-web";
import { getAirline, type AirlineCardData } from "../api";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-surface-700/40 py-1.5 text-xs">
      <span className="text-text-muted">{label}</span>
      <span className="text-right text-text-secondary">{value}</span>
    </div>
  );
}

export function AirlineCard({ code }: { code: string }) {
  const [data, setData] = useState<AirlineCardData | null | "loading">("loading");

  useEffect(() => {
    let alive = true;
    setData("loading");
    getAirline(code)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [code]);

  if (data === "loading") {
    return (
      <Card padded={false} className="flex items-center gap-2 p-3 text-xs text-text-muted">
        <Spinner size={13} /> Loading {code}…
      </Card>
    );
  }

  if (!data) {
    return (
      <Card padded={false} className="p-3">
        <div className="text-sm font-semibold text-text-primary">{code}</div>
        <div className="mt-1 text-xs text-text-muted">No curated experience data for this airline yet.</div>
      </Card>
    );
  }

  return (
    <Card padded={false} className="p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-text-primary">{data.name}</div>
        <Badge tone="neutral">{data.region}</Badge>
      </div>
      <div className="mt-2">
        <Row label="Seat pitch (legroom)" value={`${data.seatPitchInches}″`} />
        <Row label="Checked bag" value={data.checkedBagFee} />
        <Row label="Carry-on included" value={data.carryOnIncluded ? "Yes ✓" : "No — extra charge ✗"} />
        {data.carryOnDimensions && <Row label="Carry-on size" value={data.carryOnDimensions} />}
        <Row label="Free snacks / meals" value={data.freeSnacks} />
        <Row label="Wi-Fi" value={data.wifi} />
        <Row label="Seat power" value={data.seatPower} />
      </div>
      {data.notes && (
        <p className="mt-2 rounded-lg bg-brand-500/10 p-2 text-[11px] text-brand-300">{data.notes}</p>
      )}
    </Card>
  );
}

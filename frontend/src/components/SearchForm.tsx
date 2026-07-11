import { useState } from "react";
import { Search } from "lucide-react";
import { Button, Card, DatePicker, SegmentedControl, SelectField, TextField } from "pandora-components-web";
import type { SearchParams } from "../api";
import { AirportAutocomplete } from "./AirportAutocomplete";

const SEATS = [
  { value: "economy", label: "Economy" },
  { value: "premium-economy", label: "Premium" },
  { value: "business", label: "Business" },
  { value: "first", label: "First" },
];

const STOP_OPTIONS = [
  { value: "", label: "Any stops" },
  { value: "0", label: "Nonstop" },
  { value: "1", label: "1 stop or fewer" },
  { value: "2", label: "2 stops or fewer" },
];

const AIRLINE_OPTIONS = [
  { value: "", label: "Any airline" },
  { value: "AA", label: "American" },
  { value: "AS", label: "Alaska" },
  { value: "B6", label: "JetBlue" },
  { value: "BA", label: "British Airways" },
  { value: "DL", label: "Delta" },
  { value: "EK", label: "Emirates" },
  { value: "F9", label: "Frontier" },
  { value: "JL", label: "Japan Airlines" },
  { value: "LH", label: "Lufthansa" },
  { value: "NH", label: "ANA" },
  { value: "QR", label: "Qatar Airways" },
  { value: "SQ", label: "Singapore Airlines" },
  { value: "TK", label: "Turkish Airlines" },
  { value: "UA", label: "United" },
  { value: "WN", label: "Southwest" },
];

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function SearchForm({
  onSearch,
  loading,
  onMaxStopsChange,
}: {
  onSearch: (p: SearchParams) => void;
  loading: boolean;
  onMaxStopsChange?: (maxStops: number | null) => void;
}) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [trip, setTrip] = useState<"one-way" | "round-trip">("round-trip");
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [seat, setSeat] = useState("economy");
  const [maxStops, setMaxStops] = useState("");
  const [airlineCode, setAirlineCode] = useState("");
  // Kept as a raw string so mid-edit states ("" while retyping) don't snap the
  // value to 1 and produce surprises like "12" clamping to 9; clamped on blur.
  const [adultsText, setAdultsText] = useState("1");
  const adults = Math.max(1, Math.min(9, Number(adultsText) || 1));
  const [error, setError] = useState("");
  const today = todayISO();

  const handleMaxStopsChange = (v: string) => {
    setMaxStops(v);
    onMaxStopsChange?.(v === "" ? null : Number(v));
  };

  const handleDepartChange = (v: string) => {
    setDepartDate(v);
    // Clear a now-invalid return date rather than silently submitting a
    // reversed date range to the API and booking links.
    if (returnDate && returnDate < v) setReturnDate("");
  };

  const submit = () => {
    if (origin.length !== 3 || destination.length !== 3) {
      setError("Pick an origin and destination airport.");
      return;
    }
    if (origin === destination) {
      setError("Origin and destination must differ.");
      return;
    }
    if (!departDate) {
      setError("Pick a departure date.");
      return;
    }
    if (departDate < today) {
      setError("Departure date can't be in the past.");
      return;
    }
    if (trip === "round-trip" && !returnDate) {
      setError("Pick a return date (or switch to one-way).");
      return;
    }
    if (trip === "round-trip" && returnDate < departDate) {
      setError("Return date can't be before departure.");
      return;
    }
    setError("");
    onSearch({
      origin,
      destination,
      departDate,
      returnDate: trip === "round-trip" ? returnDate : null,
      trip,
      seat,
      adults,
      maxStops: maxStops === "" ? null : Number(maxStops),
      airlineCode: airlineCode || null,
    });
  };

  return (
    <Card padded>
      <div className="mb-3">
        <SegmentedControl
          ariaLabel="Trip type"
          size="sm"
          value={trip}
          onChange={setTrip}
          options={[
            { value: "round-trip", label: "Round trip" },
            { value: "one-way", label: "One way" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AirportAutocomplete label="From" placeholder="City or airport" onSelect={setOrigin} />
        <AirportAutocomplete label="To" placeholder="City or airport" onSelect={setDestination} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DatePicker label="Depart" value={departDate} onChange={handleDepartChange} min={today} />
        <DatePicker
          label="Return"
          value={returnDate}
          onChange={setReturnDate}
          min={departDate || today}
          disabled={trip === "one-way"}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField label="Cabin" value={seat} onChange={setSeat} options={SEATS} />
        <TextField
          label="Adults"
          type="number"
          value={adultsText}
          onChange={setAdultsText}
          onBlur={() => setAdultsText(String(adults))}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField label="Num stops" value={maxStops} onChange={handleMaxStopsChange} options={STOP_OPTIONS} />
        <SelectField label="Airline" value={airlineCode} onChange={setAirlineCode} options={AIRLINE_OPTIONS} />
      </div>

      {error && <p className="mt-3 text-sm text-status-error">{error}</p>}

      <Button className="mt-4 w-full" icon={<Search size={15} />} loading={loading} onClick={submit}>
        {loading ? "Scanning…" : "Scan flights"}
      </Button>
    </Card>
  );
}

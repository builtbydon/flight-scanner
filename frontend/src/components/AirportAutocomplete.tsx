import { useCallback, useState } from "react";
import { Autocomplete, type AutocompleteOption } from "pandora-components-web";
import { searchAirports } from "../api";

// Thin app wrapper over the generic Autocomplete: maps the /api/airports results
// into options and reports the *selected* IATA code upward. It owns its own
// display text so echoing a value back from the parent can't clobber what the
// user typed, and it reports "" until the user actually picks a suggestion, so
// free-typed city names never masquerade as bogus 3-letter codes.
export function AirportAutocomplete({
  label,
  onSelect,
  placeholder,
}: {
  label: string;
  onSelect: (iata: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");

  const fetchOptions = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    const results = await searchAirports(q);
    return results.map((a) => ({
      id: a.iata,
      label: a.city,
      sublabel: `${a.name}, ${a.country}`,
      displayValue: `${a.city} (${a.iata})`,
    }));
  }, []);

  return (
    <Autocomplete
      label={label}
      value={text}
      placeholder={placeholder}
      fetchOptions={fetchOptions}
      onSelect={(opt, raw) => {
        if (opt) {
          setText(opt.displayValue ?? opt.label);
          onSelect(opt.id);
        } else {
          // Free text that isn't a confirmed selection: keep it visible but
          // report no code, so validation forces the user to pick an airport.
          setText(raw);
          onSelect("");
        }
      }}
    />
  );
}

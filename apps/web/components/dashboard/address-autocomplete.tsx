"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, MapPin } from "lucide-react";
import { searchAddressesAction } from "@/app/dashboard/actions";
import { Input } from "@/components/ui/input";
import type { AddressSuggestion } from "@/lib/geocoding";

export function AddressAutocomplete({ value, onChange, onSelect }: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
}) {
  const t = useTranslations("dashboard");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string>();
  const requestId = useRef(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const id = ++requestId.current;
    if (!focused || value.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      setError(undefined);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(undefined);
      try {
        const result = await searchAddressesAction(value);
        if (id !== requestId.current) return;
        setLoading(false);
        setSuggestions(result.ok ? result.data : []);
        setError(result.ok ? undefined : result.error);
      } catch {
        if (id !== requestId.current) return;
        setLoading(false);
        setSuggestions([]);
        setError(t("address.unavailable"));
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [focused, value, t]);

  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    requestId.current += 1;
  }, []);

  return (
    <div className="relative">
      <Input
        id="address"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setFocused(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setFocused(false), 150);
        }}
        placeholder={t("address.placeholder")}
        autoComplete="off"
      />
      {loading && <Loader2 className="pointer-events-none absolute end-3 top-2.5 size-4 animate-spin text-muted-foreground" />}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {focused && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-lg">
          {suggestions.map((suggestion) => (
            <li key={`${suggestion.lat}-${suggestion.lng}-${suggestion.label}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded px-2 py-2 text-start text-sm hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { onSelect(suggestion); setSuggestions([]); setFocused(false); }}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>{suggestion.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

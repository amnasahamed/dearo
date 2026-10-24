import React, { useState } from "react";
import { Text } from "react-native";
import {
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";
import { Button, Field, s } from "./components";
export function countryLabel(code: CountryCode): string {
  let name: string = code;
  try {
    name = new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {}
  return `${name} (+${getCountryCallingCode(code)})`;
}
export function CountryPicker({
  selected,
  onSelect,
  busy,
}: {
  selected: CountryCode;
  onSelect: (code: CountryCode) => void;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  const countries = getCountries()
    .map((code) => ({ code, label: countryLabel(code) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const matches = countries.filter((c) =>
    (c.label + " " + c.code).toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <Text style={s.body}>
        Used for numbers entered without an international prefix. You can still
        add guests from any country.
      </Text>
      <Field
        label="Search country or calling code"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />
      <Text style={s.muted}>Selected: {countryLabel(selected)}</Text>
      {matches.slice(0, 30).map((c) => (
        <Button
          key={c.code}
          title={c.label}
          secondary
          onPress={() => onSelect(c.code)}
          disabled={busy}
        />
      ))}
      {matches.length === 0 ? (
        <Text accessibilityRole="alert" style={s.body}>
          No matching country. Try its name, two-letter code or calling code.
        </Text>
      ) : null}
      {matches.length > 30 ? (
        <Text style={s.muted}>
          Showing the first 30 matches. Type to narrow your search.
        </Text>
      ) : null}
    </>
  );
}

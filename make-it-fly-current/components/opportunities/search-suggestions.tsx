import { AREAS } from "@/lib/opportunities/vocabulary";

/** Native keyboard-accessible topic suggestions; never serializes catalogue details. */
export function OpportunitySearchSuggestions({ id }: { id: string }) {
  return <datalist id={id}>
    {Object.values(AREAS).map(label => <option key={label} value={label} />)}
  </datalist>;
}

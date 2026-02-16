/**
 * Site location options for autocomplete. Data from site-location-options.json.
 * Edit lib/data/site-location-options.json to add or update options.
 */
import data from "./site-location-options.json"

export type SiteLocationOptions = {
  sections: string[]
  subDivisions: string[]
  divisions: string[]
  circles: string[]
  mandals: string[]
  districts: string[]
  pinCodes: string[]
  cities: string[]
  states: string[]
}

export const siteLocationOptions: SiteLocationOptions = data as SiteLocationOptions

export function filterOptions(options: string[], search: string): string[] {
  if (!search.trim()) return options
  const q = search.trim().toLowerCase()
  return options.filter((opt) => opt.toLowerCase().includes(q))
}

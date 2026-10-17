'use client'

import * as React from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Shared address block for every dashboard form that captures an address.
 *
 * - A Google address search fills street, city, state, ZIP and country in one
 *   pick, so nobody retypes (or mistypes) an address the geocoder then rejects.
 * - State (for the US) and Country are pickers rather than free text.
 * - Browser autofill is OFF by default. These are mostly admin forms for
 *   someone else's address, and Chrome kept offering the admin's own saved
 *   address (a Norwegian city and postcode, and "English (USA)" as the State).
 *   Pass `browserAutofill` on forms for the signed-in person's own address;
 *   those inputs then carry the correct `autocomplete` tokens.
 *
 * Search is an enhancement: with no Maps key, or if Google fails to load, the
 * fields still work by hand.
 */

export interface AddressValue {
  address1: string
  address2: string
  city: string
  state: string
  zipCode: string
  country: string
}

export const EMPTY_ADDRESS: AddressValue = {
  address1: '',
  address2: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'US',
}

const US_STATES: Array<[string, string]> = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['PR', 'Puerto Rico'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'],
  ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
]

// Where LocalVIP operates or is likely to; anything else already on a record is
// kept and shown (see countryOptions), so nothing is silently rewritten.
const COUNTRY_CODES = [
  'US', 'CA', 'MX', 'GB', 'IE', 'NO', 'SE', 'DK', 'FI', 'IS', 'DE', 'NL', 'BE', 'FR', 'ES', 'PT',
  'IT', 'CH', 'AT', 'PL', 'AU', 'NZ', 'PH', 'IN', 'BR', 'ZA', 'JP',
]

/** Records hold "Florida", "FL" or "fl"; the US picker works in codes. */
export function normalizeUsState(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const upper = trimmed.toUpperCase()
  const byCode = US_STATES.find(([code]) => code === upper)
  if (byCode) return byCode[0]
  const byName = US_STATES.find(([, name]) => name.toUpperCase() === upper)
  return byName ? byName[0] : trimmed
}

/** Records hold "US", "USA" or "United States"; the picker works in ISO codes. */
export function normalizeCountry(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const upper = trimmed.toUpperCase()
  if (upper === 'USA' || upper === 'UNITED STATES' || upper === 'UNITED STATES OF AMERICA') return 'US'
  if (upper.length === 2) return upper
  const names = countryNames()
  const match = COUNTRY_CODES.find(code => names(code).toUpperCase() === upper)
  return match || trimmed
}

function countryNames(): (code: string) => string {
  try {
    const display = new Intl.DisplayNames(['en'], { type: 'region' })
    return code => display.of(code) || code
  } catch {
    return code => code
  }
}

const selectClass =
  'h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm hover:border-surface-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1'

interface AddressFieldsProps {
  value: AddressValue
  onChange: (next: AddressValue) => void
  /** Marks street, city, state, ZIP and country as required. */
  required?: boolean
  /** Hide fields a form doesn't store (e.g. the business-referral invite). */
  fields?: Array<keyof AddressValue>
  /** Called with the complete Google result, including fields this form hides. */
  onPick?: (picked: AddressValue) => void
  /** The address is the signed-in person's own, so let the browser fill it. */
  browserAutofill?: boolean
  className?: string
}

export function AddressFields({ value, onChange, onPick, required = false, fields, browserAutofill = false, className }: AddressFieldsProps) {
  const id = React.useId()
  // name + autocomplete are what Chrome's address heuristics key on.
  const auto = (token: string) =>
    browserAutofill ? { name: token, autoComplete: token } : { autoComplete: 'off' }
  const show = (field: keyof AddressValue) => !fields || fields.includes(field)
  const country = normalizeCountry(value.country) || 'US'
  const isUs = country === 'US'
  const mark = required ? ' *' : ''

  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch })

  const names = React.useMemo(countryNames, [])
  const countryOptions = React.useMemo(() => {
    const codes = COUNTRY_CODES.includes(country) ? COUNTRY_CODES : [country, ...COUNTRY_CODES]
    return codes.map(code => ({ code, name: names(code) }))
  }, [country, names])

  const stateCode = isUs ? normalizeUsState(value.state) : value.state
  const stateIsKnown = !isUs || !stateCode || US_STATES.some(([code]) => code === stateCode)

  return (
    <div className={cn('space-y-4', className)}>
      <AddressSearch
        country={country}
        onPick={picked => {
          onChange({ ...value, ...pickFields(picked, show) })
          onPick?.(picked)
        }}
      />

      {show('address1') && (
        <div className="space-y-2">
          <label htmlFor={`${id}-address1`} className="text-sm font-medium text-surface-700">Street address{mark}</label>
          <Input
            id={`${id}-address1`}
            {...auto('address-line1')}
            required={required}
            placeholder="123 Main Street"
            value={value.address1}
            onChange={event => set({ address1: event.target.value })}
          />
        </div>
      )}

      {show('address2') && (
        <div className="space-y-2">
          <label htmlFor={`${id}-address2`} className="text-sm font-medium text-surface-700">Address line 2</label>
          <Input
            id={`${id}-address2`}
            {...auto('address-line2')}
            placeholder="Suite, unit, or floor"
            value={value.address2}
            onChange={event => set({ address2: event.target.value })}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {show('city') && (
          <div className="space-y-2">
            <label htmlFor={`${id}-city`} className="text-sm font-medium text-surface-700">City{mark}</label>
            <Input
              id={`${id}-city`}
              {...auto('address-level2')}
              required={required}
              value={value.city}
              onChange={event => set({ city: event.target.value })}
            />
          </div>
        )}
        {show('state') && (
          <div className="space-y-2">
            <label htmlFor={`${id}-state`} className="text-sm font-medium text-surface-700">
              {isUs ? 'State' : 'State / region'}{mark}
            </label>
            {isUs ? (
              <select
                id={`${id}-state`}
                {...auto('address-level1')}
                required={required}
                className={selectClass}
                value={stateCode}
                onChange={event => set({ state: event.target.value })}
              >
                <option value="">Choose a state</option>
                {/* Keep an unrecognised stored value visible rather than blanking it. */}
                {!stateIsKnown && <option value={stateCode}>{stateCode}</option>}
                {US_STATES.map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            ) : (
              <Input
                id={`${id}-state`}
                {...auto('address-level1')}
                value={value.state}
                onChange={event => set({ state: event.target.value })}
              />
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {show('zipCode') && (
          <div className="space-y-2">
            <label htmlFor={`${id}-zip`} className="text-sm font-medium text-surface-700">
              {isUs ? 'ZIP code' : 'Postal code'}{mark}
            </label>
            <Input
              id={`${id}-zip`}
              {...auto('postal-code')}
              inputMode={isUs ? 'numeric' : 'text'}
              required={required}
              value={value.zipCode}
              onChange={event => set({ zipCode: event.target.value })}
            />
          </div>
        )}
        {show('country') && (
          <div className="space-y-2">
            <label htmlFor={`${id}-country`} className="text-sm font-medium text-surface-700">Country{mark}</label>
            <select
              id={`${id}-country`}
              {...auto('country')}
              required={required}
              className={selectClass}
              value={country}
              onChange={event => {
                const next = event.target.value
                // A US state code means nothing in another country (and vice versa).
                set({ country: next, state: next === country ? value.state : '' })
              }}
            >
              {countryOptions.map(option => (
                <option key={option.code} value={option.code}>{option.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}

function pickFields(picked: AddressValue, show: (field: keyof AddressValue) => boolean): Partial<AddressValue> {
  const out: Partial<AddressValue> = {}
  for (const key of Object.keys(picked) as Array<keyof AddressValue>) {
    if (show(key)) out[key] = picked[key]
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* Google address search                                                       */
/* -------------------------------------------------------------------------- */

type Suggestion = { id: string; primary: string; secondary: string; resolve: () => Promise<AddressValue | null> }

// The Maps JS API, untyped on purpose: the dashboard has no @types/google.maps
// and this is the only place it is used.
type Places = any

let placesPromise: Promise<Places> | null = null

function loadPlaces(apiKey: string): Promise<Places> {
  if (placesPromise) return placesPromise
  placesPromise = new Promise<Places>((resolve, reject) => {
    const w = window as unknown as { google?: { maps?: { importLibrary?: (name: string) => Promise<Places> } }; __lvMapsReady?: () => void }
    const done = () => {
      const importLibrary = w.google?.maps?.importLibrary
      if (!importLibrary) { reject(new Error('Google Maps did not initialise')); return }
      importLibrary('places').then(resolve, reject)
    }
    if (w.google?.maps?.importLibrary) { done(); return }
    w.__lvMapsReady = done
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&callback=__lvMapsReady`
    script.async = true
    script.onerror = () => reject(new Error('Google Maps script failed to load'))
    document.head.appendChild(script)
  }).catch(error => {
    placesPromise = null // let a later mount retry
    throw error
  })
  return placesPromise
}

function AddressSearch({ country, onPick }: { country: string; onPick: (address: AddressValue) => void }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  const listboxId = React.useId()
  const [places, setPlaces] = React.useState<Places | null>(null)
  const [unavailable, setUnavailable] = React.useState(!apiKey)
  const [query, setQuery] = React.useState('')
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([])
  const [active, setActive] = React.useState(-1)
  const [busy, setBusy] = React.useState(false)
  const requestRef = React.useRef(0)
  const tokenRef = React.useRef<Places | null>(null)

  React.useEffect(() => {
    if (!apiKey) return
    let cancelled = false
    loadPlaces(apiKey).then(
      lib => { if (!cancelled) setPlaces(lib) },
      error => {
        console.warn('[address-fields] Google address search unavailable:', error)
        if (!cancelled) setUnavailable(true)
      },
    )
    return () => { cancelled = true }
  }, [apiKey])

  React.useEffect(() => {
    if (!places) return
    const requestId = ++requestRef.current
    const input = query.trim()
    if (input.length < 3) { setSuggestions([]); setActive(-1); return }
    setBusy(true)
    const timer = window.setTimeout(async () => {
      try {
        if (!tokenRef.current) tokenRef.current = new places.AutocompleteSessionToken()
        const results = await fetchSuggestions(places, input, country, tokenRef.current)
        if (requestId !== requestRef.current) return
        setSuggestions(results.slice(0, 5))
        setActive(results.length ? 0 : -1)
      } catch (error) {
        if (requestId !== requestRef.current) return
        console.warn('[address-fields] autocomplete failed:', error)
        setSuggestions([])
        setUnavailable(true)
      } finally {
        if (requestId === requestRef.current) setBusy(false)
      }
    }, 220)
    return () => { window.clearTimeout(timer); requestRef.current += 1 }
  }, [query, places, country])

  const choose = async (suggestion: Suggestion) => {
    setBusy(true)
    try {
      const address = await suggestion.resolve()
      tokenRef.current = null // a pick ends the billing session
      if (address) {
        onPick(address)
        setQuery('')
        setSuggestions([])
        setActive(-1)
      }
    } catch (error) {
      console.warn('[address-fields] place details failed:', error)
    } finally {
      setBusy(false)
    }
  }

  if (unavailable) {
    return apiKey ? (
      <p className="rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-500">
        Address search isn&apos;t available right now. Enter the address below.
      </p>
    ) : null
  }

  const open = suggestions.length > 0

  return (
    <div className="relative space-y-2">
      <label htmlFor={`${listboxId}-input`} className="text-sm font-medium text-surface-700">Find the address</label>
      <div className="flex h-10 items-center gap-2 rounded-lg border border-brand-300 bg-brand-50/40 px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30">
        <Search className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
        <input
          id={`${listboxId}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listboxId}-opt-${active}` : undefined}
          // Keep the browser's own address autofill out of this box.
          autoComplete="off"
          name="lv-place-query"
          placeholder={places ? 'Start typing a street or place name' : 'Loading address search…'}
          disabled={!places}
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'ArrowDown' && open) { event.preventDefault(); setActive(i => (i + 1) % suggestions.length) }
            else if (event.key === 'ArrowUp' && open) { event.preventDefault(); setActive(i => (i <= 0 ? suggestions.length - 1 : i - 1)) }
            else if (event.key === 'Enter' && open && active >= 0) { event.preventDefault(); void choose(suggestions[active]) }
            else if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setSuggestions([]) }
          }}
          className="h-full w-full bg-transparent text-sm text-surface-900 outline-none placeholder:text-surface-400 disabled:opacity-60"
        />
        {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-surface-400" aria-hidden="true" />}
      </div>
      <p className="text-xs text-surface-500">Pick a result to fill in every field below. You can still edit them.</p>
      <ul
        id={listboxId}
        role="listbox"
        aria-label="Address suggestions"
        className={open ? 'absolute left-0 right-0 top-[4.25rem] z-20 overflow-hidden rounded-lg border border-surface-200 bg-surface-0 p-1 shadow-lg' : 'hidden'}
      >
        {suggestions.map((suggestion, index) => (
          <li
            key={suggestion.id}
            id={`${listboxId}-opt-${index}`}
            role="option"
            aria-selected={index === active}
            onMouseEnter={() => setActive(index)}
            // mousedown so the input doesn't blur first
            onMouseDown={event => { event.preventDefault(); void choose(suggestion) }}
            className={cn(
              'flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm',
              index === active ? 'bg-brand-50 text-surface-900' : 'text-surface-700',
            )}
          >
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-surface-400" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{suggestion.primary}</span>
              {suggestion.secondary && <span className="block truncate text-xs text-surface-500">{suggestion.secondary}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type AddressComponent = { types: string[]; long: string; short: string }

function toAddress(components: AddressComponent[]): AddressValue {
  const get = (type: string, form: 'long' | 'short' = 'long') =>
    components.find(component => component.types.includes(type))?.[form] || ''
  const country = get('country', 'short').toUpperCase() || 'US'
  const street = [get('street_number'), get('route')].filter(Boolean).join(' ')
  return {
    address1: street || get('premise') || get('point_of_interest') || get('establishment'),
    address2: get('subpremise'),
    city: get('locality') || get('postal_town') || get('sublocality') || get('administrative_area_level_2'),
    state: country === 'US' ? get('administrative_area_level_1', 'short') : get('administrative_area_level_1'),
    zipCode: get('postal_code'),
    country,
  }
}

/**
 * Current Places API (AutocompleteSuggestion + Place.fetchFields) when the
 * loaded library has it; the legacy AutocompleteService otherwise — the same
 * split the consumer webapp's location picker uses with this key.
 */
async function fetchSuggestions(places: Places, input: string, country: string, sessionToken: Places): Promise<Suggestion[]> {
  const region = country && country.length === 2 ? [country.toLowerCase()] : undefined

  if (typeof places.AutocompleteSuggestion?.fetchAutocompleteSuggestions === 'function') {
    const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input,
      sessionToken,
      ...(region ? { includedRegionCodes: region } : {}),
    })
    return (suggestions as any[])
      .map(s => s.placePrediction)
      .filter(Boolean)
      .map((prediction: any) => ({
        id: prediction.placeId,
        primary: prediction.mainText?.text || prediction.text?.text || '',
        secondary: prediction.secondaryText?.text || '',
        resolve: async () => {
          const place = prediction.toPlace()
          await place.fetchFields({ fields: ['addressComponents'] })
          const components = (place.addressComponents || []) as Array<{ types: string[]; longText: string; shortText: string }>
          if (!components.length) return null
          return toAddress(components.map(c => ({ types: c.types, long: c.longText, short: c.shortText })))
        },
      }))
  }

  const service = new places.AutocompleteService()
  const predictions: any[] = await new Promise((resolve, reject) => {
    service.getPlacePredictions(
      { input, sessionToken, ...(region ? { componentRestrictions: { country: region } } : {}) },
      (results: any[] | null, status: string) => {
        if (status === places.PlacesServiceStatus.ZERO_RESULTS) resolve([])
        else if (status !== places.PlacesServiceStatus.OK || !results) reject(new Error(`Places autocomplete failed: ${status}`))
        else resolve(results)
      },
    )
  })
  return predictions.map(prediction => ({
    id: prediction.place_id,
    primary: prediction.structured_formatting?.main_text || prediction.description,
    secondary: prediction.structured_formatting?.secondary_text || '',
    resolve: () =>
      new Promise<AddressValue | null>(resolve => {
        new places.PlacesService(document.createElement('div')).getDetails(
          { placeId: prediction.place_id, fields: ['address_components'], sessionToken },
          (result: any, status: string) => {
            const components = status === places.PlacesServiceStatus.OK ? result?.address_components : null
            resolve(
              components?.length
                ? toAddress(components.map((c: any) => ({ types: c.types, long: c.long_name, short: c.short_name })))
                : null,
            )
          },
        )
      }),
  }))
}

/** Get UTC offset in minutes for a timezone at a given instant */
function getTzOffsetMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0'
  // Reconstruct as if UTC to get the "wall clock" in that timezone
  const wall = Date.UTC(
    +get('year'), +get('month') - 1, +get('day'),
    +get('hour') % 24, +get('minute'), +get('second')
  )
  return (wall - date.getTime()) / 60000
}

/** Format ISO timestamp to "2026/2/18 4:40 AM" in the given timezone */
export function formatDate(iso: string, timezone: string = 'Asia/Taipei'): string {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value || ''
  return `${get('year')}/${get('month')}/${get('day')} ${get('hour')}:${get('minute')} ${get('dayPeriod')}`
}

/** Convert ISO to datetime-local value in a timezone (for <input type="datetime-local">) */
export function isoToLocalDatetime(iso: string, timezone: string): string {
  const d = new Date(iso)
  const offset = getTzOffsetMinutes(d, timezone)
  const local = new Date(d.getTime() + offset * 60000)
  return local.toISOString().slice(0, 16)
}

/** Convert a datetime-local value (in trip timezone) back to ISO string */
export function localDatetimeToISO(datetimeLocal: string, timezone: string): string {
  // datetimeLocal is "2026-05-14T08:53" — treat as wall clock in the given timezone
  // Parse parts manually to avoid browser-local interpretation
  const [datePart, timePart] = datetimeLocal.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, min] = timePart.split(':').map(Number)
  const utcGuess = Date.UTC(y, m - 1, d, h, min)
  // Get the offset at this approximate time and adjust
  const offset = getTzOffsetMinutes(new Date(utcGuess), timezone)
  return new Date(utcGuess - offset * 60000).toISOString()
}

/** Get display label for timezone, e.g. "Asia/Taipei (UTC+8)" */
export function formatTimezoneLabel(tz: string): string {
  const offset = Math.round(getTzOffsetMinutes(new Date(), tz))
  const h = Math.floor(Math.abs(offset) / 60)
  const m = Math.abs(offset) % 60
  const sign = offset >= 0 ? '+' : '-'
  const offsetStr = m > 0 ? `${sign}${h}:${String(m).padStart(2, '0')}` : `${sign}${h}`
  return `${tz} (UTC${offsetStr})`
}

let cachedTimezones: string[] | null = null

/** Fetch IANA timezone list from worldtimeapi.org (cached, one call only) */
export async function fetchTimezones(): Promise<string[]> {
  if (cachedTimezones) return cachedTimezones
  try {
    const res = await fetch('https://worldtimeapi.org/api/timezone')
    const data: string[] = await res.json()
    cachedTimezones = data
    return data
  } catch {
    // Fallback common timezones
    return [
      'Asia/Taipei', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai',
      'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Bangkok',
      'America/New_York', 'America/Los_Angeles', 'America/Chicago',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin',
      'Australia/Sydney', 'Pacific/Auckland',
    ]
  }
}

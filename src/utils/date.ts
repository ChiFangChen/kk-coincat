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

/** Convert a datetime-local value (in trip timezone) back to ISO string */
export function localDatetimeToISO(datetimeLocal: string, timezone: string): string {
  // datetimeLocal is like "2026-05-14T08:53"
  // We need to figure out the UTC offset for this timezone at this time
  // Use a binary-search-free approach: format a known date in the target tz and compare
  const naive = new Date(datetimeLocal) // parsed as local browser time
  const browserOffset = naive.getTimezoneOffset() // browser offset in minutes

  // Get the target timezone offset by formatting
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  // Format current naive date in target tz to find offset difference
  const parts = formatter.formatToParts(naive)
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0'
  const tzStr = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
  const tzDate = new Date(tzStr)
  const targetOffset = (naive.getTime() - tzDate.getTime()) / 60000 // target offset in minutes

  // Adjust: we want the date where target-tz representation equals datetimeLocal
  const adjustMs = (targetOffset - browserOffset) * 60000
  const adjusted = new Date(naive.getTime() + adjustMs)
  return adjusted.toISOString()
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

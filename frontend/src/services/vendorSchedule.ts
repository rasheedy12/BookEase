import type { VendorOpeningDay } from './catalog'

interface LocalDateTimeParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function parseLocalDateTime(value: string): LocalDateTimeParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = match
  const parts = {
    year: Number(yearValue),
    month: Number(monthValue),
    day: Number(dayValue),
    hour: Number(hourValue),
    minute: Number(minuteValue),
  }
  const normalized = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  ))

  if (
    normalized.getUTCFullYear() !== parts.year
    || normalized.getUTCMonth() !== parts.month - 1
    || normalized.getUTCDate() !== parts.day
    || parts.hour > 23
    || parts.minute > 59
  ) {
    return null
  }

  return parts
}

function getZonedParts(date: Date, timeZone: string): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  }
}

function sameLocalTime(left: LocalDateTimeParts, right: LocalDateTimeParts): boolean {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute
}

function formatClock(minutes: number): string {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return [
    hours > 0 ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : '',
    remainingMinutes > 0 ? `${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}` : '',
  ].filter(Boolean).join(' ')
}

function timezoneOffsetAt(timestamp: number, timeZone: string): number {
  const roundedTimestamp = Math.floor(timestamp / 60_000) * 60_000
  const zoned = getZonedParts(new Date(roundedTimestamp), timeZone)
  const representedAsUtc = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
  )

  return representedAsUtc - roundedTimestamp
}

export function getVendorLocalDateTimeMinimum(timeZone: string): string {
  const { year, month, day, hour, minute } = getZonedParts(new Date(), timeZone)

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function vendorLocalDateTimeToIso(value: string, timeZone: string): string {
  const parts = parseLocalDateTime(value)
  if (!parts) throw new Error('Choose a valid booking date and time.')

  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  )
  const offsets = new Set([
    timezoneOffsetAt(localAsUtc - 36 * 60 * 60 * 1000, timeZone),
    timezoneOffsetAt(localAsUtc, timeZone),
    timezoneOffsetAt(localAsUtc + 36 * 60 * 60 * 1000, timeZone),
  ])
  const matchingInstants = [...offsets]
    .map((offset) => localAsUtc - offset)
    .filter((timestamp) => sameLocalTime(getZonedParts(new Date(timestamp), timeZone), parts))
    .sort((left, right) => left - right)

  if (matchingInstants.length === 0) {
    throw new Error('That time does not exist in the vendor’s timezone because clocks change. Choose another time.')
  }

  return new Date(matchingInstants[0]).toISOString()
}

export function validateVendorOpeningHours(
  value: string,
  durationMinutes: number,
  days: VendorOpeningDay[] | undefined,
  timeZone = 'UTC',
): string | null {
  const parts = parseLocalDateTime(value)
  if (!parts || !days) return null

  try {
    const localInstant = new Date(vendorLocalDateTimeToIso(value, timeZone))
    const zoned = getZonedParts(localInstant, timeZone)
    const dayOfWeek = new Date(zoned.year, zoned.month - 1, zoned.day).getDay()
    const hours = days.find((day) => day.day_of_week === dayOfWeek)
    const openMinutes = hours?.opens_at
      ? Number(hours.opens_at.slice(0, 2)) * 60 + Number(hours.opens_at.slice(3, 5))
      : null
    const closeMinutes = hours?.closes_at
      ? Number(hours.closes_at.slice(0, 2)) * 60 + Number(hours.closes_at.slice(3, 5))
      : null
    const startMinutes = zoned.hour * 60 + zoned.minute

    if (!hours || hours.is_closed || openMinutes === null || closeMinutes === null) {
      return 'The vendor is closed on this day. Choose another day during their opening hours.'
    }

    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]
    const serviceLength = formatDuration(durationMinutes)

    if (startMinutes < openMinutes) {
      return `The vendor opens at ${formatClock(openMinutes)} on ${dayName}. Choose a later start time.`
    }

    if (startMinutes + durationMinutes > closeMinutes || startMinutes + durationMinutes >= 24 * 60) {
      const latestStart = closeMinutes - durationMinutes
      if (latestStart < openMinutes) {
        return `This service takes ${serviceLength}, longer than the vendor’s ${formatClock(openMinutes)}–${formatClock(closeMinutes)} opening hours on ${dayName}. Contact the vendor to arrange a suitable time.`
      }

      return `This service takes ${serviceLength}. The latest start on ${dayName} is ${formatClock(latestStart)} so it finishes by ${formatClock(closeMinutes)}. Choose an earlier time.`
    }

    return null
  } catch {
    return 'Choose a valid booking date and time.'
  }
}

/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export interface LocalDate { year: number, month: number, day: number }
/** IANA zone; omitted means the device's current time zone. */
export type TimeZone = string | undefined
export const localDateReader = (tz?: TimeZone): ((time: number) => LocalDate) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: 'numeric', day: 'numeric',
  })
  return time => {
    const parts = formatter.formatToParts(time)
    const part = (type: string) => Number(parts.find(value => value.type == type)?.value)
    return { year: part('year'), month: part('month'), day: part('day') }
  }
}
export const dateKey = ({ year, month, day }: LocalDate): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
/** Calendar ordinal, independent of 23/25-hour DST days. */
export const dayOrdinal = ({ year, month, day }: LocalDate): number => Date.UTC(year, month - 1, day) / 86_400_000
export const isLeapYear = (year: number): boolean => year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)

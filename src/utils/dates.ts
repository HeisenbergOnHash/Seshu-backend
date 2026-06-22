import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const APP_TZ = 'Asia/Kolkata';

/** Normalize any Date to a calendar day in IST (for lending date math). */
export const toCalendarDate = (date: Date | string): Dayjs => {
  return dayjs(date).tz(APP_TZ).startOf('day');
};

/** Parse YYYY-MM-DD from forms as an IST calendar date. */
export const parseCalendarDate = (dateStr: string): Date => {
  return dayjs.tz(dateStr, APP_TZ).startOf('day').toDate();
};

export const calendarDaysDiff = (from: Date | string, to: Date | string): number => {
  return toCalendarDate(to).diff(toCalendarDate(from), 'day');
};

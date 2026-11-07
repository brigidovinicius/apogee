import { calendarReturnPath } from './calendar-navigation';

export const GOOGLE_CALENDAR_ANCHOR = '#google-calendar-heading';

/** Only canonical personal-calendar state can be resumed after authorization. */
export function googleCalendarReturnPath(value?: unknown): string {
  const path = calendarReturnPath(value);
  const url = new URL(path, 'https://apogee.invalid');
  const params=url.pathname==='/membros/meu-calendario'?url.searchParams:new URLSearchParams();
  params.set('integracao','google');
  return '/membros/meu-calendario?'+params.toString()+GOOGLE_CALENDAR_ANCHOR;
}

export function googleCalendarReviewPath(value?: unknown): string {
  return '/membros/protecao?next=' + encodeURIComponent(googleCalendarReturnPath(value));
}

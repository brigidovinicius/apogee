import "server-only";

export function retryAfterMilliseconds(value: string | null, now = Date.now()) {
  if (!value) return 0;
  const text=value.trim();
  const delay=/^\d+$/.test(text) ? Number(text)*1000 : /^[A-Za-z]{3},/.test(text) ? Date.parse(text)-now : 0;
  // Reject unrepresentable dates instead of overflowing the scheduling column.
  return Number.isFinite(delay) && delay>0 && now+delay<=8.64e15 ? Math.ceil(delay) : 0;
}
function integer(name:string,fallback:number,max:number) {
  const n=Number(process.env[name]??fallback);
  if(!Number.isInteger(n)||n<1||n>max)throw Error('Invalid Google Calendar retry configuration');
  return n;
}
export function googleRetryPolicy() {
  const baseMs=integer('GOOGLE_CALENDAR_RETRY_BASE_SECONDS',60,3600)*1000;
  const maxMs=integer('GOOGLE_CALENDAR_RETRY_MAX_SECONDS',3600,86400)*1000;
  if(maxMs<baseMs)throw Error('Invalid Google Calendar retry configuration');
  return {baseMs,maxMs,maxAttempts:integer('GOOGLE_CALENDAR_RETRY_MAX_ATTEMPTS',8,30)};
}
export function googleRetryPlan(error:{code:string;retryAfterMs?:number}, failures:number, random= Math.random) {
  const policy=googleRetryPolicy();
  const attempts=Math.min(1000000,Math.max(0,failures)+1);
  const base=Math.min(policy.maxMs,policy.baseMs*2**Math.min(attempts-1,30));
  const jitter=Math.floor(base*0.25*Math.max(0,Math.min(1,random())));
  const delayMs=Math.max(Math.min(policy.maxMs,base+jitter),error.retryAfterMs??0);
  const permanent=['reconnect','permission','invalid_response'].includes(error.code);
  return {attempts,delayMs,paused:permanent||attempts>=policy.maxAttempts};
}

export type CalendarSaveState =
  | {kind:'ready';savedIds:string[];collections?:{id:string;name:string}[]}
  | {kind:'redirect';href:string}
  | {kind:'disabled'}
  | {kind:'unavailable'};
export type CalendarSaveResult = {ok:true;saved:boolean}|{ok:false;error:string}|{ok:false;redirect:string};

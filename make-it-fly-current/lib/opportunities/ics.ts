import { createHash } from "node:crypto";
import { calendarEntries, publicOpportunityPath, type CalendarFeedEntry } from "./discovery";
import type { StudentOpportunity } from "./types";
const escape=(s:string)=>s.replace(/\\/g,"\\\\").replace(/\r?\n|\r/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");
const timestamp=(s:string)=>new Date(s).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
function dateLine(name:string,value:string) { return value.length===10 ? `${name};VALUE=DATE:${value.replace(/-/g,"")}`:`${name}:${timestamp(value)}`; }
function fold(line:string) {
  const lines:string[]=[];let current="";
  for(const char of line) { if(Buffer.byteLength(current+char,"utf8")>75){lines.push(current);current=" ";}current+=char; }
  return [...lines,current].join("\r\n");
}
/** Stable per-stage UIDs, all-day dates and explicit cancellations for removed events. */
export function renderCalendarFeed(saved:{snapshot:StudentOpportunity;removedAt:string|null;history?:CalendarFeedEntry[]}[],live:StudentOpportunity[],now=Date.now(),origin="https://www.apogee.community") {
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Apogee//Radar//PT-BR","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:Meu calendário Apogee"];
  for(const record of saved) {
    const current=live.find(i=>i.id===record.snapshot.id);
    const oldEntries=[...new Map([...calendarEntries([record.snapshot],0),...(record.history??[])].map(e=>[e.key,e])).values()];
    const fresh=current && !record.removedAt?calendarEntries([current],0):[];
    const byKey=new Map<string, {entry: CalendarFeedEntry; cancelled: boolean}>(fresh.map(e=>[e.key,{entry:e,cancelled:false}]));
    for(const old of oldEntries) if(!byKey.has(old.key))byKey.set(old.key,{entry:old,cancelled:true});
    for(const {entry,cancelled} of byKey.values()) {
      const {item,stage,key}=entry;
      const generatedAt = new Date(now).toISOString();
      const updated = record.removedAt ?? (cancelled ? generatedAt : stage.checkedAt);
      lines.push("BEGIN:VEVENT",`UID:${createHash("sha256").update(key).digest("hex")}@radar.apogee.community`,`DTSTAMP:${timestamp(generatedAt)}`,`LAST-MODIFIED:${timestamp(updated)}`,
        dateLine("DTSTART",stage.start),`SUMMARY:${escape(item.title+" — "+stage.name)}`,`URL:${new URL(publicOpportunityPath(item), origin).href}`,
        `DESCRIPTION:${escape("Confira as condições e eventuais alterações no Radar Apogee.")}`,`STATUS:${cancelled?"CANCELLED":"CONFIRMED"}`,"TRANSP:TRANSPARENT");
      if(stage.start.length===10) {
        const end=new Date((stage.end??stage.start)+"T12:00:00Z");end.setUTCDate(end.getUTCDate()+1);
        lines.push(dateLine("DTEND",end.toISOString().slice(0,10)));
      } else if(stage.end)lines.push(dateLine("DTEND",stage.end));
      lines.push("END:VEVENT");
    }
  }
  return [...lines,"END:VCALENDAR"].map(fold).join("\r\n")+"\r\n";
}

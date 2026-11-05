'use client';
import { useState } from 'react';
import { CALENDAR_PERIODS, type CalendarPeriod } from '@/lib/opportunities/calendar-filters';
export function CalendarPeriodFields({period,month}:{period:CalendarPeriod;month:string}) {
  const [selected,setSelected]=useState(period);
  return <>
    <label>Período<select name="periodo" value={selected} onChange={e=>setSelected(e.target.value as CalendarPeriod)}>{Object.entries(CALENDAR_PERIODS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {selected==='mes'&&<label>Mês<input name="mes" type="month" min="2000-01" max="2099-12" defaultValue={month}/></label>}
  </>;
}

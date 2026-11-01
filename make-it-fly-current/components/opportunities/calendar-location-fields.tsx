'use client';
import { useState } from 'react';
import { BRAZILIAN_STATE_CODES } from '@/lib/opportunities/location';
export function CalendarLocationFields({initialState,initialCity,citiesByState}:{initialState:string;initialCity:string;citiesByState:Record<string,string[]>}) {
  const [state,setState]=useState(initialState),[city,setCity]=useState(initialCity);
  return <>
    <label>Estado<select name="uf" value={state} onChange={e=>{setState(e.target.value);setCity('');}}><option value="">Todos</option>{BRAZILIAN_STATE_CODES.map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Cidade<select name="cidade" value={city} onChange={e=>setCity(e.target.value)} disabled={!state}><option value="">Todas</option>{(citiesByState[state]??[]).map(value=><option key={value}>{value}</option>)}</select></label>
  </>;
}

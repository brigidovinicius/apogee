"use client";
import { useState } from "react";
import { AREAS, SUBTYPES, type Discovery, type Stage } from "@/lib/opportunities/discovery";
import { OPPORTUNITY_CATEGORIES } from "@/lib/opportunities/types";
import { adminStyles as styles } from "@/components/admin/admin-ui";
export function DiscoveryFields({ initial }: { initial?: Discovery }) {
  const [value,setValue]=useState<Discovery>(initial ?? {areas:[],editions:[]});
  const updateStage=(ei:number,si:number,patch:Partial<Stage>)=>setValue(v=>({...v,editions:v.editions.map((e,i)=>i===ei?{...e,stages:e.stages.map((s,j)=>j===si?{...s,...patch}:s)}:e)}));
  return <fieldset className={styles.categoryFieldset}><legend>Classificação e calendário</legend>
    <input type="hidden" name="discovery" value={JSON.stringify(value)}/>
    <label className={styles.field}><span>Tipo principal</span><select value={value.primaryType??""} onChange={e=>setValue({...value,primaryType:e.target.value as Discovery["primaryType"] || undefined})}><option value="">Usar classificação atual</option>{OPPORTUNITY_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    <label className={styles.field}><span>Subtipo confirmado</span><select value={value.subtype??""} onChange={e=>setValue({...value,subtype:e.target.value as Discovery["subtype"] || undefined})}><option value="">Não identificado</option>{Object.entries(SUBTYPES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <fieldset><legend>Áreas identificadas na fonte</legend>{Object.entries(AREAS).map(([key,label])=><label key={key} className={styles.categoryOption}><input type="checkbox" checked={value.areas.includes(key as keyof typeof AREAS)} onChange={e=>setValue({...value,areas:e.target.checked?[...value.areas,key as keyof typeof AREAS]:value.areas.filter(a=>a!==key)})}/>{label}</label>)}</fieldset>
    {value.editions.map((edition,ei)=><fieldset key={edition.id}><legend>Edição {ei+1}</legend><label className={styles.field}><span>Nome da edição</span><input required maxLength={160} value={edition.name} onChange={e=>setValue({...value,editions:value.editions.map((v,i)=>i===ei?{...v,name:e.target.value}:v)})}/></label>
      {edition.stages.map((stage,si)=><fieldset key={stage.id}><legend>Etapa {si+1}</legend>
        <label className={styles.field}><span>Nome</span><input required maxLength={160} value={stage.name} onChange={e=>updateStage(ei,si,{name:e.target.value})}/></label>
        <label className={styles.field}><span>Tipo</span><select value={stage.kind} onChange={e=>updateStage(ei,si,{kind:e.target.value as Stage["kind"]})}><option value="registration">Inscrição</option><option value="exam">Prova</option><option value="result">Resultado</option><option value="enrollment">Matrícula</option><option value="event">Evento</option></select></label>
        <label className={styles.field}><span>Início: data ou horário com fuso</span><input required placeholder="2027-03-15 ou 2027-03-15T14:00:00-03:00" value={stage.start} onChange={e=>updateStage(ei,si,{start:e.target.value})}/></label>
        <label className={styles.field}><span>Fim, se houver</span><input value={stage.end??""} onChange={e=>updateStage(ei,si,{end:e.target.value||undefined})}/></label>
        <label className={styles.field}><span>Fonte oficial desta etapa</span><input required type="url" value={stage.sourceUrl??""} onChange={e=>updateStage(ei,si,{sourceUrl:e.target.value})}/></label>
        <label className={styles.field}><span>Fonte conferida em (UTC)</span><input required type="datetime-local" value={stage.checkedAt.slice(0,16)} onChange={e=>updateStage(ei,si,{checkedAt:e.target.value+":00Z"})}/></label>
        <button type="button" onClick={()=>setValue({...value,editions:value.editions.map((e,i)=>i===ei?{...e,stages:e.stages.filter((_,j)=>j!==si)}:e)})}>Remover etapa</button>
      </fieldset>)}
      {edition.stages.length<30 && <button type="button" onClick={()=>setValue({...value,editions:value.editions.map((e,i)=>i===ei?{...e,stages:[...e.stages,{id:crypto.randomUUID(),name:"",kind:"registration",start:"",sourceUrl:"",checkedAt:new Date().toISOString()}]}:e)})}>Adicionar etapa</button>}
      <button type="button" onClick={()=>setValue({...value,editions:value.editions.filter((_,i)=>i!==ei)})}>Remover edição</button>
    </fieldset>)}
    {value.editions.length<10 && <button type="button" onClick={()=>setValue({...value,editions:[...value.editions,{id:crypto.randomUUID(),name:"",stages:[]}]})}>Adicionar edição</button>}
    <p>Datas ausentes continuam sem preenchimento. O calendário usa as etapas confirmadas; a inscrição tem seu próprio prazo.</p>
  </fieldset>;
}

'use client';
import Link from 'next/link';
import { createContext, useActionState, useContext, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { saveOpportunityFromCard } from '@/app/membros/meu-calendario/actions';
import type { CalendarSaveState } from '@/lib/opportunities/calendar-save-types';
import styles from './save-opportunity.module.css';
import {AddToCollection} from './add-to-collection';

type SaveContext = {state:CalendarSaveState;returnTo:string;saved:Set<string>;update:(id:string,value:boolean)=>void};
const Context=createContext<SaveContext|null>(null);
export function CalendarSaveProvider({state,returnTo,children}:{state:CalendarSaveState;returnTo:string;children:ReactNode}) {
  const [saved,setSaved]=useState(()=>new Set(state.kind==='ready'?state.savedIds:[]));
  return <Context.Provider value={{state,returnTo,saved,update:(id,value)=>setSaved(previous=>{const next=new Set(previous);if(value)next.add(id);else next.delete(id);return next;})}}>{children}</Context.Provider>;
}
export function SaveOpportunityButton({id,title}:{id:string;title:string}) {
  const context=useContext(Context);
  if(!context||context.state.kind==='disabled')return null;
  if(context.state.kind==='unavailable')return <span className={styles.message}>Agenda temporariamente indisponível.</span>;
  if(context.state.kind==='redirect')return <Link className={styles.button} href={context.state.href} prefetch={false} aria-label={'Salvar '+title+' na minha agenda'}>Salvar na minha agenda</Link>;
  return <ReadySaveButton context={context} id={id} title={title}/>;
}
function ReadySaveButton({context,id,title}:{context:SaveContext;id:string;title:string}) {
  const router=useRouter();
  const saved=context?.saved.has(id)??false;
  const [message,action,pending]=useActionState(async()=>{
    let result;
    try {result=await saveOpportunityFromCard(id,!saved,context.returnTo);}catch{return 'Não foi possível salvar. Confira sua conexão e tente novamente.';}
    if(result.ok){context?.update(id,result.saved);return result.saved?'Salvo na sua agenda.':'Removido da sua agenda.';}
    if('redirect' in result){router.push(result.redirect);return '';}
    return result.error;
  },'');
  return <div><form action={action} className={styles.form}>
    <button className={styles.button} type="submit" disabled={pending} aria-pressed={saved} aria-label={(saved?'Remover ':'Salvar ')+title+(saved?' da minha agenda':' na minha agenda')}>{pending?'Salvando…':saved?'Salvo · remover':'Salvar na minha agenda'}</button>
    {message&&<span role="status" className={styles.message}>{message}{saved&&<> <Link href="/membros/meu-calendario">Ver minha agenda</Link></>}</span>}
  </form>{context.state.kind==='ready'&&context.state.collections&&<AddToCollection id={id} collections={context.state.collections}/>}</div>;
}

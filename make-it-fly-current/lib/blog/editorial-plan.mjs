export const FOCUSED_EDITORIAL_PLAN='technology-ai-business-4-3-3';
export const FOCUS_TARGETS=Object.freeze([
  Object.freeze({key:'tecnologia',label:'Tecnologia',target:4}),
  Object.freeze({key:'ia',label:'Inteligência Artificial',target:3}),
  Object.freeze({key:'negocios',label:'Negócios',target:3}),
]);
export const focusedEditorial=policy=>policy?.editorial_focus===FOCUSED_EDITORIAL_PLAN;
export function focusPool(topic){
  if(topic?.category==='tecnologia')return topic.subcategory==='ia'?'ia':'tecnologia';
  return topic?.category==='negocios'?'negocios':null;
}
const localDay=at=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(at);
export function extraBatch(policy,at=new Date()){
  const c=policy?.google_daily_completion;
  return focusedEditorial(policy)&&c?.day===localDay(at)&&c.extra_drafts===10?c:null;
}
export const baselinePostIds=(policy,at=new Date())=>extraBatch(policy,at)?.baseline_post_ids??[];
export const dailyDraftCap=(policy,at=new Date())=>policy.new_drafts_per_day_cap+(extraBatch(policy,at)?.extra_drafts??0);
// The baseline affects only the extra batch's editorial distribution. Raw day,
// week, calls and token counters always retain every original reservation.
export function topicAvailable(policy,usage,topic,at=new Date()){
  if(!focusedEditorial(policy)){
    const row=usage.find(u=>u.category===topic.category&&u.subcategory===topic.subcategory);
    return !row||(row.day<(policy?.per_topic_daily_cap??1)&&row.week<(policy?.per_topic_weekly_cap??7));
  }
  const target=FOCUS_TARGETS.find(t=>t.key===focusPool(topic));if(!target)return false;
  const rows=usage.filter(u=>focusPool(u)===target.key);
  const day=rows.reduce((n,u)=>n+Number(u.day),0);
  const baseline=extraBatch(policy,at)?rows.reduce((n,u)=>n+Number(u.baseline_day??0),0):0;
  const week=rows.reduce((n,u)=>n+Number(u.week),0);
  return Math.max(0,day-baseline)<target.target&&week<target.target*7;
}
export function focusProgress(rows,snapshot,at=new Date()){
  const extra=extraBatch({editorial_focus:snapshot?.editorial_focus,google_daily_completion:snapshot?.extra_batch},at);
  const counters=['drafts','complete','news','explainers','researching','compared','primary_pending','independent_pending','unavailable','format_pending','factual_pending','review_held'];
  return FOCUS_TARGETS.map(target=>{
    const source=rows.filter(r=>focusPool(r)===target.key),result={...target};
    for(const key of counters){
      const total=source.reduce((n,r)=>n+Number(r[key]??0),0);
      const prior=extra&&['drafts','complete','news','explainers'].includes(key)?source.reduce((n,r)=>n+Number(r['baseline_'+key]??0),0):0;
      result[key]=Math.max(0,total-prior);
    }
    return result;
  });
}

import {readFile} from 'node:fs/promises';
import {normalizeItem,buildRequest} from '../src/editorial.mjs';
export const defaultPolicy=JSON.parse(await readFile(new URL('../config/policy.json',import.meta.url),'utf8'));
export const identity={organization_id:'org-test',project_id:'proj-test'};
const legacyPolicy=JSON.parse(await readFile(new URL('../config/openai-legacy-policy.json',import.meta.url),'utf8'));
export const policy={...legacyPolicy,input_counting_mode:"provider",operator_commands_only:false,generation_enabled:true,model_id:'gpt-test-2026-11-01'};
export const source={id:'TEST',name:'Synthetic',editoria:'ia',type:'rss',url:'https://example.org/feed',article_hosts:['example.org'],
  interval_minutes:60,enabled:true,collection_approval_reference:'fixture-approval',feed_content_approved:true,rights_reference:'fixture-license',keywords:[]};
export function price(at=new Date()) {return {model:policy.model_id,provider:'openai_api',currency:'USD',approved:true,
  service_tier:'default',prompt_cache_ttl:'30m',cached_input_micro_usd_per_million:100000,cache_write_micro_usd_per_million:1000000,
  input_micro_usd_per_million:1000000,output_micro_usd_per_million:4000000,fixed_micro_usd:0,input_counting_free_verified:true,
  verified_at:at.toISOString(),valid_until:new Date(+at+86400000).toISOString(),evidence_url:'https://developers.openai.com/api/docs/pricing'};}
export function grant(at=new Date()) {return {...identity,provider_grant_id:'grant-test',state:'granted',balance_type:'included_subscription_benefit_only',
  amount_micro_usd:16000000,remaining_micro_usd:16000000,starts_at:new Date(+at-3600000).toISOString(),expires_at:new Date(+at+86400000).toISOString(),
  verified_at:at.toISOString(),no_paid_balance:true,no_auto_recharge:true,no_paid_billing:true,dedicated_project:true,verification_reference:'synthetic-fixture-not-a-provider-grant'};}
export function candidate(number=1,editoria='ia',at=new Date()) {return normalizeItem({title:'Research update number '+number,
  link:'https://example.org/research/'+number,isoDate:at.toISOString(),guid:'item-'+number,
  contentSnippet:'Researchers announced a new method for testing experimental software. The institutional announcement describes an early study and explains that additional evaluation is still required before practical use. No commercial launch or broad performance guarantee was announced.'},{...source,editoria},at);}
export const article={title:'Pesquisa apresenta método experimental',excerpt:'Uma equipe descreveu um método de avaliação que ainda depende de estudos adicionais.',
  seoTitle:'Método experimental em avaliação',seoDescription:'Saiba o que foi anunciado sobre o método de pesquisa e quais etapas ainda precisam de avaliação.',
  paragraphs:[{text:'O comunicado institucional apresenta uma proposta para avaliar sistemas experimentais e descreve o estágio inicial do estudo.',sourceIds:['E1']},
    {text:'Os resultados ainda exigem novas avaliações antes de uma aplicação prática. O anúncio não confirma um lançamento comercial.',sourceIds:['E1']}]};
export const completed={outcome:'completed',text:JSON.stringify(article),usage:{input_tokens:1000,output_tokens:500,total_tokens:1500,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:100}}};
export function reservation(at=new Date()) {return {id:'00000000-0000-0000-0000-000000000001',policy,body:buildRequest(candidate(1,'ia',at),policy),not_after:new Date(+at+180000).toISOString()};}

export const imagePolicy={...policy,automatic_image_generation_enabled:true,input_counting_mode:'local_byte_bound'};
export const imagePrice=()=>({model:'gpt-image-2',billing_mode:'standard',provider:'openai_api',currency:'USD',approved:true,quality:'medium',size:'1536x1024',
  input_micro_usd_per_million:5000000,output_micro_usd_per_million:30000000,verified_at:new Date().toISOString(),valid_until:new Date(Date.now()+86400000).toISOString(),evidence_url:'https://developers.openai.com/api/docs/guides/image-generation'});
export const imageUsage={input_tokens:150,output_tokens:1372,total_tokens:1522,input_tokens_details:{text_tokens:150,image_tokens:0}};
export function webpFixture(){
  // Container fixture only. The real pilot additionally decodes the API image with Sharp.
  const b=Buffer.alloc(30);b.write('RIFF');b.writeUInt32LE(22,4);b.write('WEBPVP8 ',8);b.writeUInt32LE(10,16);
  Buffer.from('9d012a','hex').copy(b,23);b.writeUInt16LE(1536,26);b.writeUInt16LE(1024,28);return b;
}

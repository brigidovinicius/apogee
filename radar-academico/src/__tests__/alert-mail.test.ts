import {afterEach,it,expect,vi} from 'vitest';
import {alertMailConfiguration,sendAlertMail}from'@/lib/alerts/mail';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
function configured(){vi.stubEnv('RADAR_ALERTS_ENABLED','true');vi.stubEnv('RADAR_RESEND_DOMAIN_VERIFIED','true');vi.stubEnv('RADAR_RESEND_API_KEY','re_fake_key_for_isolated_test');}
it('falha fechada sem chave, domínio verificado ou com limite acima do orçamento',()=>{
 expect(alertMailConfiguration()).toBeNull();configured();expect(alertMailConfiguration()?.dailyLimit).toBe(50);
 vi.stubEnv('RADAR_ALERTS_DAILY_LIMIT','51');expect(alertMailConfiguration()).toBeNull();
 vi.stubEnv('RADAR_ALERTS_DAILY_LIMIT','50');vi.stubEnv('RADAR_RESEND_DOMAIN_VERIFIED','false');expect(alertMailConfiguration()).toBeNull();
});
it('envia a um destinatário com idempotência, sem criar broadcast ou expor a chave',async()=>{
 configured();const fetcher=vi.fn(async()=>Response.json({id:'email-id'}));vi.stubGlobal('fetch',fetcher);
 await sendAlertMail({to:'subscriber@example.test',subject:'Aviso',text:'Atualização',messageId:'<job-id@apogee.community>'});
 const [url,request]=fetcher.mock.calls[0] as unknown as [string,RequestInit];
 expect(url).toBe('https://api.resend.com/emails');expect((request.headers as Record<string,string>)['Idempotency-Key']).toBe('radar-job-id@apogee.community');
 expect(JSON.parse(request.body as string).to).toEqual(['subscriber@example.test']);
 vi.stubGlobal('fetch',async()=>Response.json({message:'Quota exceeded'},{status:429}));
 await expect(sendAlertMail({to:'subscriber@example.test',subject:'Aviso',text:'Atualização',messageId:'<job-id@apogee.community>'})).rejects.toThrow('não confirmado');
});

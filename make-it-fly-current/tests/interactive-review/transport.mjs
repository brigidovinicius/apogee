export const events = [];
export const blocked = () => { throw new Error('REVIEW_WRITE_BLOCKED'); };
export const actor = { id: 'fixture-only', name: 'Pessoa Exemplo', username: 'exemplo', image: null, role: 'admin' };
export async function pause() { await new Promise(resolve => setTimeout(resolve, 100)); }
export function record(type, details = {}) { events.push({type,...details}); }
export async function fakeFetch(input, options = {}) {
  record('blocked-fetch', {path:String(input),method:options.method??'GET'});
  await pause();
  return Response.json({error:'Simulação: envio bloqueado. Nenhum arquivo foi gravado.'},{status:503});
}

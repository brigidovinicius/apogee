import "server-only";
import {AsyncLocalStorage} from "node:async_hooks";
export type GoogleTelemetry={googleCalls:number;httpErrors:number;networkErrors:number;quotaResponses:number;eventsChanged:number};
const storage=new AsyncLocalStorage<GoogleTelemetry>();
export const newGoogleTelemetry=():GoogleTelemetry=>({googleCalls:0,httpErrors:0,networkErrors:0,quotaResponses:0,eventsChanged:0});
export function withGoogleTelemetry<T>(sample:GoogleTelemetry,fn:()=>Promise<T>){return storage.run(sample,fn);}
export async function measuredGoogleFetch(input:string,init:RequestInit) {
  const sample=storage.getStore();if(sample)sample.googleCalls++;
  try{const response=await fetch(input,init);if(sample&&!response.ok)sample.httpErrors++;return response;}
  catch(error){if(sample)sample.networkErrors++;throw error;}
}
export function recordGoogleQuotaResponse(){const sample=storage.getStore();if(sample)sample.quotaResponses++;}
export function recordGoogleEventChange(){const sample=storage.getStore();if(sample)sample.eventsChanged++;}

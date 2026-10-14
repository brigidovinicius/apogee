export function alertMailConfiguration() {
  const apiKey=process.env.RADAR_RESEND_API_KEY;
  const from=process.env.RADAR_RESEND_FROM ?? "contato@apogee.community";
  const dailyLimit=Number(process.env.RADAR_ALERTS_DAILY_LIMIT ?? 50);
  if (process.env.RADAR_ALERTS_ENABLED!=="true" || process.env.RADAR_RESEND_DOMAIN_VERIFIED!=="true" ||
    !apiKey || !/^re_[A-Za-z0-9_-]{10,}$/.test(apiKey) || from!=="contato@apogee.community" ||
    !Number.isInteger(dailyLimit) || dailyLimit<1 || dailyLimit>50) return null;
  return {apiKey,from,dailyLimit};
}
export function alertsAvailable() { return alertMailConfiguration()!==null; }
export async function sendAlertMail(message:{to:string;subject:string;text:string;messageId:string}) {
  const config=alertMailConfiguration();
  if (!config) throw new Error("Envio de avisos indisponível");
  const response=await fetch("https://api.resend.com/emails",{method:"POST",redirect:"error",cache:"no-store",
    headers:{Authorization:`Bearer ${config.apiKey}`,"Content-Type":"application/json","Idempotency-Key":`radar-${message.messageId.replace(/[<>]/g,"")}`},
    body:JSON.stringify({from:`Apogee Radar <${config.from}>`,to:[message.to],subject:message.subject,text:message.text}),
    signal:AbortSignal.timeout(10_000)});
  // Never print provider responses: they can contain recipients or account details.
  if (!response.ok) throw new Error("Envio não confirmado pelo Resend");
  const body:unknown=await response.json();
  if (!body || typeof body!=="object" || !("id" in body) || typeof body.id!=="string" || !body.id) throw new Error("Envio não confirmado pelo Resend");
}

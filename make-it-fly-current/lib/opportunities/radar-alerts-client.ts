import "server-only";
import { readRequestBody } from "@/lib/request-body";
export async function radarAlertRequest(payload: Record<string,unknown>) {
  const url=process.env.RADAR_ACADEMICO_API_URL,token=process.env.RADAR_ACADEMICO_API_TOKEN;
  if (!url || !token) return {status:503,body:{error:"Avisos indisponíveis. Tente novamente mais tarde."}};
  try {
    const response=await fetch(new URL("/api/internal/alerts",url),{method:"POST",cache:"no-store",redirect:"error",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(5000)});
    const body=await response.json();
    if (!response.ok) return {status:[400,409].includes(response.status)?response.status:503,body:{error:typeof body.error==="string"?body.error:"Avisos indisponíveis"}};
    return {status:200,body:{ok:true}};
  } catch { return {status:503,body:{error:"Avisos indisponíveis. Tente novamente mais tarde."}}; }
}
export async function readAlertBody(request:Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim()!=="application/json" || Number(request.headers.get("content-length"))>4096 || !request.body) throw new Error("Solicitação inválida");
  const body: unknown = JSON.parse((await readRequestBody(request, 4096)).toString("utf8"));
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Solicitação inválida");
  return body as Record<string, unknown>;
}

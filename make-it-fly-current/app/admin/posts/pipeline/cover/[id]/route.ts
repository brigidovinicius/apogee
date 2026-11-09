import { getCurrentMember } from "@/lib/members/dal";
import { getSql } from "@/lib/members/db";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await getCurrentMember();
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!member) return new Response(null, { status: 401, headers });
  if (member.role !== "admin") return new Response(null, { status: 403, headers });
  const { id } = await params;
  if (!/^[a-f0-9]{64}$/.test(id)) return new Response(null, { status: 404, headers });
  const [job] = await getSql()<{ image: Buffer }[]>`select image from blog_worker.image_job where candidate_id=${id} and state='review' and image is not null`;
  if (!job) return new Response(null, { status: 404, headers });
  return new Response(new Uint8Array(job.image), { headers: { ...headers, "Content-Type": "image/webp" } });
}

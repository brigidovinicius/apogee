import { toolboxReturnPath } from "@/lib/billing/community-navigation";
import "server-only";
import { randomUUID } from "node:crypto";
import { requireMember, requireSignedInMember } from "@/lib/members/dal";
import { requireAdmin } from "@/lib/admin/access";
import { getSql } from "@/lib/members/db";
import { toolboxAccess } from "./access";
import { categoryInput, toolInput, toolUrl, ToolboxInputError } from "./validation";
import type { ToolboxCategory, ManagedTool, MemberTool, MemberToolCategory, ToolboxStatus } from "./types";

export class ToolboxConflictError extends Error {}
export async function memberToolbox(category: string | null = null) {
  const member = await requireSignedInMember(toolboxReturnPath(category));
  const access = await toolboxAccess(member);
  // Never load or serialize catalogue fields for an ineligible account.
  if (!access.allowed) return { member, access, categories: [] as MemberToolCategory[], tools: [] as MemberTool[] };
  await requireMember("/membros/ferramentas");
  const sql = getSql();
  const categories = await sql`select c.slug,c.name,c.description,count(t.id)::integer as count
    from member_tool_category c join member_tool t on t.category_id=c.id and t.status='published'
    where c.status='published' group by c.id order by c.sort_order,c.name,c.id`;
  const tools = await sql`select t.id,t.name,t.description,t.url,t.conditions,c.slug as category_slug,c.name as category_name
    from member_tool t join member_tool_category c on c.id=t.category_id
    where t.status='published' and c.status='published' and (${category}::text is null or c.slug=${category})
    order by c.sort_order,c.name,c.id,t.sort_order,t.name,t.id`;
  return { member, access,
    categories: categories.map(c => ({ slug: String(c.slug), name: String(c.name), description: c.description ? String(c.description) : null, count: Number(c.count) })),
    tools: tools.map(t => ({ id: String(t.id), name: String(t.name), description: String(t.description), url: toolUrl(String(t.url)),
      conditions: t.conditions ? String(t.conditions) : null, categorySlug: String(t.category_slug), categoryName: String(t.category_name) })),
  };
}

export async function adminToolbox() {
  const admin = await requireAdmin("/admin/ferramentas");
  const sql = getSql();
  const categories = await sql`select id,slug,name,description,status,sort_order,version from member_tool_category order by sort_order,name,id`;
  const tools = await sql`select t.id,t.category_id,t.name,t.description,t.url,t.conditions,t.status,t.sort_order,t.version,t.reviewed_at,u.name as reviewer_name
    from member_tool t left join "user" u on u.id=t.reviewed_by order by t.sort_order,t.name,t.id`;
  return { admin,
    categories: categories.map(c => ({ id: String(c.id), slug: String(c.slug), name: String(c.name), description: c.description ? String(c.description) : null,
      status: c.status as ToolboxStatus, order: Number(c.sort_order), version: Number(c.version) })) as ToolboxCategory[],
    tools: tools.map(t => ({ id: String(t.id), categoryId: String(t.category_id), name: String(t.name), description: String(t.description), url: String(t.url),
      conditions: t.conditions ? String(t.conditions) : null, status: t.status as ToolboxStatus, order: Number(t.sort_order), version: Number(t.version),
      reviewedAt: t.reviewed_at ? new Date(t.reviewed_at).toISOString() : null, reviewedByName: t.reviewer_name ? String(t.reviewer_name) : null })) as ManagedTool[],
  };
}

export async function writeToolboxCategory(actorId: string, form: FormData) {
  const input = categoryInput(form);
  return getSql().begin(async tx => {
    const [actor] = await tx`select id from "user" where id=${actorId} and role='admin' and blocked=false for share`;
    if (!actor) throw new ToolboxInputError("A curadoria exige uma conta administrativa ativa.");
    if (!input.id) {
      const id = randomUUID();
      await tx`insert into member_tool_category(id,slug,name,description,status,sort_order,updated_by)
        values(${id},${input.slug},${input.name},${input.description},${input.status},${input.order},${actor.id})`;
      return id;
    }
    // Slugs stay stable when an administrator renames a category.
    const updated = await tx`update member_tool_category set name=${input.name},description=${input.description},status=${input.status},
      sort_order=${input.order},version=version+1,updated_at=now(),updated_by=${actor.id}
      where id=${input.id} and version=${input.version} returning id`;
    if (updated.length !== 1) throw new ToolboxConflictError("Esta categoria mudou em outra edição. Reabra a ficha pela lista antes de salvar.");
    return String(updated[0].id);
  });
}

export async function writeToolboxTool(actorId: string, form: FormData) {
  const input = toolInput(form);
  return getSql().begin(async tx => {
    const [actor] = await tx`select id from "user" where id=${actorId} and role='admin' and blocked=false for share`;
    if (!actor) throw new ToolboxInputError("A curadoria exige uma conta administrativa ativa.");
    const [category] = await tx`select id from member_tool_category where id=${input.categoryId}`;
    if (!category) throw new ToolboxInputError("Escolha uma categoria existente.");
    const [previous] = input.id ? await tx`select * from member_tool where id=${input.id} for update` : [];
    if (input.id && (!previous || Number(previous.version) !== input.version)) {
      throw new ToolboxConflictError("Esta ferramenta mudou em outra edição. Reabra a ficha pela lista antes de salvar.");
    }
    const unchanged = previous && previous.name === input.name && previous.description === input.description &&
      previous.url === input.url && (previous.conditions ?? null) === input.conditions;
    const reviewedAt = input.reviewed ? new Date().toISOString() : unchanged && previous.reviewed_at ? new Date(previous.reviewed_at).toISOString() : null;
    const reviewedBy = input.reviewed ? String(actor.id) : reviewedAt ? previous.reviewed_by : null;
    if (input.status === "published" && !reviewedAt) throw new ToolboxInputError("Confirme a conferência da ficha e do link oficial antes de publicar.");
    const id = input.id ?? randomUUID();
    if (!previous) {
      await tx`insert into member_tool(id,category_id,name,description,url,conditions,status,sort_order,reviewed_at,reviewed_by,updated_by)
        values(${id},${input.categoryId},${input.name},${input.description},${input.url},${input.conditions},${input.status},${input.order},${reviewedAt},${reviewedBy},${actor.id})`;
    } else {
      await tx`update member_tool set category_id=${input.categoryId},name=${input.name},description=${input.description},url=${input.url},conditions=${input.conditions},
        status=${input.status},sort_order=${input.order},reviewed_at=${reviewedAt},reviewed_by=${reviewedBy},updated_by=${actor.id},updated_at=now(),version=version+1 where id=${id}`;
    }
    return id;
  });
}

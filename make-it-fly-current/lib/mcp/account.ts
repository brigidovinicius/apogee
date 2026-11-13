import "server-only";
import { revalidatePath } from "next/cache";
import { getMcpMember } from "./identity";
import { RadarToolError } from "./radar";
import { accountToolSchemas, type AccountToolName } from "./account-schemas";
import { applicationOrigin } from "@/lib/members/mail";
import { isGeneratedGoogleUsername } from "@/lib/members/validation";
import { adultAccess } from "@/lib/members/protection";
import { getOwnProfile } from "@/lib/members/forum";
import { radarAccess } from "@/lib/billing/store";
import { RADAR_ACCESS_PATH } from "@/lib/billing/config";
import { personalCalendarEnabled, savedOpportunities, saveOpportunity } from "@/lib/opportunities/personal-calendar";
import { collectionsEnabled, listOwnedCollections, ownedCollection, collectionItems, createCollection, patchCollection, setCollectionItem } from "@/lib/opportunities/collections";
import { CollectionError, type CalendarCollection } from "@/lib/opportunities/collection-types";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { opportunityCardData } from "@/lib/opportunities/card-data";
import { calendarEntries } from "@/lib/opportunities/discovery";
import { queueGoogleCalendarSync } from "@/lib/opportunities/google-calendar-store";

const url = (path: string) => `${applicationOrigin()}${path}`;
function page<T>(items: T[], input: { page?: number; pageSize?: number }) {
  const number = input.page ?? 1, size = input.pageSize ?? 12;
  return { items: items.slice((number - 1) * size, number * size), page: number, pageSize: size, total: items.length, hasMore: number * size < items.length };
}
function collectionData(item: CalendarCollection) {
  return { id: item.id, name: item.name, description: item.description, cover: item.cover, itemCount: item.itemCount,
    shared: item.visibility === "unlisted", apogeeUrl: url(`/membros/colecoes/${item.id}`) };
}

/** Bearer identity only. Recheck the site's current gates before every operation. */
export async function runAccountTool(userId: string, name: AccountToolName, args: unknown): Promise<Record<string, unknown>> {
  const schema = accountToolSchemas[name];
  if (!schema) throw new RadarToolError("unknown_tool", "Ferramenta indisponível.");
  if (!schema.safeParse(args).success) throw new RadarToolError("invalid_arguments", "Confira os argumentos informados.");
  const member = await getMcpMember(userId);
  if (!member) throw new RadarToolError("account_unavailable", "Conta indisponível. Entre novamente na Apogee.");
  if (member.nameNeedsConfirmation || isGeneratedGoogleUsername(member.username)) {
    throw new RadarToolError("profile_required", "Conclua seu perfil na Apogee.", url("/membros/perfil/configurar"));
  }
  if (!(await adultAccess(userId))) throw new RadarToolError("access_required", "Conclua a liberação da sua conta na Apogee.", url("/membros/protecao"));
  if (name === "get_account_profile") {
    const profile = await getOwnProfile(userId);
    if (!profile) throw new RadarToolError("account_unavailable", "Conta indisponível.");
    return { name: profile.name, username: profile.username, bio: profile.bio, apogeeUrl: url(`/membros/perfil/${member.username}`) };
  }
  if (!personalCalendarEnabled() || (name !== "list_my_calendar" && name !== "set_calendar_opportunity" && !collectionsEnabled())) {
    throw new RadarToolError("feature_unavailable", "Esta funcionalidade está indisponível na Apogee.");
  }
  if (!(await radarAccess(userId, process.env.STRIPE_MODE !== "test", { claimPurchases: false })).active) {
    throw new RadarToolError("access_required", "Seu acesso atual não permite usar calendário e coleções. Confira na Apogee.", url(RADAR_ACCESS_PATH));
  }
  try {
    if (name === "list_my_calendar") {
      const input = accountToolSchemas.list_my_calendar.parse(args);
      const saved = (await savedOpportunities(userId)).filter(item => !item.removedAt);
      const live = await listRadarOpportunities(true);
      const items = saved.map(ref => {
        const item = live.find(item => item.id === ref.id);
        // Historical snapshots can contain stale/private values. Never return them.
        return { id: ref.id, available: !!item, ...(item ? { opportunity: opportunityCardData(item),
          stages: calendarEntries([item]).map(entry => ({ key: entry.key, edition: entry.edition, stage: {
            id: entry.stage.id, kind: entry.stage.kind, name: entry.stage.name, start: entry.stage.start, end: entry.stage.end, checkedAt: entry.stage.checkedAt,
          } })) } : {}), apogeeUrl: url(`/membros/oportunidades/${ref.id}`) };
      });
      return { ...page(items, input), timeZone: "America/Sao_Paulo", apogeeUrl: url("/membros/meu-calendario") };
    }
    if (name === "set_calendar_opportunity") {
      const input = accountToolSchemas.set_calendar_opportunity.parse(args);
      await saveOpportunity(userId, input.opportunityId, !input.saved);
      // Preserve the user's existing Google connection, without creating one or
      // making a Google request here. The existing worker owns synchronization.
      let syncPending = false;
      try { syncPending = await queueGoogleCalendarSync(userId); } catch { /* The normal worker will retry; the Apogee save already succeeded. */ }
      revalidatePath("/membros/meu-calendario"); revalidatePath(`/membros/oportunidades/${input.opportunityId}`);
      return { opportunityId: input.opportunityId, saved: input.saved, syncPending, apogeeUrl: url("/membros/meu-calendario") };
    }
    if (name === "list_my_collections") return { ...page((await listOwnedCollections(userId)).map(collectionData), accountToolSchemas.list_my_collections.parse(args)) };
    if (name === "create_collection") {
      const input = accountToolSchemas.create_collection.parse(args);
      const id = await createCollection(userId, input);
      revalidatePath("/membros/colecoes");
      return { id, ...input, apogeeUrl: url(`/membros/colecoes/${id}`) };
    }
    const { collectionId } = args as { collectionId: string }; // Validated by the selected strict schema above.
    const owned = await ownedCollection(userId, collectionId);
    if (!owned) throw new RadarToolError("not_found", "Coleção indisponível.");
    if (name === "get_my_collection") {
      const input = accountToolSchemas.get_my_collection.parse(args);
      return { collection: collectionData(owned), ...page(await collectionItems(collectionId), input) };
    }
    if (name === "update_collection") {
      const input = accountToolSchemas.update_collection.parse(args);
      await patchCollection(userId, collectionId, { name: input.name, description: input.description, cover: input.cover });
    } else {
      const input = accountToolSchemas.set_collection_opportunity.parse(args);
      await setCollectionItem(userId, collectionId, input.opportunityId, input.present);
    }
    revalidatePath("/membros/colecoes"); revalidatePath(`/membros/colecoes/${collectionId}`);
    return { collection: collectionData((await ownedCollection(userId, collectionId)) ?? owned), updated: true };
  } catch (error) {
    if (error instanceof CollectionError) throw new RadarToolError("invalid_arguments", error.message);
    throw error;
  }
}

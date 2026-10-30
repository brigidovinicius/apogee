import { describe, expect, it, vi } from "vitest";
import { normalizeSpaceApps } from "@/lib/ingestion/normalize-space-apps";
import { changeDetails, changedFields } from "@/lib/alerts/monitoring";
import { sourceCheckHours } from "@/lib/ingestion/source-check-policy";
import { persistCandidate } from "@/lib/ingestion/persist-candidate";
import type { PoolClient } from "pg";
import type { OfficialSource } from "@/lib/ingestion/types";

const source = { id:"nasa-space-apps-2026",institutionName:"NASA Space Apps",extractionMode:"html" } as OfficialSource;
const url = "https://www.spaceappschallenge.org/2026/";
const page = (schedule = "Register to join us on November 14-15.") => `Welcome to the 2026 NASA Space Apps Challenge!
  ${schedule} REGISTER FOR THE HACKATHON August 26, 2026.
  You can register up until the hackathon closes on November 15.
  Choose the virtual Universal Event.`;
const extract = (text = page(), now = new Date("2026-10-30T15:00:00Z")) => normalizeSpaceApps({text,url,source},now);

describe("piloto de monitoramento NASA Space Apps", () => {
  it("separa inscrição e realização e preserva datas sem horário", () => {
    expect(extract()).toMatchObject({deadlineAt:"2026-11-15",eventStartsAt:"2026-11-14",
      discovery:{subtype:"hackathon",editions:[{id:"space-apps-2026",stages:[
        {id:"registration",kind:"registration",start:"2026-08-26",end:"2026-11-15"},
        {id:"hackathon",kind:"event",start:"2026-11-14",end:"2026-11-15"},
      ]}]}});
  });
  it("aceita informação ainda incompleta e rejeita datas inexistentes ou conflitantes", () => {
    expect(extract(page(""))).not.toHaveProperty("eventStartsAt");
    for (const schedule of ["Register to join us on November 31-32.","Register to join us on November 15-14.","Register to join us on November 14-15, 2027."]) {
      expect(extract(page(schedule))).toBeNull();
    }
  });
  it("não trata rodapé ou nova conferência como alteração de conteúdo", () => {
    const before = extract()!;
    const after = extract(`${page()} Footer updated today.`,new Date("2026-10-30T16:00:00Z"))!;
    expect(after.contentHash).toBe(before.contentHash);
    expect(after.discovery!.editions[0].stages[0].checkedAt).not.toBe(before.discovery!.editions[0].stages[0].checkedAt);
    expect(extract(page("Register to join us on November 13-15."))!.contentHash).not.toBe(before.contentHash);
    expect(sourceCheckHours(source.id)).toBe(6);
    expect(sourceCheckHours("other-source")).toBe(24);
  });
  it("compara datas antigas de snapshots sem avisos falsos por formato", () => {
    const before = {title:"NASA",state:"open",officialUrl:url,deadlinePrecision:"date_only",deadline:"2026-11-15T00:00:00.000Z",eventStartsAt:"2026-11-14T09:00:00-03:00"};
    expect(changedFields(before,{...before,deadline:"2026-11-15",eventStartsAt:"2026-11-14T12:00:00.000Z"})).toEqual([]);
    const details = changeDetails(before,{...before,eventStartsAt:"2026-11-13"});
    expect(details).toContain("14/11/2026");
    expect(details).toContain("13/11/2026");
  });
  it("preserva a data conhecida quando o calendário desaparece temporariamente da página", async () => {
    const query = vi.fn();
    await expect(persistCandidate({query} as unknown as PoolClient, source, extract(page(""))!, {
      mode:"automatic",existing:{id:"pilot",official_source_id:source.id,event_starts_at:"2026-11-14",deleted_at:null,
        version:1,management_overrides:{},content_hash:"initial"},
    })).rejects.toThrow("dados anteriores preservados");
    expect(query).not.toHaveBeenCalled();
  });
  it("não revela requisitos, condições financeiras ou inscrição oficial por e-mail", () => {
    const before = {title:"NASA",state:"open",officialUrl:url,requirements:"conteúdo anterior"};
    const details = changeDetails(before,{...before,requirements:"REQUISITO PROTEGIDO",benefit:"CONDIÇÃO PROTEGIDA",officialUrl:"https://private.example/registration"});
    expect(details).toContain("requisitos: informação atualizada");
    expect(details).not.toContain("PROTEGIDO");
    expect(details).not.toContain("PROTEGIDA");
    expect(details).not.toContain("private.example");
  });
});

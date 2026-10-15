import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";
const compile = async (path) => ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const groupingModule = { exports: {} }; new Function("module", "exports", await compile("../lib/opportunities/admission-processes.ts"))(groupingModule, groupingModule.exports);
const { groupAdmissionProcesses } = groupingModule.exports;
const course = (id, patch = {}) => ({ id, title: id, kind: "Curso", officialUrl: "https://www.ifsc.edu.br/tecnicos", deadline: "2026-10-30", opportunityStatus: "open", admissionProcess: { id: "ifsc-2027", title: "IFSC 2027" }, ...patch });
test("one card per process preserves course identities, edits and separate admissions", () => {
 const original = [course("edited", { title: "Título editado" }), course("two"), course("lottery", { admissionProcess: null }), course("ifc", { admissionProcess: { id: "ifc-2027", title: "IFC 2027" }, officialUrl: "https://ingresso.ifc.edu.br" })];
 const grouped = groupAdmissionProcesses(original);
 assert.equal(grouped.total, 3); assert.equal(grouped.groups.length, 2); assert.equal(grouped.standalone.length, 1);
 assert.deepEqual(grouped.groups[0].courses.map(c=>c.id), ["edited", "two"]); assert.equal(grouped.groups[0].courses[0].title, "Título editado");
 assert.equal(original.length,4); assert.equal(groupAdmissionProcesses(original.filter(c=>c.id!=="two")).groups[0].courses.length,1);
 assert.equal(groupAdmissionProcesses(original.filter(c=>c.id==="two")).total,1);
});
test("different deadlines and statuses preserve one process and individual course windows", () => {
 const grouped = groupAdmissionProcesses([course("a"), course("b", { deadline: "2026-11-01" }), course("c", { opportunityStatus: "upcoming" })]);
 assert.equal(grouped.total,1); assert.equal(grouped.groups[0].courses.length,3);
 assert.equal(groupAdmissionProcesses([course("not-course",{kind:"Bolsa"})]).standalone.length,1);
});
test("process card exposes course details and original management IDs", async () => {
 const React = await import("react"); const { renderToStaticMarkup } = await import("react-dom/server");
 const loaded={exports:{}}; const mocks={"react/jsx-runtime":await import("react/jsx-runtime"),"next/link":{__esModule:true,default:({children,...props})=>React.createElement("a",props,children)},"lucide-react":{ArrowUpRight:()=>null},"./opportunity-countdown":{OpportunityCountdown:()=>null},"./opportunity-financials":opportunityLoader()("components/opportunities/opportunity-financials.tsx"),"./opportunities.module.css":{__esModule:true,default:{}}};
 new Function("require","module","exports",await compile("../components/opportunities/admission-process-card.tsx"))(name=>{if(!(name in mocks))throw Error(name);return mocks[name]},loaded,loaded.exports);
 const group=groupAdmissionProcesses([course("radar-original-id",{organization:"IFSC",verifiedAt:"2026-10-14",deadlineLabel:"Inscrições até 30 de outubro",eligibility:"Prova no câmpus",benefit:"Conferir taxa",location:"SC",level:"Ensino médio"})]).groups[0];
 const html=renderToStaticMarkup(React.createElement(loaded.exports.AdmissionProcessCard,{group,management:true}));
 assert.match(html,/<details/); assert.match(html,/Ver cursos, câmpus e requisitos/); assert.match(html,/editar=original-id/); assert.match(html,/Prova no câmpus/); assert.match(html,/Conferir taxa/); assert.match(html,/Ver processo seletivo/);
});
test("public and management board count processes and filter course options before grouping", async () => {
 const React = await import("react"), jsx=await import("react/jsx-runtime"), {renderToStaticMarkup}=await import("react-dom/server");
 const location=await readFile(new URL("../lib/opportunities/location.ts",import.meta.url),"utf8");
 const types=(await readFile(new URL("../lib/opportunities/types.ts",import.meta.url),"utf8")).replace(/^import \{[\s\S]*?\} from "@\/lib\/opportunities\/location";\s*/m,"");
 const logic=await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(location+types,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString("base64")}`);
 let query=""; const loaded={exports:{}};
 const mocks={"react/jsx-runtime":jsx,"react":React,"next/navigation":{useRouter:()=>({replace(){}}),usePathname:()=>"/oportunidades",useSearchParams:()=>new URLSearchParams(query)},"next/link":{__esModule:true,default:({children,...p})=>React.createElement("a",p,children)},"lucide-react":new Proxy({},{get:()=>()=>null}),"@/lib/opportunities/types":logic,"@/lib/opportunities/admission-processes":{groupAdmissionProcesses},"./admission-process-card":{AdmissionProcessCard:({group})=>React.createElement("div",{"data-process":group.id},group.courses.map(c=>c.title).join(" | "))},"./opportunity-countdown":{OpportunityCountdown:()=>null},"./opportunity-financials":opportunityLoader()("components/opportunities/opportunity-financials.tsx"),"./opportunity-alert":{OpportunityAlert:()=>null},"./live-refresh":{LiveCatalogueRefresh:()=>null},"./opportunities.module.css":{__esModule:true,default:{}}};
 new Function("require","module","exports",await compile("../components/opportunities/opportunities-board.tsx"))(name=>{if(!(name in mocks))throw Error(name);return mocks[name]},loaded,loaded.exports);
 const base={organization:"IFSC",deadline:"2099-10-30",verifiedAt:"2026-10-14",deadlineLabel:"Prazo",eligibility:"Seleção por prova",benefit:"Ver taxa",summary:"Inscrições",location:"SC",stateCode:"SC",level:"Ensino médio",categories:["formacao"]};
 const opportunities=[course("a",{...base,title:"Mecatrônica",cityName:"Blumenau"}),course("b",{...base,title:"Informática",cityName:"Joinville"}),course("c",{...base,title:"Curso por sorteio",admissionProcess:null})];
 const render=management=>renderToStaticMarkup(React.createElement(loaded.exports.OpportunitiesBoard,{opportunities,management})).replace(/<!--.*?-->/g,"");
 for(const management of [false,true]){const html=render(management);assert.match(html,/2 oportunidades visíveis/);assert.equal((html.match(/data-process=/g)||[]).length,1);assert.match(html,/Mecatrônica \| Informática/);if(management)assert.match(html,/Cobertura do Radar: 2 de 1.000/);}
 query="busca=Mecatrônica";let html=render(false);assert.match(html,/1 oportunidade visível/);assert.match(html,/data-process="ifsc-2027">Mecatrônica</);assert.doesNotMatch(html,/data-process="ifsc-2027">.*Informática/);
 query="uf=SC&cidade=Joinville";html=render(false);assert.match(html,/1 oportunidade visível/);assert.match(html,/data-process="ifsc-2027">Informática</);
});

(()=>{
  if (!["localhost","127.0.0.1","[::1]"].includes(location.hostname)) return;
  const params=new URLSearchParams(location.search);
  const sessionKey="apogee.visual.review";
  if (!params.has("ap-revisao") && !sessionStorage.getItem(sessionKey)) return;
  sessionStorage.setItem(sessionKey,"1");
const roles = {
  "ap-button=primary": '[class*="heroPrimary__"],[class*="navyButton__"],[class*="memberLink__"],[class*="community-offer_button__"],[class*="opportunities_detailButton__"],[class*="previewPrimary__"],[class*="skyButton__"],[class*="joinAction__"] > :is(a,button)',
  "ap-button=secondary": '[class*="heroSecondary__"],[class*="filterTrigger__"],[class*="filterClose__"],[class*="clearFilters__"],[class*="community-offer_secondary__"],[class*="carouselControls__"] button',
  "ap-chip": '[class*="radarFilters__"] button,[class*="filterGroup__"] button',
  "ap-card": '[class*="resourceLink__"],[class*="community-offer_pillar__"],[class*="opportunities_card__"],[class*="benefits_card__"]',
  "ap-title": '[class*="sectionHeading__"] h2,[class*="resourceLink__"] h3,[class*="opportunities_boardHeading__"] h2,[class*="community-offer_overview__"] h2',
  "ap-signature": '[class*="communityWord__"]',
  "ap-panel": '#opportunity-filter-panel,[class*="mobileNavigation__"] nav,[class*="nextStep__"]',
  "ap-reveal": '[class*="sectionHeading__"],[class*="headingRow__"]'
};
const iconRoutes = {
  ferramentas:["#ferramentas","/membros/ferramentas"], learn:["#learn","/membros/trilha"],
  radar:["#radar","/oportunidades","/membros/oportunidades"], perks:["#perks","/beneficios","/membros/beneficios"],
  participar:["#participar"]
};
const aliases={...roles};
for (const [key,[anchor,...paths]] of Object.entries(iconRoutes)) {
  aliases["ap-icon="+key]=[
    'a[class*="resourceLink__"][href$="'+anchor+'"]',
    '[class*="directoryPanel__"]:has(a[href="'+anchor+'"])',
    ...paths.map(path=>'[class*="community-offer_pillar__"]:has(a[href="'+path+'"])')
  ].join(",");
}
for (const role of ["ap-button","ap-icon"]) aliases[role]=Object.entries(aliases)
  .filter(([name])=>name.startsWith(role+"=")).map(([,selector])=>selector).join(",");
// Match existing components in CSS so React retains exclusive ownership of their DOM.
function adaptSelectors(css) {
  return css.replace(/\[data-(ap-[\w-]+)(?:=([\w-]+))?\]/g,(match,role,value)=>{
    const selector=aliases[value ? role+"="+value : role];
    return selector ? ":is("+match+",:where(html[data-ap-review]) :is("+selector+"))" : match;
  });
}
const entries=[["comunidade","A comunidade","/#recursos"],["home","Home","/"],["menu","Menu mobile","/"],["vendas","Página de vendas","/comunidade"],["radar","Radar","/oportunidades"],["membros","Membros · demonstração","/previa/membros"],["beneficios","Benefícios","/beneficios"]];
const bar=document.createElement("aside");
bar.setAttribute("aria-label","Controles da revisão visual");
bar.id="ap-review-controls";
bar.innerHTML='<strong>Apogee · revisão visual</strong><label>Tela <select aria-label="Tela" id="ap-view"></select></label><label>Tema <select aria-label="Tema" id="ap-theme"><option value="sistema">Sistema</option><option value="claro">Claro</option><option value="escuro">Escuro</option></select></label><label><input id="ap-compare" type="checkbox"> Ver original</label><button type="button" id="ap-exit">Sair da prévia</button>';
document.body.prepend(bar);
const chooser=bar.querySelector("#ap-view"),theme=bar.querySelector("#ap-theme"),compare=bar.querySelector("#ap-compare");
for (const [id,label] of entries) chooser.add(new Option(label,id));
const saved=localStorage.getItem("apogee.review.theme");
const preferred=params.get("tema") || saved;
theme.value=["claro","escuro","sistema"].includes(preferred) ? preferred : "sistema";
const system=matchMedia("(prefers-color-scheme: dark)");
const sheet=document.createElement("style");
sheet.dataset.apLocalAdapter="";
document.head.append(sheet);
async function loadAdapter() {
  const files=["apogee.css","legacy-preview.css"];
  const sources=await Promise.all(files.map(async file=>{
    const response=await fetch("/design-system/"+file);
    if (!response.ok) throw new Error(file);
    return response.text();
  }));
  sheet.textContent=sources.map(adaptSelectors).join("\n");
  if (params.get("ap-revisao")==="comunidade" && location.hash==="#recursos") {
    requestAnimationFrame(()=>document.getElementById("recursos")?.scrollIntoView({behavior:"instant",block:"start"}));
  }
}
const persistent=document.createElement("link");
persistent.rel="stylesheet";persistent.href="/design-system/review-toolbar.css";document.head.append(persistent);
const docRoot=document.documentElement;
function refresh() {
  if (compare.checked) return;
  docRoot.dataset.apReview="";
  docRoot.dataset.apTheme=theme.value;
  docRoot.dataset.apEffective=theme.value==="escuro" || (theme.value==="sistema" && system.matches) ? "dark":"light";
  docRoot.toggleAttribute("data-ap-mobile-menu",new URLSearchParams(location.search).get("ap-revisao")==="menu");
  sheet.disabled=false;
}
function reset() {
  sheet.disabled=true;
  for (const name of ["data-ap-review","data-ap-effective","data-ap-theme","data-ap-mobile-menu"]) docRoot.removeAttribute(name);
}
function pickRoute() {
  const key=new URLSearchParams(location.search).get("ap-revisao");
  const matching=entries.find(([id,,route])=>id===key && route.split("#")[0]===location.pathname) ||
    entries.find(([,,route])=>route===location.pathname);
  if (matching) chooser.value=matching[0];
}
chooser.addEventListener("change",()=>{
  const entry=entries.find(([id])=>id===chooser.value);
  const next=new URL(entry[2],location.origin);next.searchParams.set("ap-revisao",entry[0]);
  next.searchParams.set("tema",theme.value);location.assign(next.href);
});
theme.addEventListener("change",()=>{localStorage.setItem("apogee.review.theme",theme.value);refresh();});
compare.addEventListener("change",()=>{if(compare.checked) reset();else refresh();});
system.addEventListener("change",refresh);
bar.querySelector("#ap-exit").addEventListener("click",()=>{
  sessionStorage.removeItem(sessionKey);const url=new URL(location.href);url.searchParams.delete("ap-revisao");url.searchParams.delete("tema");location.replace(url.href);
});
window.addEventListener("popstate",()=>{pickRoute();refresh();});
window.navigation?.addEventListener("currententrychange",()=>{pickRoute();refresh();});
pickRoute();refresh();
loadAdapter().catch(()=>{bar.querySelector("strong").textContent="Acabamento indisponível · recarregue a prévia";});
})();

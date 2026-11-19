(()=>{
  if (!["localhost","127.0.0.1","[::1]"].includes(location.hostname)) return;
  const params=new URLSearchParams(location.search);
  const sessionKey="apogee.visual.review";
  if (!params.has("ap-revisao") && !sessionStorage.getItem(sessionKey)) return;
  sessionStorage.setItem(sessionKey,"1");
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
const persistent=document.createElement("link");
persistent.rel="stylesheet";persistent.href="/design-system/review-toolbar.css";document.head.append(persistent);
const docRoot=document.documentElement;
function toggleSheets(enabled) {
  for (const id of ["ap-foundations", "ap-interface"]) {
    const link = document.getElementById(id);
    if (link) link.disabled = !enabled;
  }
}
function refresh() {
  if (compare.checked) return;
  docRoot.dataset.apInterface="";
  docRoot.dataset.apTheme=theme.value;
  docRoot.toggleAttribute("data-ap-mobile-menu",new URLSearchParams(location.search).get("ap-revisao")==="menu");
  toggleSheets(true);
}
function reset() {
  toggleSheets(false);
  for (const name of ["data-ap-interface","data-ap-theme","data-ap-mobile-menu"]) docRoot.removeAttribute(name);
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
bar.querySelector("#ap-exit").addEventListener("click",()=>{
  sessionStorage.removeItem(sessionKey);const url=new URL(location.href);url.searchParams.delete("ap-revisao");url.searchParams.delete("tema");location.replace(url.href);
});
window.addEventListener("popstate",()=>{pickRoute();refresh();});
window.navigation?.addEventListener("currententrychange",()=>{pickRoute();refresh();});
pickRoute();refresh();
})();

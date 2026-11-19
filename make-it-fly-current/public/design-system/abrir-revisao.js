if (["localhost","127.0.0.1","[::1]"].includes(location.hostname)) {
  const query=new URLSearchParams(location.search);
  const routes={comunidade:"/#recursos",home:"/",menu:"/",vendas:"/comunidade",radar:"/oportunidades",membros:"/previa/membros",beneficios:"/beneficios"};
  const view=Object.hasOwn(routes,query.get("tela")) ? query.get("tela") : "comunidade";
  const dest=new URL(routes[view],location.origin);
  dest.searchParams.set("ap-revisao",view);
  if (["claro","escuro","sistema"].includes(query.get("tema"))) dest.searchParams.set("tema",query.get("tema"));
  location.replace(dest.href);
}

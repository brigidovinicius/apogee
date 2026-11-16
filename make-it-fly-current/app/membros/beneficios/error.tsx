"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <section><h2>Não foi possível carregar os benefícios.</h2><p>Seu acesso não foi alterado. Tente novamente em instantes.</p><button onClick={reset}>Tentar novamente</button></section>; }

"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <section><h2>Não foi possível carregar a Trilha.</h2><p>Seu progresso está preservado. Tente novamente em instantes.</p><button onClick={reset}>Tentar novamente</button></section>; }

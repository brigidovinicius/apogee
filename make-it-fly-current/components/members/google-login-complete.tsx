"use client";

import { useEffect } from "react";

export function GoogleLoginComplete({ authenticated }: { authenticated: boolean }) {
  useEffect(() => { if (authenticated) window.close(); }, [authenticated]);
  return <button type="button" onClick={() => window.close()}>Fechar esta janela</button>;
}

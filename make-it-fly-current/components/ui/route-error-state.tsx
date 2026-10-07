"use client";

import Link from "next/link";
import { StatePanel, statePanelStyles } from "./state-panel";

type RouteErrorStateProps = {
  retry: () => void;
  homeHref?: string;
};

export function RouteErrorState({ retry, homeHref = "/" }: RouteErrorStateProps) {
  return (
    <StatePanel
      eyebrow="Apogee"
      title="Não foi possível carregar esta página."
      description="Tente novamente. Se o problema continuar, volte ao início e retome por lá."
      role="alert"
      actions={
        <>
          <button className={statePanelStyles.primary} type="button" onClick={retry}>
            Tentar novamente
          </button>
          <Link className={statePanelStyles.secondary} href={homeHref}>
            Voltar ao início
          </Link>
        </>
      }
    />
  );
}

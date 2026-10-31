# Compatibilidade de transporte — 30/10/2026

As três páginas abaixo responderam por HTTP/1.1 com status 200 e `Content-Encoding: gzip`, apesar da solicitação `Accept-Encoding: identity`. Os respectivos robots.txt responderam 200. A verificação usou GET público, TLS válido e limite de 2 MiB, sem formulários, autenticação ou cookies.

| Alvo | Página exata |
|---|---|
| Fisiologia | https://obfis.cienciasecognicao.org/ |
| Brazilian Brain Bee | https://brazilianbrainbee.org/ |
| Neurociências para Graduandos | https://obng.cienciasecognicao.org/ |

A compatibilidade no coletor é restrita ao identificador do alvo, hostname e caminho `/`. Ela usa o decodificador gzip já existente, que limita tanto a entrada comprimida quanto a saída descomprimida. Robots, TLS, DNS público validado, redirecionamentos, timeout e rate limit continuam aplicáveis. Não há fallback de certificado nem desbloqueio de páginas que proíbem consulta.

O aumento experimental do teto para 4 MiB não resolveu essas respostas e foi revertido: permanece 2 MiB. A coleta real posterior determina a elegibilidade de cada monitor; cabeçalhos de teste não ativam o alvo por si sós.

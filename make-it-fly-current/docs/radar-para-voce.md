# Radar Para você

O piloto cruza as preferências privadas da conta com o catálogo publicado do Radar. A entrada fica em **Radar → Para você** e **Editar perfil → Preferências do Radar**.

O membro pode combinar seis perfis, assuntos do catálogo e tipos de oportunidade. Curso, etapa e localização são opcionais. A modalidade escolhida restringe a seleção. O motor exclui fichas vencidas, incompatibilidades acadêmicas conhecidas e indicações ocultadas pelo membro. Os cartões mostram o motivo da recomendação e usam as mesmas prévias e permissões do catálogo.

## Avisos

O envio fica desativado por padrão. A operação usa o provedor de e-mail de membros, requer a opção escolhida na conta e envia apenas a endereços verificados. O resumo usa a semana de Brasília. A opção de prazos próximos pode enviar um aviso adicional para fichas com prazo de até 72 horas. A fila verifica a data em que a ficha apareceu no catálogo, a elegibilidade, a modalidade e a existência de um prazo útil. Uma rechecagem da fonte não reinicia a idade da oportunidade.

Os avisos incluem o motivo, o prazo, a ficha no Radar e o link para ajustar ou pausar a preferência. O histórico impede avisos repetidos da mesma oportunidade. O orçamento diário da rodada usa UTC e conta tentativas. O padrão é 10, configurável de 1 a 50.

## Operação do piloto

- Site e Radar são serviços distintos. A migração de membros é `0031_radar_preferences.sql`. O Radar fornece a data de publicação no contrato de catálogo existente. A recomendação em tela aceita o contrato anterior durante uma atualização gradual.
- Com o envio aprovado, configurar `RADAR_PROFILE_MAIL_ENABLED`, `RADAR_PROFILE_MAIL_SECRET` com pelo menos 32 caracteres e o orçamento `RADAR_PROFILE_MAIL_DAILY_LIMIT` no serviço web. O agendador do ambiente pode chamar `POST /api/internal/radar/preference-mail` usando o segredo no cabeçalho `Authorization: Bearer …`. Uma rodada examina até cinco contas e responde com contagens agregadas.
- A rodada só envia oportunidades publicadas após a ativação dos avisos pela pessoa e dentro dos últimos sete dias. Convém observar o volume de indicações por perfil. Uma amostra com pouca oferta para founders indica a necessidade de ampliar as fontes de fomento e aceleração.
- A reversão do envio usa `RADAR_PROFILE_MAIL_ENABLED=false`. Preferências e indicações ocultadas ficam no banco de membros.

## Verificação local

- PostgreSQL temporário aplicou as 32 migrações registradas e verificou preferências, isolamento por conta e exclusão em cascata.
- A verificação isolada do motor executou dez cenários sintéticos, incluindo os seis perfis, combinações, localização, prazo e ocultação. Uma amostra de 26 fichas reais do Radar exercitou as indicações para estudante de Computação, entusiasta de IA e founder.
- `node --test --test-concurrency=1 tests/radar-*.test.mjs` passou com 157 testes. O typegen, o typecheck e o build otimizado da prévia local passaram. A integração do serviço Radar passou com 70 testes, incluindo a entrega da data de publicação e sua estabilidade após nova conferência da fonte.
- Em 27/11/2026, no navegador interno, duas contas temporárias usaram o login da Apogee com um catálogo de cinco fichas de teste. A troca de IA por Artes e design substituiu a indicação temática e conservou os hackathons de Builder. A troca de Builder por Founder trouxe uma aceleração e conservou o workshop de Design.
- A ocultação persistiu após recarregar, ficou restrita à conta que a fez e a segunda conta manteve sua recomendação. A navegação da ficha retornou à aba **Para você**.
- A entrega real de e-mail permanece pendente. O envio ficou desativado na prévia.

# Fotos aprovadas do boné Apogee — 01/11/2026

O usuário aprovou as três prévias e autorizou atualizar as fotos, usando a vista em três quartos como principal. A loja passa a apresentar esse modelo com estrela azul-marinho na frente, assinatura Apogee na lateral e ajuste traseiro.

## Alteração

- Ordem da galeria: três quartos, frente, costas.
- Nome exibido: Boné Apogee. Descrição, textos alternativos e metadados deixam de descrever a antiga frase frontal.
- O identificador interno `bone-made-to-create` permanece para preservar referências existentes.
- PNGs aprovados preservados integralmente, em 1254 × 1254 px, com novos nomes de arquivo para invalidar caches. O componente `next/image` existente continua responsável pela otimização e pelas miniaturas.
- As imagens anteriores permanecem disponíveis para rollback. Nenhuma mudança em compras, cadastros ou dados reais.

## Integridade dos arquivos aprovados

| Vista | SHA-256 |
| --- | --- |
| Três quartos | `4852dd3062d671abef3036d4ddebc1820ce9ec07702db54ac78559375fc93dba` |
| Frente | `b5ca8da6a60f4df4d535409d780af40117c6546709246609708c2cca35155669` |
| Costas | `0e42fa9f2c98b4f611c0904daff3e2c7f3330a8d779d945fa8bddbf6501035fb` |

## Validação local

- Dimensões e SHA-256: os três arquivos são cópias idênticas às imagens geradas e aprovadas nesta conversa.
- Testes existentes `store-drop-signups`, `store-drops-admin` e `store-drops-migration`: 17 aprovados, executados pela fila npm obrigatória.
- ESLint dos dois arquivos TypeScript alterados e `git diff --check`: aprovados.
- Build e verificações completas: executar no CI do PR antes de integrar e publicar.

## Publicação

Seguir `docs/apogee-routine-vps-deploy.md`, publicando apenas o serviço web após o CI. No preflight inicial, checkout remoto limpo e web saudável na revisão `9e83520d506107af0b664279aea51998f274d744`. A base atual `fa5f322` difere dessa revisão somente em documentação e no agendamento de um workflow; não traz mudanças adicionais no código executado do site.

Após publicar, registrar SHA exato, saúde e verificação pública da galeria em desktop e mobile no runbook remoto. Não executar migrações, alterar configuração nem recriar serviços vizinhos.

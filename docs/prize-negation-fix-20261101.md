# Correção da identificação de premiações negadas

A publicação inicial da PR #106 foi validada em 01/11/2026 no SHA `15606126069f0e9099692d54d3a274a2ad7d2235`. Os nove smokes HTTP passaram, o web ficou saudável e os 12 containers vizinhos e o ambiente foram preservados. A conferência visual com dados reais encontrou um falso positivo preexistente no parser, agora exposto pelo novo destaque financeiro da home.

## Caso observado e correção

A descrição pública do hackathon UFMS dizia que a notícia **não garante bolsa ou prêmio em dinheiro**. O parser procurava a expressão “prêmio em dinheiro”, mas não reconhecia “não garante” como negação. Isso produziu indevidamente o rótulo PREMIAÇÃO e um reforço de ranking.

Foi restaurada imediatamente a imagem anterior `apogee-site:cf6783d24e496fa8d07f709592f3a86b7d6ba3d7`, com checkout e label correspondentes, saúde `healthy` e zero reinícios. O backend Radar permaneceu na revisão `d2c80ade6811185c6758b6fc597a67b54c86896e` da outra tarefa. Nenhum registro real foi alterado.

O parser agora reconhece negações de garantia, anúncio, confirmação e existência de benefícios, antes ou depois da expressão financeira. A avaliação permanece por frase; uma negação de bolsa em uma frase não apaga a premiação confirmada em outra. A mesma proteção impede o fallback de bolsa sem valor informado de transformar essa negação em benefício.

## Validação da correção

- A regressão com a frase real falhou antes da correção, reproduzindo o rótulo indevido.
- 53 testes da home, ranking, catálogo e apresentação financeira passaram após a correção. A nova regressão inclui 11 descrições de negação com três tipos de benefício, a descrição completa do catálogo, preservação de uma premiação afirmativa separada e comparação da ordem do feed.
- ESLint dos dois arquivos e `npm run typecheck`: aprovados, sequencialmente pela fila global.
- `git diff --check`: aprovado.
- Uma auditoria apenas de leitura examinou as descrições públicas do catálogo com expressões semelhantes. Nenhum cadastro, inscrição, alerta, fonte ou pagamento foi modificado.
- A alteração permanece restrita ao cliente de dados do site e ao teste correspondente. O fluxo de descoberta/ingestão da outra tarefa não foi alterado.

CI completo e nova publicação devem ser concluídos antes de considerar a entrega encerrada. A autorização vigente do usuário cobre os ajustes de layout/destaques e esta correção necessária para apresentá-los corretamente.

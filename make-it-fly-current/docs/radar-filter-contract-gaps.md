# Contrato de filtros estruturados do Radar

O consumidor web filtra somente campos estruturados já recebidos: `benefitType`
(apresentado como modalidade) e `applicantType` (apresentado como formação). Os
campos textuais `amountText` e `requirementsText` não são interpretados para
inferir remuneração, localização ou idade.

O contrato v2 do produtor fornece estes campos opcionais por oportunidade:

- `compensationType`: `paid`, `unpaid` ou `not_informed`;
- `countryCode`: código ISO 3166-1 alfa-2, por exemplo `BR`;
- `stateCode`: sigla da unidade federativa, por exemplo `SP`;
- `cityName`: nome oficial do município, associado a `stateCode`;
- `minimumAge`: idade mínima inteira em anos;
- `maximumAge`: idade máxima inteira em anos.

`stateCode` e `cityName` representam o local de elegibilidade ou execução
confirmado em campo estruturado, não um endereço extraído de texto livre. A UF
aceita somente as 27 siglas canônicas; cidade sem UF é inválida. Valores ausentes,
nacionais ou internacionais permanecem `null`, aparecem somente em **Todos** e
não geram opções de filtro.

O consumidor continua aceitando respostas v1 durante a transição, tratando a
localização como ausente. Ativar os campos no produtor exige aplicar a migração
`0002_canonical_location.sql` e publicar o serviço Radar em um gate separado.

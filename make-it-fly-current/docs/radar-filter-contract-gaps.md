# Lacunas do contrato para filtros do Radar

O consumidor web filtra somente campos estruturados já recebidos: `benefitType`
(apresentado como modalidade) e `applicantType` (apresentado como formação). Os
campos textuais `amountText` e `requirementsText` não são interpretados para
inferir remuneração, localização ou idade.

Uma tarefa futura e separada no produtor externo deverá versionar o contrato e
fornecer estes campos opcionais por oportunidade:

- `compensationType`: `paid`, `unpaid` ou `not_informed`;
- `countryCode`: código ISO 3166-1 alfa-2, por exemplo `BR`;
- `stateCode`: sigla da unidade federativa, por exemplo `SP`;
- `cityName`: nome oficial do município, associado a `stateCode`;
- `minimumAge`: idade mínima inteira em anos;
- `maximumAge`: idade máxima inteira em anos.

`stateCode` e `cityName` devem representar o local de elegibilidade ou execução
definido pelo produtor, não um endereço extraído de texto livre. Valores ausentes
ou `not_informed` não devem gerar opções de filtro. Até essa evolução, esses
controles não aparecem no site Apogee.

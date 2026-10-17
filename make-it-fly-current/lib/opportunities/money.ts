const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export function formatMoney(amount: number, currency = "BRL") {
  return (currency === "BRL" ? brl : new Intl.NumberFormat("pt-BR", {
    style: "currency", currency, currencyDisplay: "code",
  })).format(amount).replace(/\u00a0/g, " ");
}

/** Only unambiguous BRL literals are normalized; other currencies keep their source spelling. */
export function moneyTextParts(text: string): { text: string; money: boolean }[] {
  const number = String.raw`(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?(?!\d|[.,]\d)`;
  text = text.replace(new RegExp(String.raw`((?:R\$|BRL)\s*${number})\s+(a|até)\s+(${number})`, "gu"), "$1 $2 R$ $3");
  const pattern = new RegExp(String.raw`(?:R\$|BRL)\s*${number}|(?:US\$|USD|EUR|GBP|€|£)\s*\d[\d.,]*\d|(?:US\$|USD|EUR|GBP|€|£)\s*\d`, "gu");
  const parts: { text: string; money: boolean }[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index), money: false });
    const original = match[0];
    const amount = Number(original.replace(/R\$|BRL|\s|\./g, "").replace(",", "."));
    parts.push({ text: (original.startsWith("R$") || original.startsWith("BRL")) ? formatMoney(amount) : original, money: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), money: false });
  return parts;
}

export const formatMoneyText = (text: string) => moneyTextParts(text).map((part) => part.text).join("");

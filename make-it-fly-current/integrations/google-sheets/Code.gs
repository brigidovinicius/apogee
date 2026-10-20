const SPREADSHEET_ID = "136r8ESII-8xBTdGy-zfDJbCZonN-VzgBncGBCM7XWf0";
const APPLICATIONS_SHEET_NAME = "Aplicações";
const JOURNEY_SHEET_NAME = "Jornada";
const MAX_WEBHOOK_BYTES = 32 * 1024;
const WEBHOOK_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function doPost(event) {
  try {
    const contents = event && event.postData ? event.postData.contents : null;
    if (typeof contents !== "string" || contents.length > MAX_WEBHOOK_BYTES || Utilities.newBlob(contents).getBytes().length > MAX_WEBHOOK_BYTES) throw new Error("Pedido inválido.");
    const data = JSON.parse(contents);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Pedido inválido.");
    authenticateWebhook(data.webhookSecret);
    // Toda a validação antecede acesso ao lock e às planilhas.
    if (data.kind === "application") validateApplication(data);
    else if (data.kind === "journey_events") validateJourneyBatch(data);
    else throw new Error("Pedido inválido.");

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (data.kind === "journey_events") appendJourneyEvents(data);
      else appendApplication(data);
    } finally { lock.releaseLock(); }
    return webhookResponse(true);
  } catch {
    // Não expor segredo, dados pessoais ou erros dos serviços na resposta/log.
    return webhookResponse(false);
  }
}

function webhookResponse(received) {
  return ContentService.createTextOutput(JSON.stringify({ received: received }))
    .setMimeType(ContentService.MimeType.JSON);
}

function authenticateWebhook(supplied) {
  const expected = PropertiesService.getScriptProperties().getProperty("GOOGLE_SHEETS_WEBHOOK_SECRET");
  if (typeof expected !== "string" || expected.length < 32 || expected.length > 256 ||
      typeof supplied !== "string" || supplied.length < 32 || supplied.length > 256) throw new Error("Pedido inválido.");
  // Sem retorno antecipado por caractere. Não depende de comparação coerciva.
  let difference = expected.length ^ supplied.length;
  for (let index = 0; index < 256; index++) difference |= (expected.charCodeAt(index) || 0) ^ (supplied.charCodeAt(index) || 0);
  if (difference !== 0) throw new Error("Pedido inválido.");
}

function objectWithKeys(data, allowed) {
  if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).some(function (key) { return allowed.indexOf(key) < 0; })) throw new Error("Dados inválidos.");
}

function validTimestamp(value) {
  return typeof value === "string" && value.length <= 40 && !isNaN(Date.parse(value));
}

function applicationEligible(data) {
  return data.age >= 18 && data.age <= 35 && data.hasIdea && data.hasLaptop && data.usesPaidAI;
}

function appendApplication(data) {
  validateApplication(data);
  const sheet = requiredSheet(APPLICATIONS_SHEET_NAME);
  const existing = sheet.getRange("A:A").createTextFinder(data.id).matchEntireCell(true).findNext();
  if (existing) return;
  sheet.appendRow([
    safeCell(data.id), safeCell(data.createdAt), safeCell(data.name), safeCell(data.email), safeCell(data.phone),
    data.hasIdea ? "Sim" : "Não", safeCell(data.ideaDescription), data.usesPaidAI ? "Sim" : "Não",
    applicationEligible(data) ? "Alinhado" : "Revisar", safeCell(data.utmSource), safeCell(data.utmMedium),
    safeCell(data.utmCampaign), safeCell(data.utmContent), safeCell(data.referrer), data.age,
    safeCell(data.profession), data.hasLaptop ? "Sim" : "Não", "", "", "",
  ]);
}

function validateJourneyBatch(data) {
  objectWithKeys(data, ["kind", "webhookSecret", "events"]);
  if (!Array.isArray(data.events) || !data.events.length || data.events.length > 20) throw new Error("Eventos inválidos.");
  data.events.forEach(validateJourneyEvent);
}

function appendJourneyEvents(data) {
  validateJourneyBatch(data);
  const sheet = requiredSheet(JOURNEY_SHEET_NAME);
  const known = Object.create(null);
  const lastRow = sheet.getLastRow();
  if (lastRow >= 6) sheet.getRange(6, 1, lastRow - 5, 1).getValues().forEach(function (row) { known[String(row[0]).toLowerCase()] = true; });
  const rows = [];
  data.events.forEach(function (item) {
    validateJourneyEvent(item);
    if (known[item.eventId]) return;
    known[item.eventId] = true;
    rows.push([
      safeCell(item.eventId), safeCell(item.receivedAt), safeCell(item.journeyId), safeCell(item.eventName),
      safeCell(item.path), safeCell(item.context), item.step || "", safeCell(item.device),
    ]);
  });
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
}

function validateJourneyEvent(item) {
  const names = ["page_view", "section_view", "scroll_depth", "cta_click", "form_view", "form_started", "form_step_completed", "form_validation_error", "form_submit_started", "form_submit_succeeded", "form_submit_failed"];
  objectWithKeys(item, ["eventId", "journeyId", "receivedAt", "eventName", "path", "context", "step", "device"]);
  if (typeof item.eventId !== "string" || typeof item.journeyId !== "string" || !WEBHOOK_UUID.test(item.eventId) || !WEBHOOK_UUID.test(item.journeyId)) throw new Error("Evento inválido.");
  if (names.indexOf(item.eventName) < 0 || ["/", "/participar"].indexOf(item.path) < 0) throw new Error("Evento inválido.");
  if (typeof item.context !== "string" || item.context.length > 160 || !/^[a-z0-9_,.\-]*$/.test(item.context)) throw new Error("Evento inválido.");
  if (item.step !== null && (!Number.isInteger(item.step) || item.step < 1 || item.step > 3)) throw new Error("Evento inválido.");
  if (["mobile", "desktop"].indexOf(item.device) < 0 || !validTimestamp(item.receivedAt)) throw new Error("Evento inválido.");
  item.eventId = item.eventId.toLowerCase();
  item.journeyId = item.journeyId.toLowerCase();
}

function requiredSheet(name) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error("Aba não encontrada.");
  return sheet;
}

function validateApplication(data) {
  objectWithKeys(data, ["kind", "webhookSecret", "id", "createdAt", "name", "email", "phone", "age", "profession", "hasIdea", "hasLaptop", "usesPaidAI", "eligible", "ideaDescription", "utmSource", "utmMedium", "utmCampaign", "utmContent", "referrer"]);
  if (typeof data.id !== "string" || !WEBHOOK_UUID.test(data.id)) throw new Error("ID inválido.");
  if (!validTimestamp(data.createdAt)) throw new Error("Data inválida.");
  if (!Number.isInteger(data.age) || data.age < 1 || data.age > 120) throw new Error("Idade inválida.");
  if (typeof data.hasIdea !== "boolean" || typeof data.hasLaptop !== "boolean" || typeof data.usesPaidAI !== "boolean" || typeof data.eligible !== "boolean") throw new Error("Respostas inválidas.");
  [["name", 120], ["email", 254], ["phone", 15], ["ideaDescription", 2000],
   ["utmSource", 200], ["utmMedium", 200], ["utmCampaign", 200],
   ["utmContent", 200], ["referrer", 2048], ["profession", 160]].forEach(function (rule) {
    const value = data[rule[0]];
    if (typeof value !== "string" || value.length > rule[1] || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error("Campo inválido.");
  });
  if (data.name.trim().length < 2 || data.profession.trim().length < 2 || !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(data.email) || !/^\d{10,15}$/.test(data.phone)) throw new Error("Campo inválido.");
  if (data.eligible !== applicationEligible(data)) throw new Error("Elegibilidade inválida.");
  data.id = data.id.toLowerCase();
}

function safeCell(value) {
  const singleLine = String(value || "").replace(/[\r\n]+/g, " ").trim();
  return /^[=+\-@]/.test(singleLine) ? "'" + singleLine : singleLine;
}

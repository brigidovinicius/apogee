const SPREADSHEET_ID = "136r8ESII-8xBTdGy-zfDJbCZonN-VzgBncGBCM7XWf0";
const APPLICATIONS_SHEET_NAME = "Aplicações";
const JOURNEY_SHEET_NAME = "Jornada";

function doPost(event) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse(event && event.postData ? event.postData.contents : "null");
    if (data && data.kind === "journey_events") appendJourneyEvents(data);
    else appendApplication(data);

    return ContentService.createTextOutput(JSON.stringify({ received: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function appendApplication(data) {
  validateApplication(data);
  const sheet = requiredSheet(APPLICATIONS_SHEET_NAME);
  const existing = sheet.getRange("A:A").createTextFinder(data.id).matchEntireCell(true).findNext();
  if (existing) return;
  sheet.appendRow([
    safeCell(data.id), safeCell(data.createdAt), safeCell(data.name), safeCell(data.email), safeCell(data.phone),
    data.hasIdea ? "Sim" : "Não", safeCell(data.ideaDescription), data.usesPaidAI ? "Sim" : "Não",
    data.eligible ? "Alinhado" : "Revisar", safeCell(data.utmSource), safeCell(data.utmMedium),
    safeCell(data.utmCampaign), safeCell(data.utmContent), safeCell(data.referrer), data.age,
    safeCell(data.profession), data.hasLaptop ? "Sim" : "Não", "", "", "",
  ]);
}

function appendJourneyEvents(data) {
  if (!Array.isArray(data.events) || !data.events.length || data.events.length > 20) throw new Error("Eventos inválidos.");
  const sheet = requiredSheet(JOURNEY_SHEET_NAME);
  const known = {};
  const lastRow = sheet.getLastRow();
  if (lastRow >= 6) sheet.getRange(6, 1, lastRow - 5, 1).getValues().forEach(function (row) { known[String(row[0])] = true; });
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
  if (!item || typeof item !== "object") throw new Error("Evento inválido.");
  if (!/^[0-9a-f-]{36}$/i.test(String(item.eventId || "")) || !/^[0-9a-f-]{36}$/i.test(String(item.journeyId || ""))) throw new Error("Evento inválido.");
  if (names.indexOf(item.eventName) < 0 || ["/", "/participar"].indexOf(item.path) < 0) throw new Error("Evento inválido.");
  if (typeof item.context !== "string" || item.context.length > 160 || !/^[a-z0-9_,.\-]*$/.test(item.context)) throw new Error("Evento inválido.");
  if (item.step !== null && (!Number.isInteger(item.step) || item.step < 1 || item.step > 3)) throw new Error("Evento inválido.");
  if (["mobile", "desktop"].indexOf(item.device) < 0 || isNaN(Date.parse(String(item.receivedAt || "")))) throw new Error("Evento inválido.");
}

function requiredSheet(name) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error("Aba não encontrada.");
  return sheet;
}

function validateApplication(data) {
  if (!data || typeof data !== "object") throw new Error("Dados inválidos.");
  if (!/^[0-9a-f-]{36}$/i.test(String(data.id || ""))) throw new Error("ID inválido.");
  if (isNaN(Date.parse(String(data.createdAt || "")))) throw new Error("Data inválida.");
  if (!Number.isInteger(data.age) || data.age < 1 || data.age > 120) throw new Error("Idade inválida.");
  if (typeof data.hasIdea !== "boolean" || typeof data.hasLaptop !== "boolean" || typeof data.usesPaidAI !== "boolean" || typeof data.eligible !== "boolean") throw new Error("Respostas inválidas.");
  [["name", 120], ["email", 254], ["phone", 15], ["ideaDescription", 2000],
   ["utmSource", 200], ["utmMedium", 200], ["utmCampaign", 200],
   ["utmContent", 200], ["referrer", 2048], ["profession", 160]].forEach(function (rule) {
    const value = data[rule[0]];
    if (typeof value !== "string" || value.length > rule[1]) throw new Error("Campo inválido.");
  });
}

function safeCell(value) {
  const singleLine = String(value || "").replace(/[\r\n]+/g, " ").trim();
  return /^[=+\-@]/.test(singleLine) ? "'" + singleLine : singleLine;
}

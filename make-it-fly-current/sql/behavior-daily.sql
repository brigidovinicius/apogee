-- Separate, explicit database gate. Never execute as part of a web deployment.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE public.apogee_behavior_daily (
  day date NOT NULL,
  page text NOT NULL CHECK (page IN ('home','radar_list','radar_detail','radar_saved','radar_calendar','radar_access','calendars','calendar_detail','collections','collection_detail','competitions','blog_list','blog_article','store','gallery','makeitfly','makeitfly_application','login','signup','password_recovery','community','privacy','terms')),
  event text NOT NULL,
  target text NOT NULL,
  device text NOT NULL CHECK (device IN ('mobile','desktop')),
  count bigint NOT NULL CHECK (count > 0),
  PRIMARY KEY (day, page, event, target, device),
  CHECK (
    (event = 'page_view' AND target = 'view') OR
    (event = 'navigation' AND target IN ('home','radar_list','radar_detail','radar_saved','radar_calendar','radar_access','calendars','calendar_detail','collections','collection_detail','competitions','blog_list','blog_article','store','gallery','makeitfly','makeitfly_application','login','signup','password_recovery','community','privacy','terms')) OR
    (event = 'scroll_depth' AND target IN ('25','50','75','100')) OR
    (event = 'engaged_time' AND target IN ('15s','30s','60s')) OR
    (event = 'section_view' AND page = 'makeitfly' AND target IN ('experiencia','jornada','programacao','manifesto','quem-conduz','participar','galeria-preview')) OR
    (event = 'filter_apply' AND page IN ('radar_list','radar_saved','radar_calendar','calendars','calendar_detail') AND target IN ('applied','cleared')) OR
    (event = 'form_progress' AND page = 'makeitfly_application' AND target IN ('view','started','step_1','step_2','step_3','validation_error','submit_started','submit_succeeded','submit_failed')) OR
    (event = 'action' AND ((target = 'store_interest' AND page = 'store') OR (target = 'application_start' AND page = 'makeitfly') OR (target = 'application_open' AND page = 'makeitfly_application') OR
      (page IN ('radar_list','radar_detail','radar_saved','radar_calendar','radar_access','competitions','calendar_detail') AND target IN ('save','remove_saved','alert_request','series_alert_request','checkout_start','google_calendar','official_link'))))
  )
);
REVOKE ALL ON public.apogee_behavior_daily FROM PUBLIC;
COMMENT ON TABLE public.apogee_behavior_daily IS 'Daily aggregate counts only. No event log, identity, session, URLs, input values or client timestamps. Day uses America/Sao_Paulo.';
COMMIT;

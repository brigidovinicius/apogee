-- Public support documentation from the already registered Microsoft author.
-- No change to permissions, post data, reviews, receipts or billing.
UPDATE blog_worker.research_reference
SET definition=jsonb_set(definition,'{article_hosts}',definition->'article_hosts'||'["support.microsoft.com","www.support.microsoft.com"]'::jsonb)
WHERE id='ARTICLE_PRIMARY_MICROSOFT_EDUCATION'
  AND NOT definition->'article_hosts' ? 'support.microsoft.com';

#!/usr/bin/env python3
"""Recheck unchanged, already-approved prices; never approves a model or a new rate."""
import argparse
import copy
import datetime as dt
import decimal
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from html.parser import HTMLParser
from urllib.parse import urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler

PAGES = {
    'gpt-6-luna': 'gpt-6-luna',
    'gpt-image-2.5-flare-2026-09-08': 'gpt-image-2.5-flare',
}

class PublicText(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip = 0; self.parts = []
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'nav', 'header', 'footer'): self.skip += 1
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'nav', 'header', 'footer'): self.skip = max(0, self.skip - 1)
    def handle_data(self, data):
        if not self.skip: self.parts.append(data)

class OfficialRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        a, b = urlparse(req.full_url), urlparse(newurl)
        if b.scheme != 'https' or b.netloc != 'developers.openai.com' or b.path != a.path:
            raise ValueError('unapproved_pricing_redirect')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def fetch_page(url):
    request = Request(url, headers={'User-Agent': 'ApogeePriceVerifier/1.0', 'Accept': 'text/html', 'Cache-Control': 'no-cache'})
    with build_opener(OfficialRedirects()).open(request, timeout=20) as response:
        body = response.read(3 * 1024 * 1024 + 1)
        if len(body) > 3 * 1024 * 1024: raise ValueError('pricing_page_size')
        if 'text/html' not in response.headers.get('Content-Type', ''): raise ValueError('pricing_format')
        return body.decode('utf-8')

def amount(section, label):
    match = re.search(r'\b' + re.escape(label) + r'\s+\$\s*(\d+(?:\.\d+)?)\b', section, re.I)
    if not match: raise ValueError('pricing_field_missing')
    value = decimal.Decimal(match.group(1)) * 1000000
    if value != value.to_integral_value(): raise ValueError('pricing_precision')
    return int(value)

def official_rates(model, html):
    parser = PublicText(); parser.feed(html)
    text = re.sub(r'\s+', ' ', ' '.join(parser.parts))
    if model not in text: raise ValueError('pricing_model_missing')
    match = re.search(r'Text tokens\s+Per 1M tokens(.*?)(?:Modalities|Endpoints)', text, re.I)
    if not match: raise ValueError('pricing_section_missing')
    section = match.group(1)
    if model == 'gpt-6-luna':
        return dict(zip(['input_micro_usd_per_million', 'cached_input_micro_usd_per_million', 'cache_write_micro_usd_per_million', 'output_micro_usd_per_million'],
                        [amount(section, label) for label in ['Input', 'Cached input', 'Cache writes', 'Output']]))
    if 'Image tokens' not in section: raise ValueError('image_pricing_section_missing')
    text_section, image_section = section.split('Image tokens', 1)
    return {'input_micro_usd_per_million': amount(text_section, 'Input'), 'output_micro_usd_per_million': amount(image_section, 'Output')}

def reverify(rows, now, fetch=fetch_page, force=False):
    updated = copy.deepcopy(rows); evidence = []
    for row in updated:
        model = row.get('model')
        if row.get('approved') is not True or model not in PAGES: continue
        if not force and dt.datetime.fromisoformat(row['valid_until'].replace('Z', '+00:00')) > now + dt.timedelta(days=2): continue
        url = 'https://developers.openai.com/api/docs/models/' + PAGES[model] + '?site_locale=en'
        record = {'model': model, 'url': url, 'checked_at': now.isoformat()}
        try:
            html = fetch(url); rates = official_rates(model, html)
            if any(row.get(k) != v for k, v in rates.items()):
                row['approved'] = False
                raise ValueError('pricing_changed_requires_review')
            row['verified_at'] = now.isoformat(); row['valid_until'] = (now + dt.timedelta(days=7)).isoformat()
            record.update(status='verified_unchanged', rates=rates, page_sha256=hashlib.sha256(html.encode()).hexdigest())
        except Exception as error:
            record.update(status='held', reason=str(error) if isinstance(error, ValueError) else 'official_pricing_unavailable')
        evidence.append(record)
    return updated, evidence

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--catalog', required=True); ap.add_argument('--evidence-dir', required=True)
    ap.add_argument('--execute', action='store_true'); ap.add_argument('--force', action='store_true')
    args = ap.parse_args(); path = Path(args.catalog); original = path.read_bytes()
    now = dt.datetime.now(dt.timezone.utc); updated, evidence = reverify(json.loads(original), now, force=args.force)
    result = {'checked_at': now.isoformat(), 'provider_calls': 0, 'execute': args.execute, 'prices': evidence}
    if args.execute:
        directory = Path(args.evidence_dir); directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        with (directory / 'verification.lock').open('a') as guard:
            fcntl.flock(guard, fcntl.LOCK_EX)
            if path.read_bytes() != original: raise ValueError('catalog_changed_during_verification')
            stamp = now.strftime('%Y%m%dT%H%M%S%fZ')
            (directory / (stamp + '.json')).write_text(json.dumps(result) + '\n')
            if updated != json.loads(original):
                (directory / (stamp + '-before.json')).write_bytes(original)
                stat = path.stat(); fd, temporary = tempfile.mkstemp(prefix='.prices-verified-', dir=path.parent)
                with os.fdopen(fd, 'w') as stream:
                    json.dump(updated, stream, indent=2); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
                os.chmod(temporary, stat.st_mode); os.chown(temporary, stat.st_uid, stat.st_gid); os.replace(temporary, path)
    print(json.dumps(result))

if __name__ == '__main__': main()

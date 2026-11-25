import datetime as dt
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('prices', Path(__file__).parents[1] / 'bin/refresh-verified-prices.py')
prices = importlib.util.module_from_spec(spec); spec.loader.exec_module(prices)
NOW = dt.datetime(2026, 11, 25, tzinfo=dt.timezone.utc)
TEXT = '<main>gpt-6-luna Pricing Text tokens Per 1M tokens Input $0.10 Cached input $0.01 Cache writes $0.125 Output $0.50 Modalities</main>'
IMAGE = '<main>gpt-image-2.5-flare-2026-09-08 Text tokens Per 1M tokens Input $5.00 Cached input $1.25 Image tokens Per 1M tokens Input $8.00 Cached input $2.00 Output $30.00 Modalities</main>'

def row(model='gpt-6-luna'):
    return {'model': model, 'approved': True, **prices.official_rates(model, TEXT if model == 'gpt-6-luna' else IMAGE),
            'valid_until': (NOW - dt.timedelta(hours=1)).isoformat(), 'verified_at': (NOW - dt.timedelta(days=7)).isoformat(), 'safety_marker': 'preserved'}

class PricingTests(unittest.TestCase):
    def test_unchanged_approved_prices_extend_only_verification_dates(self):
        for model, html in [('gpt-6-luna', TEXT), ('gpt-image-2.5-flare-2026-09-08', IMAGE)]:
            old = row(model); new, evidence = prices.reverify([old], NOW, lambda url: html)
            self.assertEqual(evidence[0]['status'], 'verified_unchanged')
            self.assertEqual(set(k for k in old if old[k] != new[0][k]), {'verified_at', 'valid_until'})
            self.assertEqual(dt.datetime.fromisoformat(new[0]['valid_until']) - NOW, dt.timedelta(days=7))
    def test_changed_missing_or_unavailable_prices_never_extend_authorization(self):
        old = row(); new, evidence = prices.reverify([old], NOW, lambda url: TEXT.replace('$0.10', '$0.20'))
        self.assertEqual(new, [{**old, 'approved': False}]); self.assertEqual(evidence[0]['reason'], 'pricing_changed_requires_review')
        for html in ['<main>unrelated page</main>', '<main>gpt-6-luna unavailable</main>']:
            old = row(); new, evidence = prices.reverify([old], NOW, lambda url: html)
            self.assertEqual(new, [old]); self.assertEqual(evidence[0]['status'], 'held')
        old = row(); new, evidence = prices.reverify([old], NOW, lambda url: (_ for _ in []).throw(OSError()))
        self.assertEqual(new, [old]); self.assertEqual(evidence[0]['reason'], 'official_pricing_unavailable')
    def test_unapproved_models_are_never_enabled(self):
        old = {**row(), 'approved': False}
        self.assertEqual(prices.reverify([old], NOW, lambda url: self.fail('no request')), ([old], []))
    def test_scripts_cannot_supply_a_price(self):
        with self.assertRaises(ValueError): prices.official_rates('gpt-6-luna', '<script>' + TEXT + '</script>')
    def test_fresh_prices_do_not_fetch_again(self):
        old = {**row(), 'valid_until': (NOW + dt.timedelta(days=6)).isoformat()}
        self.assertEqual(prices.reverify([old], NOW, lambda url: self.fail('no request')), ([old], []))
    def test_image_input_is_text_prompt_not_reference_image_price(self):
        result = prices.official_rates('gpt-image-2.5-flare-2026-09-08', IMAGE)
        self.assertEqual(result['input_micro_usd_per_million'], 5000000)
        self.assertEqual(result['output_micro_usd_per_million'], 30000000)

if __name__ == '__main__': unittest.main()

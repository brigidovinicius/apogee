# Make It Fly — local font sources

## Noto Sans Mono

Retrieved 2026-09-12 from the official Google Fonts distribution, for Make It Fly metadata typography.

- Local font: `noto-sans-mono-latin-variable.woff2` (32,072 bytes).
- Official CSS2 query: https://fonts.googleapis.com/css2?family=Noto+Sans+Mono:wght@400..500&display=swap
- Exact WOFF2 download: https://fonts.gstatic.com/s/notosansmono/v37/BngcUXNETWXI6LwhGYvaxZikqZqK6fBq6kPvUce2oAZ2evCj_9SrdQ.woff2
- Official family repository: https://github.com/google/fonts/tree/main/ofl/notosansmono
- License source: https://raw.githubusercontent.com/google/fonts/main/ofl/notosansmono/OFL.txt
- Preserved local license: `OFL-NotoSansMono.txt` (4,396 bytes), SIL Open Font License 1.1.
- Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic).

The CSS2 response declares `font-family: 'Noto Sans Mono'`, normal style, variable font weight `400 500`, stretch `100%`, display `swap`, and a Latin WOFF2 subset. It was requested using a modern Chromium user agent. The font bytes were downloaded directly, renamed locally, and not modified or reconverted.

Declared Latin Unicode coverage: `U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD`. This includes precomposed Portuguese accents in Latin-1.

Integrate with a local font loader using weight range `400 500` and normal style. Bundle the OFL license with the distributed font. File-type verification identifies a WOFF2 TrueType file; the weight range is verified by the authoritative CSS response, not an independent binary-axis inspection.

SHA-256:

| File | SHA-256 |
|---|---|
| noto-sans-mono-latin-variable.woff2 | 82b5f644afea857da6400c45aff99ddc65f801569aacc6bb20a9a1a894b4a65d |
| OFL-NotoSansMono.txt | cee9892f9f0cc8fe882c9e9537ee6a89621d86ee7ceaf70b02e2b2b1c25c061a |

## Instrument Serif

Retrieved 2026-09-12 from the official Google Fonts distribution to preserve the existing normal and italic display typography while removing build-time network dependency.

- Official CSS2 query: https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap
- Normal 400 Latin WOFF2: `instrument-serif-latin-400-normal.woff2` (15,040 bytes).
- Exact normal download: https://fonts.gstatic.com/s/instrumentserif/v5/jizBRFtNs2ka5fXjeivQ4LroWlx-6zUTjnTLgNs.woff2
- Italic 400 Latin WOFF2: `instrument-serif-latin-400-italic.woff2` (15,684 bytes).
- Exact italic download: https://fonts.gstatic.com/s/instrumentserif/v5/jizHRFtNs2ka5fXjeivQ4LroWlx-6zAjjH7Motmp5g.woff2
- Official family repository: https://github.com/google/fonts/tree/main/ofl/instrumentserif
- License source: https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentserif/OFL.txt
- Preserved local license: `OFL-InstrumentSerif.txt` (4,405 bytes), SIL Open Font License 1.1.
- Copyright 2022 The Instrument Serif Project Authors (https://github.com/Instrument/instrument-serif).

The official CSS declares both files as weight 400, with normal and italic styles respectively. Both Latin subsets cover `U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD`, including precomposed Portuguese accents. The CSS was requested using a modern Chromium user agent.

These font bytes were downloaded directly and only renamed, not modified or reconverted. Integrate both files as distinct style sources in one local font family, weight `400`, with `normal` and `italic` styles. Bundle the OFL license. File signatures identify WOFF2 TrueType files.

SHA-256:

| File | SHA-256 |
|---|---|
| instrument-serif-latin-400-normal.woff2 | 60c06664b5a95c7de6cc3e00d1f9034d78bd1e40b564016b241674449a067d4d |
| instrument-serif-latin-400-italic.woff2 | 6ee678c33f388dd7ba59700ebea635deb98821baafd817b09891f7927177f702 |
| OFL-InstrumentSerif.txt | 129ed7618959716959f2941fdd5b49e0ad6e6c1d78726761786a00253d865521 |

# Make It Fly — Earth texture sources

Retrieved directly from official NASA hosts on 2026-09-12. Original downloads are preserved without modification in the sibling `../earth-originals/` directory. No generated imagery was used.

## Day surface — earth-day-4k.webp

- Original: `land_ocean_ice_8192.png`, 8192 × 4096.
- Exact download: https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_8192.png
- Original source page: https://visibleearth.nasa.gov/images/57730/the-blue-marble-land-surface-ocean-color-and-sea-ice
- Provenance: NASA Goddard Space Flight Center; Blue Marble, Reto Stöckli (land surface and shallow water), Robert Simmon (ocean color and compositing), MODIS observations.
- Conversion: `cwebp` 1.6.0, method 6, quality 88, resized to 4096 × 2048; no crop, recoloring, geographic shift, or generated details.
- Output: 831,508 bytes. Treat as a color texture.

Mobile derivative: `earth-day-2k.webp`, resized directly from the same unchanged 8192 × 4096 original to 2048 × 1024 using `cwebp` 1.6.0, method 6, quality 88. Output: 235,506 bytes. No crop, recoloring, geographic shift, or generated details.

## Clouds — earth-clouds-2k.webp

- Original: `cloud_combined_2048.jpg`, 2048 × 1024.
- Exact download: https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg
- Original source page: https://visibleearth.nasa.gov/images/57747/blue-marble-clouds/77558l
- Provenance: NASA Goddard Space Flight Center; Blue Marble clouds by Reto Stöckli, with compositing enhancements by Robert Simmon. Satellite composite, not live weather.
- Conversion: `cwebp` 1.6.0, method 6, quality 80, 2048 × 1024; dimensions preserved, no recoloring or generated details. Recompressed directly from the unchanged original to reduce transfer size.
- Output: 429,594 bytes. The source has no alpha channel: use its luminance as opacity on the cloud layer in the shader. This file is a cloud mask, not an already-transparent RGBA asset.

The historical Visible Earth day/cloud pages now redirect to the migrated NASA Earth Observatory index; the original download hosts above still serve the files.

## Night lights — earth-night-2k.webp

- Original: `BlackMarble_2016_01deg_gray.jpg`, 3600 × 1800.
- Exact download: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144897/BlackMarble_2016_01deg_gray.jpg
- Source page: https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/
- Supporting credit page: https://svs.gsfc.nasa.gov/30876/
- Provenance: NASA Earth Observatory / NASA Goddard Space Flight Center; Black Marble 2016, Suomi NPP VIIRS observations; scientist Miguel Román, image processing Joshua Stevens.
- Conversion: `cwebp` 1.6.0, method 6, quality 92, resized to 2048 × 1024; grayscale retained, no lights added or recolored.
- Output: 72,078 bytes. Use as the night-light intensity map, modulated by the day/night terminator. Any warm light tint is a renderer treatment, not part of the source.

## Topography — earth-bump-2k.webp

- Original: `gebco_08_rev_elev_5400x2700.jpg`, 5400 × 2700.
- Exact download: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/topography/gebco_08_rev_elev_5400x2700.jpg
- Source page: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/topography-bathymetry-maps/
- Provenance: Jesse Allen / NASA Earth Observatory, using GEBCO data produced by the British Oceanographic Data Centre.
- Conversion: `cwebp` 1.6.0, method 6, quality 92, resized to 2048 × 1024; grayscale elevation values retained through lossy compression, no generated details.
- Output: 73,640 bytes. Elevations in the source span 0–6400 meters. Treat as a linear-data height/bump texture, not a tangent-space normal map. Keep the rendered bump subtle; this is visual relief, not a scientific elevation export.

## Static posters

`earth-poster-desktop.avif` (1440 × 900) and `earth-poster-mobile.avif` (390 × 844) are direct captures of this site's own Three.js scene at the initial scroll position. They use the NASA/GEBCO textures credited above, with the same camera, atmosphere, materials and lighting as the interactive scene. They are not separate NASA photographs and are not generative images. Captured locally on 2026-09-12, then encoded as AVIF at quality 55 with Sharp. No event text, branding or interface is baked into these decorative images. The earlier temporary user-reference image is not included in the delivered posters.

## Usage and attribution

NASA media usage guidance: https://www.nasa.gov/nasa-brand-center/images-and-media/

Keep NASA acknowledged as the imagery source. The use must not imply NASA endorsement. No NASA logo or identifiable person appears in these map assets.

Suggested concise visible credit: “Earth textures: NASA Earth Observatory / Blue Marble / Black Marble. Elevation: GEBCO.”

## Verification

Dimensions were read from originals and outputs with macOS `sips`. All downloaded files decoded successfully through `cwebp`. SHA-256 hashes:

| File | SHA-256 |
|---|---|
| earth-day-4k.webp | 68a527aaa5fda5de5bc64569e86495143c1c91a072bed4247be86ee495211200 |
| earth-day-2k.webp | 6c432deaa07bc9b1d3943a7eae92a06c91e547e0bfae5bfac2a61b440be3c582 |
| earth-clouds-2k.webp | af30946c260a495e49070f617b693e2167fe6fde88fe785ceaa20a823c7a7da9 |
| earth-night-2k.webp | 0d31d17bbd563c0e3ad149ae4013de53c5eb21038558fca0d9e9b9a3f33da94b |
| earth-bump-2k.webp | 4138be78b0d9f7717269748e0349f9c2d5f868aa970cfc92a9221cbcb6464c34 |
| land_ocean_ice_8192.png | aaddcd967a9f09fb2d7ef50ff452bebfcf10192c520465d5eb1ad8446c716e98 |
| cloud_combined_2048.jpg | daddaad84d7a33bbbc86cdda3f591099f57cee8607b7bcf3b67eb7e4f7a1c793 |
| BlackMarble_2016_01deg_gray.jpg | 4d2158f59123dadf0696a1cf8909c45018a1de8d0daab40da04122a5aa7f27c6 |
| gebco_08_rev_elev_5400x2700.jpg | 97828a87bcb6549a527232455e478c5f9e4556f761b37d620a46446da17593ab |

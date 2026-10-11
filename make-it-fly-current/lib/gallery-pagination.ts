export const GALLERY_PAGE_SIZE = 24;
export const GALLERY_MAX_PAGE = Math.floor(10_000 / GALLERY_PAGE_SIZE) + 1;

export function galleryPageNumber(value: string | string[] | undefined): number | null {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d{0,2}$/.test(value)) return null;
  const page = Number(value);
  return page <= GALLERY_MAX_PAGE ? page : null;
}

export function galleryPagePath(page: number): string {
  return page === 1 ? "/galeria" : `/galeria?pagina=${page}`;
}

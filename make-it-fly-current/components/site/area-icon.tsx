// The artwork itself is registered once in the global design-system stylesheet.
export function AreaIcon({ area }: { area: string }) {
  return <span data-ap-nav-icon="" data-ap-art={area} aria-hidden="true" />;
}

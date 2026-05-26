export function formatThicknessSegment(thickness: number) {
  return `${String(thickness).replace('.', '-')}-cm`;
}

export function parseThicknessSegment(segment: string | null | undefined) {
  if (!segment) return null;

  const match = segment.match(/^(\d+)(?:[-.,](\d+))?-?cm$/i);
  if (!match) return null;

  const value = Number(match[2] ? `${match[1]}.${match[2]}` : match[1]);
  return Number.isFinite(value) ? value : null;
}

export function parseThicknessQueryValue(value: string | null | undefined) {
  if (!value) return null;

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(',', '.')
    .replace(/\s+/g, '')
    .replace(/cm$/, '');
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

export function getThicknessFromProductPath(pathname: string) {
  const lastSegment = pathname.split('/').filter(Boolean).at(-1);
  return parseThicknessSegment(lastSegment);
}

export function stripThicknessFromProductPath(pathname: string) {
  return pathname.replace(/\/\d+(?:-\d+)?-cm\/?$/i, '');
}

export function buildProductPathWithThickness(pathname: string, thickness: number) {
  const basePath = stripThicknessFromProductPath(pathname);
  return `${basePath}/${formatThicknessSegment(thickness)}`;
}

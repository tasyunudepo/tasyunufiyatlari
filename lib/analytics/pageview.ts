export interface SafePageViewPayload {
  page_path: string;
  page_location: string;
  page_title: string;
  send_to: string;
}

interface BuildSafePageViewPayloadInput {
  pathname: string;
  origin: string;
  title: string;
  measurementId: string;
}

type GtagEvent = (
  command: 'event',
  eventName: 'page_view',
  params: SafePageViewPayload,
) => void;

interface EmitPageViewInput extends BuildSafePageViewPayloadInput {
  gtag: GtagEvent;
}

let lastPageViewKey: string | null = null;

function sanitizePathname(pathname: string): string {
  const pathOnly = pathname.split(/[?#]/, 1)[0]?.trim() ?? '';

  if (!pathOnly || !pathOnly.startsWith('/')) return '/';
  return pathOnly;
}

export function buildSafePageViewPayload({
  pathname,
  origin,
  title,
  measurementId,
}: BuildSafePageViewPayloadInput): SafePageViewPayload {
  const safePathname = sanitizePathname(pathname);
  const safeOrigin = origin.replace(/\/+$/, '');

  return {
    page_path: safePathname,
    page_location: `${safeOrigin}${safePathname}`,
    page_title: title,
    send_to: measurementId,
  };
}

export function emitDeduplicatedPageView(input: EmitPageViewInput): boolean {
  const payload = buildSafePageViewPayload(input);
  const pageViewKey = `${input.measurementId}:${payload.page_path}`;

  if (lastPageViewKey === pageViewKey) return false;

  input.gtag('event', 'page_view', payload);
  lastPageViewKey = pageViewKey;
  return true;
}

export function resetPageViewDeduplicationForTests(): void {
  lastPageViewKey = null;
}

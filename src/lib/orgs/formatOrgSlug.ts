/**
 * Normalize an organization slug: lowercase, hyphenated, no leading/trailing hyphens.
 */
export function formatOrgSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

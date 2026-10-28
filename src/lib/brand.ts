/**
 * Product identity in one place. Rename the product here; the shell, metadata and
 * styleguide read from this file.
 */
export const BRAND = {
  name: "ShowMi",
  /** Parent brand shown as an endorsement ("by viralonme"). */
  endorsedBy: "viralonme",
  /** One short line about what the product does. */
  tagline: "Store listings for every market",
  /** Used in <title> and social previews. */
  description:
    "Audit a Google Play listing, fix it with localized copy and posters, and export a Fastlane bundle.",
  /** The accent dot on the monogram. Brand-only colour; not used elsewhere in the UI. */
  markDot: "#ffd25e",
} as const;

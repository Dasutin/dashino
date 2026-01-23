const slugify = (value: string, fallback = "playlist") => {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base) return base;
  return fallback;
};

export default slugify;

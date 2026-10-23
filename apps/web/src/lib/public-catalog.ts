export function isExcludedPublicTestCategory(
  category: { slug: string; name?: string | null },
): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    (category.slug === "prueba-emulador" ||
      (category.name != null &&
        /prueba emulador/i.test(category.name)))
  );
}

export function filterPublicSkillsByCategoryId<
  T extends { category_id: string },
>(skills: readonly T[], excludedCategoryIds: ReadonlySet<string>): T[] {
  return skills.filter((skill) => !excludedCategoryIds.has(skill.category_id));
}

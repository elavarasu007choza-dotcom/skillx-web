export const isProfileIncomplete = (profile = {}) => {
  if (profile.profileCompleted === true) {
    return false;
  }

  const bio = typeof profile.bio === "string" ? profile.bio.trim() : "";
  const profession = typeof profile.profession === "string" ? profile.profession.trim() : "";
  const teachSkills = Array.isArray(profile.teachSkills) ? profile.teachSkills : [];

  return !(bio && profession && teachSkills.length > 0);
};

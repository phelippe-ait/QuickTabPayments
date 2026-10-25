import type { Profile, StaffRole } from "@shared/lib/database.types";

export const roleLabels: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Manager",
  kitchen: "Kitchen",
};

export function getProfileName(profile: Profile | null, email?: string | null) {
  if (profile) {
    const name = [profile.first_name, profile.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (name) return name;
  }
  return email?.split("@")[0] ?? "Account";
}

export function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

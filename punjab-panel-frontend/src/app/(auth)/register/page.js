import { redirect } from "next/navigation";

export default function RegisterPage() {
  const publicSite = (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "https://punjabpolitics.com").replace(/\/$/, "");
  redirect(`${publicSite}/register`);
}

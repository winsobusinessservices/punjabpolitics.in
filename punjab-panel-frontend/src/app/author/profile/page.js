import ProfileClient from "@/components/author/ProfileClient";
import RequireContributorRole from "@/components/author/RequireContributorRole";
import Header from "@/components/layout/Header";

export const metadata = { title: "Profile" };

// Every panel account (including Subadmins and Investors) can manage their own profile.
export default function ProfilePage() {
  return (
    <>
    <Header/>
        <main className="w-full bg-background flex-grow">
      <RequireContributorRole roles={["AUTHOR", "EDITOR", "ADMIN", "SUBADMIN", "INVESTOR"]} roleLabel="a signed-in team member">
        <ProfileClient />
      </RequireContributorRole>
    </main>
    </>

  );
}

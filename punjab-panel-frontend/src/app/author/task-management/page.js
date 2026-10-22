import RequireContributorRole from "@/components/author/RequireContributorRole";
import TaskManagementClient from "@/components/author/TaskManagementClient";
import Header from "@/components/layout/Header";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "Task Management" };

export default async function TaskManagementPage() {
  return (
    <>
      <Header />
      <main className="w-full flex-grow bg-background">
        <RequireContributorRole permissions={[PERMISSIONS.MANAGE_TASK_MANAGEMENT, PERMISSIONS.MANAGE_SITE_MANAGEMENT, PERMISSIONS.VIEW_TASKS]} roleLabel="a team member with task access">
          <div className="mx-auto max-w-full px-4 py-10 md:px-16">
            <h1 className="font-display-lg text-3xl text-primary">Task Management</h1>
            <p className="mb-8 mt-2 text-on-surface-variant">Manage your tasks and assignments.</p>
            <TaskManagementClient />
          </div>
        </RequireContributorRole>
      </main>
    </>
  );
}
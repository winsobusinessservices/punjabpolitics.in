"use client";

import { useCallback, useState } from "react";
import TeamMembersTable from "./TeamMembersTable";
import CreateTeamMemberClient from "./CreateTeamMemberClient";

// Bumping refreshKey re-runs TeamMembersTable's fetch effect — the simplest
// way for the create form to hand off "a new member exists now" without the
// two components sharing any other state.
export default function TeamManagementClient() {
  const [refreshKey, setRefreshKey] = useState(0);
  const handleCreated = useCallback(() => setRefreshKey((key) => key + 1), []);

  return (
    <div className="space-y-10">
        <div>
        <h2 className="font-headline-lg text-primary text-xl mb-4">Assign a Role</h2>
        <CreateTeamMemberClient onCreated={handleCreated} />
      </div>
      <TeamMembersTable refreshKey={refreshKey} />

    
    </div>
  );
}

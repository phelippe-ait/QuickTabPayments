import { useEffect, useState } from "react";
import styles from "../../App.module.css";
import { Icon } from "@shared/ui/Icon";
import { useAuth } from "@shared/auth/AuthContext";
import { roleLabels, useRestaurant } from "@shared/restaurant/RestaurantProvider";
import type { StaffRole } from "@shared/lib/database.types";
import { EmptyState, PageHeader, SelectionBar } from "../../components/AdminUi";
import { useAdminUi } from "../../hooks/AdminUiProvider";
import { useStaff } from "../../hooks/useStaff";
import type { StaffVM } from "../../types";
import { UserModal } from "./UserDialog";
import { staffPermissions } from "./staff.utils";

const roleFilters: Array<StaffRole | "all"> = ["all", "owner", "manager", "kitchen"];

export function UsersPage() {
  const { notify, confirm } = useAdminUi();
  const { restaurant, role } = useRestaurant();
  const { user } = useAuth();
  const staffQuery = useStaff(restaurant?.id ?? "", {
    onSuccess: notify,
    onError: notify,
  });
  const viewerRole: StaffRole = role ?? "kitchen";
  const viewerUserId = user?.id ?? "";

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "all">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [modal, setModal] = useState<
    { kind: "add" } | { kind: "edit"; member: StaffVM } | null
  >(null);

  const visible = staffQuery.staff.filter((member) => {
    const matchesQuery = `${member.name} ${member.email}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesStatus =
      status === "All" || (status === "Active" ? member.isActive : !member.isActive);
    const matchesRole = roleFilter === "all" || member.role === roleFilter;
    return matchesQuery && matchesStatus && matchesRole;
  });

  useEffect(
    () => setSelected((current) => current.filter((id) => staffQuery.staff.some((member) => member.staffId === id))),
    [staffQuery.staff],
  );

  const selectable = visible.filter(
    (member) =>
      staffPermissions({ viewerRole, viewerUserId, member }).canToggleActive,
  );
  const selectedMembers = staffQuery.staff.filter((member) =>
    selected.includes(member.staffId),
  );

  const bulkSetActive = (isActive: boolean) => {
    const targets = selectedMembers.filter(
      (member) =>
        staffPermissions({ viewerRole, viewerUserId, member }).canToggleActive,
    );
    if (!targets.length) return;
    void staffQuery
      .bulkSetActive(
        targets.map((member) => member.staffId),
        isActive,
      )
      .then((ok) => {
        if (ok) setSelected([]);
      });
  };

  const requestRemove = (member: StaffVM) => {
    confirm({
      title: `Remove ${member.name}?`,
      description:
        "They will lose access to this restaurant's admin workspace. Their QuickTab account and order history are kept.",
      actionLabel: "Remove member",
      onConfirm: () => {
        void staffQuery.remove(member.staffId).then((ok) => {
          if (ok) {
            setSelected((current) => current.filter((id) => id !== member.staffId));
          }
        });
      },
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Team access"
        title="Users"
        description={`Manage roles and access for ${restaurant?.name ?? "your restaurant"}.`}
        action="Add team member"
        onAction={() => setModal({ kind: "add" })}
      />

      {staffQuery.error ? (
        <>
          <EmptyState title="We couldn't load the team" description={staffQuery.error.message} />
          <div className="flex justify-center">
            <button type="button" className="rounded-[9px] border border-line bg-white px-[17px] py-3 text-[13px] font-bold text-ink-mid" onClick={staffQuery.refetch}>
              Try again
            </button>
          </div>
        </>
      ) : staffQuery.isLoading ? (
        <div className="py-16 text-center text-sm text-muted-2" role="status">Loading the team…</div>
      ) : (
        <>
          <div className={`${styles["toolbar"]} user-toolbar`}>
            <label className={`${styles["search-box"]}`}>
              <Icon name="search" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" />
            </label>
            <div className={`${styles["user-filters"]}`}>
              <label className={`${styles["filter-select"]}`}>
                <span>Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option>All</option>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </label>
              <label className={`${styles["filter-select"]}`}>
                <span>Role</span>
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as StaffRole | "all")}>
                  {roleFilters.map((filter) => (
                    <option key={filter} value={filter}>
                      {filter === "all" ? "All roles" : roleLabels[filter]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {selected.length > 0 && (
            <SelectionBar count={selected.length} onClear={() => setSelected([])}>
              <button type="button" onClick={() => bulkSetActive(true)}>Activate</button>
              <button type="button" onClick={() => bulkSetActive(false)}>Deactivate</button>
            </SelectionBar>
          )}

          {visible.length === 0 ? (
            <EmptyState title="No users found" description="Try changing the name, status, or role filters." />
          ) : (
            <div className={`${styles["table-card"]} ${styles["users-table"]} selection-table`}>
              <div className={`${styles["table-heading"]}`}>
                <label className={`${styles["inline-select"]}`} aria-label="Select all visible users">
                  <input
                    type="checkbox"
                    checked={selectable.length > 0 && selectable.every((member) => selected.includes(member.staffId))}
                    onChange={() =>
                      setSelected((current) =>
                        selectable.every((member) => current.includes(member.staffId))
                          ? current.filter((id) => !selectable.some((member) => member.staffId === id))
                          : [...new Set([...current, ...selectable.map((member) => member.staffId)])],
                      )
                    }
                  />
                </label>
                <span>User</span>
                <span>Role</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {visible.map((member) => {
                const permissions = staffPermissions({ viewerRole, viewerUserId, member })
                return (
                  <div className={`${styles["table-row"]}`} key={member.staffId}>
                    <label className={`${styles["inline-select"]}`} aria-label={`Select ${member.name}`}>
                      <input
                        type="checkbox"
                        checked={selected.includes(member.staffId)}
                        disabled={!permissions.canToggleActive}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(member.staffId)
                              ? current.filter((id) => id !== member.staffId)
                              : [...current, member.staffId],
                          )
                        }
                      />
                    </label>
                    <div className={`${styles["person"]}`}>
                      <span className={`${styles["avatar"]}`}>{member.initials}</span>
                      <div>
                        <strong>
                          {member.name}
                          {member.userId === viewerUserId && (
                            <span className="ml-2 rounded-pill bg-berry-soft px-2 py-0.5 text-[9px] font-bold text-berry-strong">You</span>
                          )}
                        </strong>
                        <small>{member.email || "No email on profile"}</small>
                      </div>
                    </div>
                    <span className={`${styles["role"]}`}>{roleLabels[member.role]}</span>
                    <span>
                      <i className={`${styles["status-dot"]} ${member.isActive ? "" : styles["inactive"]}`} />
                      {member.isActive ? "Active" : "Inactive"}
                    </span>
                    <div className={`${styles["row-actions"]}`}>
                      <button
                        aria-label={`Edit ${member.name}`}
                        disabled={!permissions.canChangeRole}
                        title={permissions.lockedReason ?? `Edit ${member.name}`}
                        onClick={() => setModal({ kind: "edit", member })}
                      >
                        <Icon name="edit" size={17} />
                      </button>
                      <button
                        aria-label={`Remove ${member.name}`}
                        disabled={!permissions.canRemove}
                        title={permissions.lockedReason ?? `Remove ${member.name}`}
                        onClick={() => requestRemove(member)}
                      >
                        <Icon name="trash" size={17} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {modal && (
        <UserModal
          mode={modal.kind === "edit" ? { kind: "edit", member: modal.member } : { kind: "add" }}
          viewerRole={viewerRole}
          viewerUserId={viewerUserId}
          onClose={() => setModal(null)}
          onSaveRole={staffQuery.setRole}
          onSetActive={staffQuery.setActive}
          onAdd={staffQuery.addByEmail}
        />
      )}
    </>
  );
}

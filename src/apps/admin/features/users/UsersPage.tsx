import { useEffect, useState } from "react";
import styles from "../../App.module.css";
import { Icon } from "@shared/ui/Icon";
import { EmptyState, PageHeader, SelectionBar } from "../../components/AdminUi";
import type { User } from "../../types";

export function UsersPage({
  users,
  onAdd,
  onEdit,
  onDelete,
  onBulkStatus,
  onBulkDelete,
}: {
  users: User[];
  onAdd: () => void;
  onEdit: (user: User) => void;
  onDelete: (id: number) => void;
  onBulkStatus: (ids: number[], status: User["status"]) => void;
  onBulkDelete: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [role, setRole] = useState("All roles");
  const [selected, setSelected] = useState<number[]>([]);
  const roles = [...new Set(users.map((user) => user.role))].sort();
  const visible = users.filter(
    (user) =>
      `${user.name} ${user.email}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "All" || user.status === status) &&
      (role === "All roles" || user.role === role),
  );
  useEffect(
    () =>
      setSelected((current) =>
        current.filter((id) => users.some((user) => user.id === id)),
      ),
    [users],
  );
  return (
    <>
      <PageHeader
        eyebrow="Team access"
        title="Users"
        description="Create user accounts and manage access to Café Shop."
        action="Add user"
        onAction={onAdd}
      />
      <div className={`${styles["toolbar"]} user-toolbar`}>
        <label className={`${styles["search-box"]}`}>
          <Icon name="search" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search users"
          />
        </label>
        <div className={`${styles["user-filters"]}`}>
          <label className={`${styles["filter-select"]}`}>
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option>All</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
          <label className={`${styles["filter-select"]}`}>
            <span>Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option>All roles</option>
              {roles.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {selected.length > 0 && (
        <SelectionBar count={selected.length} onClear={() => setSelected([])}>
          <button
            type="button"
            onClick={() => onBulkStatus(selected, "Active")}
          >
            Activate
          </button>
          <button
            type="button"
            onClick={() => onBulkStatus(selected, "Inactive")}
          >
            Deactivate
          </button>
          <button
            type="button"
            className={`${styles["danger"]}`}
            onClick={() => onBulkDelete(selected)}
          >
            Delete
          </button>
        </SelectionBar>
      )}
      {visible.length === 0 ? (
        <EmptyState
          title="No users found"
          description="Try changing the name, status, or role filters."
        />
      ) : (
        <div
          className={`${styles["table-card"]} ${styles["users-table"]} selection-table`}
        >
          <div className={`${styles["table-heading"]}`}>
            <label
              className={`${styles["inline-select"]}`}
              aria-label="Select all visible users"
            >
              <input
                type="checkbox"
                checked={visible.every((user) => selected.includes(user.id))}
                onChange={() =>
                  setSelected(
                    visible.every((user) => selected.includes(user.id))
                      ? selected.filter(
                          (id) => !visible.some((user) => user.id === id),
                        )
                      : [
                          ...new Set([
                            ...selected,
                            ...visible.map((user) => user.id),
                          ]),
                        ],
                  )
                }
              />
            </label>
            <span>User</span>
            <span>Role</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {visible.map((user) => (
            <div className={`${styles["table-row"]}`} key={user.id}>
              <label
                className={`${styles["inline-select"]}`}
                aria-label={`Select ${user.name}`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(user.id)}
                  onChange={() =>
                    setSelected((current) =>
                      current.includes(user.id)
                        ? current.filter((id) => id !== user.id)
                        : [...current, user.id],
                    )
                  }
                />
              </label>
              <div className={`${styles["person"]}`}>
                <span className={`${styles["avatar"]}`}>{user.initials}</span>
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </div>
              </div>
              <span className={`${styles["role"]}`}>{user.role}</span>
              <span>
                <i
                  className={`${styles["status-dot"]} ${styles[user.status.toLowerCase()]}`}
                />
                {user.status}
              </span>
              <div className={`${styles["row-actions"]}`}>
                <button
                  aria-label={`Edit ${user.name}`}
                  onClick={() => onEdit(user)}
                >
                  <Icon name="edit" size={17} />
                </button>
                <button
                  aria-label={`Delete ${user.name}`}
                  onClick={() => onDelete(user.id)}
                >
                  <Icon name="trash" size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

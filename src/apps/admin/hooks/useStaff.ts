import { useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  addStaffByEmail,
  fetchStaffDirectory,
  removeStaffMembership,
  restaurantKeys,
  updateStaffMembership,
} from "@shared/data/restaurants"
import type { StaffRole } from "@shared/lib/database.types"
import { toStaffVM } from "../mappers"
import type { StaffVM } from "../types"

type Options = {
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

type Task = { run: () => Promise<unknown>; message: string }

export function useStaff(restaurantId: string, options: Options = {}) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: restaurantKeys.staff(restaurantId),
    queryFn: () => fetchStaffDirectory(restaurantId),
    enabled: Boolean(restaurantId),
  })

  const rows = useMemo(() => query.data ?? [], [query.data])
  const staff: StaffVM[] = useMemo(() => rows.map(toStaffVM), [rows])

  const mutation = useMutation({
    mutationFn: async (task: Task) => {
      await task.run()
    },
    onSuccess: (_data, task) => {
      void queryClient.invalidateQueries({
        queryKey: restaurantKeys.staff(restaurantId),
      })
      options.onSuccess?.(task.message)
    },
    onError: (error: Error) => options.onError?.(error.message),
  })

  const run = async (task: Task): Promise<boolean> => {
    try {
      await mutation.mutateAsync(task)
      return true
    } catch {
      return false
    }
  }

  return {
    staff,
    isLoading: query.isPending,
    error: query.error as Error | null,
    refetch: () => void query.refetch(),
    isMutating: mutation.isPending,

    setRole: (staffId: string, role: StaffRole) =>
      run({
        message: "Role updated",
        run: () => updateStaffMembership(staffId, { role }),
      }),

    setActive: (staffId: string, isActive: boolean) =>
      run({
        message: isActive ? "Team member activated" : "Team member deactivated",
        run: () => updateStaffMembership(staffId, { is_active: isActive }),
      }),

    bulkSetActive: (staffIds: string[], isActive: boolean) =>
      run({
        message: `${staffIds.length} ${staffIds.length === 1 ? "member" : "members"} ${isActive ? "activated" : "deactivated"}`,
        run: () =>
          Promise.all(
            staffIds.map((id) =>
              updateStaffMembership(id, { is_active: isActive }),
            ),
          ),
      }),

    remove: (staffId: string) =>
      run({
        message: "Team member removed",
        run: () => removeStaffMembership(staffId),
      }),

    addByEmail: (email: string, role: StaffRole) =>
      run({
        message: `${email} added to the team`,
        run: async () => {
          await addStaffByEmail(restaurantId, email, role)
        },
      }),
  }
}

export type StaffController = ReturnType<typeof useStaff>

/** Query keys for the doctor & department catalogue (standards §4). */
export const doctorsKeys = {
  all: ['doctors'] as const,
  departments: () => [...doctorsKeys.all, 'departments'] as const,
  lists: () => [...doctorsKeys.all, 'list'] as const,
  detail: (id: string) => [...doctorsKeys.all, 'detail', id] as const,
  schedule: (id: string) => [...doctorsKeys.all, 'schedule', id] as const,
  scheduleHistory: (id: string) => [...doctorsKeys.all, 'schedule-history', id] as const,
  photo: (fileId: string) => [...doctorsKeys.all, 'photo', fileId] as const,
};

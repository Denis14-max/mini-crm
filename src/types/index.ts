export type UserRole = 'manager' | 'worker';

export type TaskStatus = 'Новая' | 'В работе' | 'На проверке' | 'Принята' | 'На доработке';

export interface UserRoleItem {
  user_id: string;
  role: UserRole;
  email?: string;
}

export interface BuildingObject {
  id: string;
  name: string;
  address: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  object_id: string;
  worker_id?: string | null;
  manager_id: string;
  status: TaskStatus;
  last_comment?: string | null;
  created_at: string;
  objects?: BuildingObject;
}

export interface TaskHistory {
  id: string;
  task_id: string;
  changed_by?: string | null;
  old_status?: TaskStatus | null;
  new_status: TaskStatus;
  comment?: string | null;
  changed_at: string;
}

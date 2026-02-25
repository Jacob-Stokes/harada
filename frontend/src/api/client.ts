export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const rawText = await response.text();
  let parsed: ApiResponse<T>;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error(rawText || 'API response could not be parsed');
  }

  if (!parsed.success) {
    throw new Error(parsed.error || 'API request failed');
  }

  return parsed.data as T;
}

export const api = {
  // Auth
  getMe: () => apiRequest<any>('/api/auth/me'),

  // Goals
  getGoals: () => apiRequest<any[]>('/api/goals'),
  getGoal: (id: string) => apiRequest<any>(`/api/goals/${id}`),
  getGoalTree: (id: string) => apiRequest<any>(`/api/goals/${id}/tree`),
  createGoal: (data: any) => apiRequest<any>('/api/goals', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateGoal: (id: string, data: any) => apiRequest<any>(`/api/goals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteGoal: (id: string) => apiRequest<any>(`/api/goals/${id}`, {
    method: 'DELETE',
  }),

  // Sub-goals
  getSubGoals: (goalId: string) => apiRequest<any[]>(`/api/goals/${goalId}/subgoals`),
  createSubGoal: (goalId: string, data: any) => apiRequest<any>(`/api/goals/${goalId}/subgoals`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateSubGoal: (id: string, data: any) => apiRequest<any>(`/api/subgoals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  reorderSubGoal: (id: string, targetPosition: number) => apiRequest<any>(`/api/subgoals/${id}/reorder`, {
    method: 'POST',
    body: JSON.stringify({ targetPosition }),
  }),
  deleteSubGoal: (id: string) => apiRequest<any>(`/api/subgoals/${id}`, {
    method: 'DELETE',
  }),

  // Actions
  getActions: (subGoalId: string) => apiRequest<any[]>(`/api/subgoals/${subGoalId}/actions`),
  createAction: (subGoalId: string, data: any) => apiRequest<any>(`/api/subgoals/${subGoalId}/actions`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateAction: (id: string, data: any) => apiRequest<any>(`/api/actions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  reorderAction: (id: string, targetPosition: number) => apiRequest<any>(`/api/actions/${id}/reorder`, {
    method: 'POST',
    body: JSON.stringify({ targetPosition }),
  }),
  toggleAction: (id: string) => apiRequest<any>(`/api/actions/${id}/complete`, {
    method: 'PATCH',
  }),
  deleteAction: (id: string) => apiRequest<any>(`/api/actions/${id}`, {
    method: 'DELETE',
  }),

  // User
  getUserSummary: () => apiRequest<any>('/api/user/summary'),

  // Activity Logs
  getActionLogs: (actionId: string, params?: { startDate?: string; endDate?: string; type?: string }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.type) query.append('type', params.type);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<any[]>(`/api/logs/action/${actionId}${queryString}`);
  },
  getLog: (logId: string) => apiRequest<any>(`/api/logs/${logId}`),
  createLog: (actionId: string, data: any) => apiRequest<any>(`/api/logs/action/${actionId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateLog: (logId: string, data: any) => apiRequest<any>(`/api/logs/${logId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteLog: (logId: string) => apiRequest<any>(`/api/logs/${logId}`, {
    method: 'DELETE',
  }),
  getActionStats: (actionId: string) => apiRequest<any>(`/api/logs/action/${actionId}/stats`),
};

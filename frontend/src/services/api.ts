import type {
  Container,
  ContainerDetail,
  ContainerEvent,
  ContainerStats,
  CreateContainerPayload,
  SystemStats
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || '';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const err = await response.json();
      errorMsg = err.detail || err.message || errorMsg;
    } catch {
    }
    throw new Error(errorMsg);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

export const api = {
  getSystemStats: () => request<SystemStats>('/api/system/stats'),
  getContainers: () => request<Container[]>('/api/containers'),
  getContainerDetail: (id: string) => request<ContainerDetail>(`/api/containers/${id}`),
  createContainer: (payload: CreateContainerPayload) =>
    request<Container>('/api/containers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  startContainer: (id: string) =>
    request<Container>(`/api/containers/${id}/start`, { method: 'POST' }),
  stopContainer: (id: string) =>
    request<Container>(`/api/containers/${id}/stop`, { method: 'POST' }),
  restartContainer: (id: string) =>
    request<Container>(`/api/containers/${id}/restart`, { method: 'POST' }),
  deleteContainer: (id: string) =>
    request<void>(`/api/containers/${id}`, { method: 'DELETE' }),
  getLogs: (id: string, tail: number = 200) =>
    request<{ container_id: string; name: string; logs: string }>(
      `/api/containers/${id}/logs?tail=${tail}`
    ),
  getStats: (id: string) => request<ContainerStats>(`/api/containers/${id}/stats`),
  getEvents: (id: string) => request<ContainerEvent[]>(`/api/containers/${id}/events`),
  updateContainer: (id: string, image: string) =>
    request<Container>(`/api/containers/${id}/update`, {
      method: 'POST',
      body: JSON.stringify({ image }),
    }),
  resetRestarts: (id: string) =>
    request<Container>(`/api/containers/${id}/reset-restarts`, { method: 'POST' }),
};

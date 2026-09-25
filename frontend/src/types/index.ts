export interface HealthCheckConfig {
  type: string;
  path?: string;
  timeout: number;
}

export interface Container {
  id: string;
  name: string;
  image: string;
  docker_id: string | null;
  host_port: number | null;
  container_port: number | null;
  env_vars: Record<string, string>;
  auto_restart: boolean;
  desired_state: string;
  actual_status: string;
  health_status: string;
  restart_count: number;
  last_restart_at: string | null;
  last_failure_at: string | null;
  health_check_type: string | null;
  health_check_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContainerEvent {
  id: string;
  container_id: string;
  event_type: string;
  reason: string | null;
  previous_state: string | null;
  new_state: string | null;
  timestamp: string;
}

export interface ContainerDetail extends Container {
  events: ContainerEvent[];
}

export interface ContainerStats {
  cpu_percent: number | null;
  memory_usage_bytes: number | null;
  memory_limit_bytes: number | null;
  memory_percent: number | null;
  network_rx_bytes: number | null;
  network_tx_bytes: number | null;
  block_read_bytes: number | null;
  block_write_bytes: number | null;
  is_available: boolean;
  detail: string | null;
}

export interface SystemStats {
  total_containers: number;
  running_containers: number;
  healthy_containers: number;
  unhealthy_containers: number;
  failed_containers: number;
  total_restarts: number;
  docker_connected: boolean;
  docker_version: string | null;
}

export interface CreateContainerPayload {
  name: string;
  image: string;
  port?: number | null;
  container_port?: number | null;
  env_vars?: Record<string, string>;
  auto_restart: boolean;
  health_check?: HealthCheckConfig | null;
}

import { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Activity,
  History,
  Settings,
  RefreshCw,
  Copy,
  Check,
  Cpu,
  HardDrive,
  Network,
  RotateCcw,
  Zap,
  AlertTriangle
} from 'lucide-react';
import type { Container, ContainerDetail, ContainerEvent, ContainerStats } from '../types';
import { api } from '../services/api';

interface ContainerDetailsModalProps {
  container: Container;
  initialTab?: 'overview' | 'metrics' | 'logs' | 'events' | 'update';
  isOpen: boolean;
  onClose: () => void;
  onRefreshList: () => void;
}

export const ContainerDetailsModal: React.FC<ContainerDetailsModalProps> = ({
  container,
  initialTab = 'overview',
  isOpen,
  onClose,
  onRefreshList,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'logs' | 'events' | 'update'>(
    initialTab
  );
  const [detail, setDetail] = useState<ContainerDetail | null>(null);
  const [logs, setLogs] = useState<string>('Loading logs...');
  const [tailLines, setTailLines] = useState<number>(200);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [events, setEvents] = useState<ContainerEvent[]>([]);
  const [newImage, setNewImage] = useState(container.image);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!isOpen) return;

    loadDetails();
    loadEvents();
    if (activeTab === 'logs') loadLogs();
    if (activeTab === 'metrics') loadStats();
  }, [isOpen, container.id, activeTab]);

  const loadDetails = async () => {
    try {
      const data = await api.getContainerDetail(container.id);
      setDetail(data);
    } catch {
    }
  };

  const loadEvents = async () => {
    try {
      const data = await api.getEvents(container.id);
      setEvents(data);
    } catch {
    }
  };

  const loadLogs = async () => {
    setIsFetchingLogs(true);
    try {
      const data = await api.getLogs(container.id, tailLines);
      setLogs(data.logs || 'No logs captured yet.');
    } catch (err: any) {
      setLogs(`Failed to load logs: ${err.message}`);
    } finally {
      setIsFetchingLogs(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await api.getStats(container.id);
      setStats(data);
    } catch {
    }
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleRollingUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError(null);
    setUpdateSuccess(null);
    setIsUpdating(true);

    try {
      await api.updateContainer(container.id, newImage.trim());
      setUpdateSuccess(`Successfully updated container to image: ${newImage}`);
      onRefreshList();
      loadDetails();
      loadEvents();
    } catch (err: any) {
      setUpdateError(err.message || 'Rolling update failed.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetRestarts = async () => {
    try {
      await api.resetRestarts(container.id);
      onRefreshList();
      loadDetails();
      loadEvents();
    } catch (err: any) {
      alert(`Failed to reset restarts: ${err.message}`);
    }
  };

  const formatBytes = (bytes: number | null | undefined) => {
    if (bytes === null || bytes === undefined) return 'Unavailable';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getEventBadgeColor = (eventType: string) => {
    switch (eventType) {
      case 'DEPLOYMENT':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'CONTAINER_STARTED':
      case 'CONTAINER_RECOVERED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'HEALTH_CHECK_FAILED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'AUTO_RESTART':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'RESTART_LIMIT_REACHED':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'CONTAINER_STOPPED':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      case 'UPDATE':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  if (!isOpen) return null;
  const target = detail || container;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono text-sm font-bold">
              {target.name}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{target.image}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {target.docker_id ? target.docker_id.substring(0, 12) : 'No Docker ID'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Desired: <span className="font-semibold text-slate-200">{target.desired_state}</span> |
                Actual: <span className="font-semibold text-slate-200">{target.actual_status}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 border-b border-slate-800 flex space-x-6 bg-slate-950/40">
          {[
            { id: 'overview', label: 'Overview', icon: Settings },
            { id: 'metrics', label: 'Resource Metrics', icon: Activity },
            { id: 'logs', label: 'Logs', icon: FileText },
            { id: 'events', label: `Event History (${events.length})`, icon: History },
            { id: 'update', label: 'Rolling Update', icon: Zap },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
                  active
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/50">
                  <span className="text-xs text-slate-400">Actual Status</span>
                  <div className="text-sm font-semibold text-white mt-1 capitalize">
                    {target.actual_status}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/50">
                  <span className="text-xs text-slate-400">Health State</span>
                  <div className="text-sm font-semibold text-white mt-1 capitalize">
                    {target.health_status}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/50">
                  <span className="text-xs text-slate-400">Restarts Triggered</span>
                  <div className="text-sm font-semibold text-white mt-1">
                    {target.restart_count}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/50">
                  <span className="text-xs text-slate-400">Auto-Recovery Policy</span>
                  <div className="text-sm font-semibold text-white mt-1">
                    {target.auto_restart ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl bg-slate-950/50 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Container Metadata & Runtime Configuration
                </h4>
                <div className="grid grid-cols-2 gap-y-3 text-xs">
                  <div>
                    <span className="text-slate-500">Internal Orchestrator ID:</span>
                    <p className="font-mono text-slate-300 mt-0.5">{target.id}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Docker Engine ID:</span>
                    <p className="font-mono text-slate-300 mt-0.5">{target.docker_id || 'None'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Port Mapping:</span>
                    <p className="font-mono text-slate-300 mt-0.5">
                      {target.host_port && target.container_port
                        ? `${target.host_port}:${target.container_port}`
                        : 'No host port assigned'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Health Check Type:</span>
                    <p className="font-mono text-slate-300 mt-0.5">
                      {target.health_check_type || 'docker'}{' '}
                      {target.health_check_path ? `(${target.health_check_path})` : ''}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Created Timestamp:</span>
                    <p className="text-slate-300 mt-0.5">
                      {new Date(target.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Last Restart:</span>
                    <p className="text-slate-300 mt-0.5">
                      {target.last_restart_at
                        ? new Date(target.last_restart_at).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-950/40">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Restart Counter</h4>
                  <p className="text-xs text-slate-400">
                    Reset restart backoff and counter if container was resolved manually.
                  </p>
                </div>
                <button
                  onClick={handleResetRestarts}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Restart Counter
                </button>
              </div>
            </div>
          )}

          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Live Docker Resource Telemetry</h4>
                  <p className="text-xs text-slate-400">
                    Current metrics from the Docker Engine API
                  </p>
                </div>
                <button
                  onClick={loadStats}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Telemetry
                </button>
              </div>

              {stats && stats.is_available ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-semibold">CPU Usage</span>
                      <Cpu className="w-4 h-4 text-sky-400" />
                    </div>
                    <div className="mt-4">
                      <div className="text-3xl font-bold text-white">
                        {stats.cpu_percent !== null ? `${stats.cpu_percent}%` : 'Unavailable'}
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                        <div
                          className="bg-sky-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(stats.cpu_percent || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-semibold">Memory Usage</span>
                      <HardDrive className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="mt-4">
                      <div className="text-3xl font-bold text-white">
                        {stats.memory_percent !== null
                          ? `${stats.memory_percent}%`
                          : 'Unavailable'}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatBytes(stats.memory_usage_bytes)} / {formatBytes(stats.memory_limit_bytes)}
                      </p>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(stats.memory_percent || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-xs font-semibold">Network I/O</span>
                      <Network className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">RX (Received):</span>
                        <p className="font-semibold text-slate-200 mt-0.5">
                          {formatBytes(stats.network_rx_bytes)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">TX (Transmitted):</span>
                        <p className="font-semibold text-slate-200 mt-0.5">
                          {formatBytes(stats.network_tx_bytes)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-xs font-semibold">Block I/O</span>
                      <HardDrive className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">Read:</span>
                        <p className="font-semibold text-slate-200 mt-0.5">
                          {formatBytes(stats.block_read_bytes)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Write:</span>
                        <p className="font-semibold text-slate-200 mt-0.5">
                          {formatBytes(stats.block_write_bytes)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center rounded-xl border border-slate-800 bg-slate-950/40">
                  <Activity className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                  <p className="text-sm font-semibold text-slate-300">
                    Resource statistics currently unavailable
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {stats?.detail || 'Metrics are only available while the container is actively running.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="flex flex-col h-full space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <select
                    value={tailLines}
                    onChange={(e) => setTailLines(parseInt(e.target.value, 10))}
                    className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 focus:outline-none"
                  >
                    <option value={100}>Tail 100 lines</option>
                    <option value={200}>Tail 200 lines</option>
                    <option value={500}>Tail 500 lines</option>
                  </select>
                  <button
                    onClick={loadLogs}
                    disabled={isFetchingLogs}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                    title="Refresh logs"
                  >
                    <RefreshCw className={`w-4 h-4 ${isFetchingLogs ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <button
                  onClick={handleCopyLogs}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1.5 transition"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {isCopied ? 'Copied' : 'Copy Logs'}
                </button>
              </div>

              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 overflow-y-auto whitespace-pre-wrap max-h-[450px]">
                {logs}
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Orchestrator Lifecycle & Recovery Audit Trail
                </h4>
                <button
                  onClick={loadEvents}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
              </div>

              {events.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No lifecycle events recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {events.map((e) => (
                    <div
                      key={e.id}
                      className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/60 flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider ${getEventBadgeColor(
                              e.event_type
                            )}`}
                          >
                            {e.event_type}
                          </span>
                          {e.previous_state && e.new_state && (
                            <span className="text-xs text-slate-400">
                              {e.previous_state} → <span className="text-slate-200 font-semibold">{e.new_state}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300">{e.reason}</p>
                      </div>
                      <span className="text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(e.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'update' && (
            <div className="space-y-4 max-w-lg">
              <div>
                <h4 className="text-sm font-bold text-white">Perform Rolling Update</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Safely deploys a new image tag by pre-pulling, health-probing a test container, and replacing the existing instance with minimal downtime.
                </p>
              </div>

              {updateError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{updateError}</span>
                </div>
              )}

              {updateSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{updateSuccess}</span>
                </div>
              )}

              <form onSubmit={handleRollingUpdate} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    New Target Image Tag *
                  </label>
                  <input
                    type="text"
                    value={newImage}
                    onChange={(e) => setNewImage(e.target.value)}
                    required
                    placeholder="e.g. nginx:1.25-alpine"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUpdating || newImage.trim() === container.image}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                >
                  {isUpdating ? 'Executing Rolling Update...' : 'Execute Rolling Update'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import {
  Play,
  Square,
  RefreshCw,
  FileText,
  Activity,
  Trash2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import type { Container } from '../types';

interface ContainerTableProps {
  containers: Container[];
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onDelete: (id: string) => void;
  onViewDetails: (container: Container) => void;
  onViewLogs: (container: Container) => void;
  actionInProgressId: string | null;
}

export const ContainerTable: React.FC<ContainerTableProps> = ({
  containers,
  onStart,
  onStop,
  onRestart,
  onDelete,
  onViewDetails,
  onViewLogs,
  actionInProgressId,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Running
          </span>
        );
      case 'restarting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Restarting
          </span>
        );
      case 'restart_failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            Restart limit reached
          </span>
        );
      case 'stopped':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            Stopped
          </span>
        );
      case 'exited':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            Exited
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            Healthy
          </span>
        );
      case 'unhealthy':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-950/60 text-rose-300 border border-rose-800/40">
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            Unhealthy
          </span>
        );
      case 'starting':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-950/60 text-sky-300 border border-sky-800/40">
            Starting
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Unknown
          </span>
        );
    }
  };

  if (containers.length === 0) {
    return (
      <div className="text-center py-16 px-4 rounded-xl border border-slate-800 bg-slate-900/50">
        <Activity className="w-12 h-12 mx-auto text-slate-600 mb-3" />
        <h3 className="text-base font-semibold text-slate-300">No managed containers</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
          Deploy a Docker container to add it to the health and restart monitor.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#80606a]/45 bg-[#241a29]/80 backdrop-blur-sm shadow-2xl shadow-black/20">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/90 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
            <tr>
              <th className="py-3.5 px-4 font-semibold">Container</th>
              <th className="py-3.5 px-4 font-semibold">Image</th>
              <th className="py-3.5 px-4 font-semibold">Status</th>
              <th className="py-3.5 px-4 font-semibold">Health</th>
              <th className="py-3.5 px-4 font-semibold">Port Mapping</th>
              <th className="py-3.5 px-4 font-semibold">Restarts</th>
              <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {containers.map((c) => {
              const isActing = actionInProgressId === c.id;
              return (
                <tr
                  key={c.id}
                  className="transition duration-150 group hover:bg-[#3a2637]/55"
                >
                  <td className="py-3.5 px-4 font-medium text-white flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100">{c.name}</span>
                      {c.auto_restart && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          Auto-Recover
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-mono mt-0.5">
                      {c.docker_id ? c.docker_id.substring(0, 12) : 'No container ID'}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                    <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800">
                      {c.image}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">{getStatusBadge(c.actual_status)}</td>

                  <td className="py-3.5 px-4">{getHealthBadge(c.health_status)}</td>

                  <td className="py-3.5 px-4 text-xs font-mono text-slate-400">
                    {c.host_port && c.container_port ? (
                      <a
                        href={`http://localhost:${c.host_port}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 hover:underline"
                      >
                        {c.host_port}:{c.container_port}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        c.restart_count > 0
                          ? c.actual_status === 'restart_failed'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {c.restart_count}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {c.actual_status === 'running' ? (
                        <button
                          onClick={() => onStop(c.id)}
                          disabled={isActing}
                          title="Stop Container"
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => onStart(c.id)}
                          disabled={isActing}
                          title="Start Container"
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => onRestart(c.id)}
                        disabled={isActing}
                        title="Restart Container"
                        className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onViewLogs(c)}
                        title="View Logs"
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition"
                      >
                        <FileText className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onViewDetails(c)}
                        title="Open details"
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                      >
                        <Activity className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onDelete(c.id)}
                        disabled={isActing}
                        title="Remove Container"
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

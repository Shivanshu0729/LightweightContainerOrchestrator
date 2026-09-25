import { Layers, Plus, RefreshCw } from 'lucide-react';
import type { SystemStats } from '../types';

interface NavbarProps {
  stats: SystemStats | null;
  onDeployClick: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  stats,
  onDeployClick,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-[#80606a]/35 bg-[#17121d]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="rounded-xl bg-[#d98262] p-2 text-[#241525] shadow-lg shadow-[#d98262]/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#fff4e9]">
              Lightweight Orchestrator
              <span className="rounded bg-[#d98262]/10 px-2 py-0.5 text-xs font-semibold text-[#f0b37c] border border-[#d98262]/25">
                Docker Engine API
              </span>
            </h1>
            <p className="text-xs text-[#bfa8ae]">
              Health checks and restart policy
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden items-center gap-2 rounded-full border border-[#80606a]/50 bg-[#2b1d32]/60 px-3 py-1.5 text-xs md:flex">
            <span
              className={`w-2 h-2 rounded-full ${
                stats?.docker_connected ? 'bg-[#6fc5a6] animate-pulse' : 'bg-[#e47770]'
              }`}
            />
            <span className="font-medium text-[#e8d4d0]">
              {stats?.docker_connected
                ? `Docker Engine ${stats.docker_version ? `v${stats.docker_version}` : 'Connected'}`
                : 'Docker Disconnected'}
            </span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="rounded-lg p-2 text-[#bfa8ae] transition hover:bg-[#3a2637] hover:text-[#fff4e9]"
            title="Refresh status"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-[#f0b37c]' : ''}`} />
          </button>

          <button
            onClick={onDeployClick}
            className="flex items-center gap-2 rounded-xl bg-[#d98262] px-4 py-2 text-sm font-bold text-[#241525] shadow-lg shadow-[#d98262]/20 transition hover:bg-[#eea076]"
          >
            <Plus className="w-4 h-4" />
            Deploy Container
          </button>
        </div>
      </div>
    </header>
  );
};

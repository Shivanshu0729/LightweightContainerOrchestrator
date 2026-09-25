import { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { StatsCards } from './components/StatsCards';
import { ContainerTable } from './components/ContainerTable';
import { DeployModal } from './components/DeployModal';
import { ContainerDetailsModal } from './components/ContainerDetailsModal';
import type { Container, CreateContainerPayload, SystemStats } from './types';
import { api } from './services/api';
import heroImage from './assets/hero.png';

export function App() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [detailsTab, setDetailsTab] = useState<'overview' | 'metrics' | 'logs' | 'events' | 'update'>('overview');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true);
    try {
      const [stats, list] = await Promise.all([
        api.getSystemStats(),
        api.getContainers(),
      ]);
      setSystemStats(stats);
      setContainers(list);

      if (selectedContainer) {
        const updated = list.find((c) => c.id === selectedContainer.id);
        if (updated) setSelectedContainer(updated);
      }
    } catch {
    } finally {
      if (!quiet) setIsRefreshing(false);
    }
  }, [selectedContainer]);

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData(true);
    }, 3000);

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/system/stream');
      eventSource.onmessage = () => {
        loadData(true);
      };
    } catch {
    }

    return () => {
      clearInterval(interval);
      if (eventSource) eventSource.close();
    };
  }, [loadData]);

  const handleStart = async (id: string) => {
    setActionInProgressId(id);
    try {
      await api.startContainer(id);
      showNotification('success', 'Container started.');
      await loadData(true);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to start container.');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleStop = async (id: string) => {
    setActionInProgressId(id);
    try {
      await api.stopContainer(id);
      showNotification('success', 'Container stopped.');
      await loadData(true);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to stop container.');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleRestart = async (id: string) => {
    setActionInProgressId(id);
    try {
      await api.restartContainer(id);
      showNotification('success', 'Container restarted.');
      await loadData(true);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to restart container.');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this managed container from Docker and the orchestrator?')) {
      return;
    }
    setActionInProgressId(id);
    try {
      await api.deleteContainer(id);
      showNotification('success', 'Container deleted.');
      if (selectedContainer?.id === id) {
        setIsDetailsModalOpen(false);
        setSelectedContainer(null);
      }
      await loadData(true);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to remove container.');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleDeploy = async (payload: CreateContainerPayload) => {
    await api.createContainer(payload);
    showNotification('success', `Container '${payload.name}' deployed successfully.`);
    await loadData(true);
  };

  const handleViewDetails = (c: Container) => {
    setSelectedContainer(c);
    setDetailsTab('overview');
    setIsDetailsModalOpen(true);
  };

  const handleViewLogs = (c: Container) => {
    setSelectedContainer(c);
    setDetailsTab('logs');
    setIsDetailsModalOpen(true);
  };

  return (
    <div className="min-h-screen text-stone-100 flex flex-col selection:bg-orange-300 selection:text-stone-950">
      <Navbar
        stats={systemStats}
        onDeployClick={() => setIsDeployModalOpen(true)}
        onRefresh={() => loadData(false)}
        isRefreshing={isRefreshing}
      />

      {notification && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full mt-4">
          <div
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-lg ${
              notification.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/80 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
        <section className="relative min-h-[270px] overflow-hidden rounded-[2rem] border border-[#80606a]/50 bg-[#2b1d32] shadow-2xl shadow-black/25">
          <img src={heroImage} alt="Mountain landscape" className="absolute inset-0 h-full w-full object-cover opacity-75" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#17121d]/95 via-[#24182a]/70 to-[#24182a]/10" />
          <div className="relative flex min-h-[270px] flex-col justify-between p-7 sm:p-10">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[#f0b37c]">
              <span className="h-2 w-2 rounded-full bg-[#d98262] shadow-[0_0_14px_#d98262]" />
              Control room / Docker host
            </div>
            <div className="max-w-xl">
              <p className="mb-3 text-sm font-medium text-[#eac8b1]">Thursday, September 24 · 17:38</p>
              <h2 className="max-w-lg text-3xl font-bold leading-tight tracking-tight text-[#fff4e9] sm:text-5xl">
                Keep every container in its place.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-[#e7d2c9]">
                A quiet view of the services running on this Docker host, with health and recovery status close at hand.
              </p>
            </div>
          </div>
        </section>

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#d98262]">At a glance</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#fff4e9]">Host overview</h2>
          </div>
          <span className="rounded-full border border-[#80606a]/60 bg-[#2b1d32]/70 px-3 py-1.5 text-xs text-[#d8bdb6]">
            Updates every 3 seconds
          </span>
        </div>

        <StatsCards stats={systemStats} />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#d98262]">Workloads</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#fff4e9]">Managed containers</h2>
              <p className="text-sm text-[#bfa8ae] mt-1">
                Health checks and restart policy are handled by the monitor.
              </p>
            </div>
            <span className="text-xs font-medium text-[#e8c6ad] bg-[#3a2637] px-3 py-1.5 rounded-full border border-[#80606a]/60">
              {containers.length} {containers.length === 1 ? 'Container' : 'Containers'}
            </span>
          </div>

          <ContainerTable
            containers={containers}
            onStart={handleStart}
            onStop={handleStop}
            onRestart={handleRestart}
            onDelete={handleDelete}
            onViewDetails={handleViewDetails}
            onViewLogs={handleViewLogs}
            actionInProgressId={actionInProgressId}
          />
        </div>
      </main>

      <footer className="border-t border-[#80606a]/30 py-6 text-center text-xs text-[#9e858f]">
        Lightweight Orchestrator · Docker Engine API · FastAPI
      </footer>

      <DeployModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        onSubmit={handleDeploy}
      />

      {selectedContainer && (
        <ContainerDetailsModal
          container={selectedContainer}
          initialTab={detailsTab}
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedContainer(null);
          }}
          onRefreshList={() => loadData(true)}
        />
      )}
    </div>
  );
}

export default App;

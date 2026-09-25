import { useState } from 'react';
import { X, Plus, Trash, AlertCircle } from 'lucide-react';
import type { CreateContainerPayload } from '../types';

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateContainerPayload) => Promise<void>;
}

export const DeployModal: React.FC<DeployModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [hostPort, setHostPort] = useState<string>('');
  const [containerPort, setContainerPort] = useState<string>('');
  const [autoRestart, setAutoRestart] = useState(true);
  const [healthType, setHealthType] = useState('docker');
  const [healthPath, setHealthPath] = useState('/');
  const [healthTimeout, setHealthTimeout] = useState('3');
  const [envPairs, setEnvPairs] = useState<{ key: string; value: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddEnv = () => {
    setEnvPairs([...envPairs, { key: '', value: '' }]);
  };

  const handleRemoveEnv = (index: number) => {
    setEnvPairs(envPairs.filter((_, i) => i !== index));
  };

  const handleEnvChange = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envPairs];
    updated[index][field] = value;
    setEnvPairs(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Container name is required.');
      return;
    }
    if (!image.trim()) {
      setError('Docker image name is required.');
      return;
    }

    const env_vars: Record<string, string> = {};
    for (const pair of envPairs) {
      if (pair.key.trim()) {
        env_vars[pair.key.trim()] = pair.value;
      }
    }

    const payload: CreateContainerPayload = {
      name: name.trim(),
      image: image.trim(),
      port: hostPort ? parseInt(hostPort, 10) : null,
      container_port: containerPort ? parseInt(containerPort, 10) : null,
      auto_restart: autoRestart,
      env_vars,
      health_check: {
        type: healthType,
        path: healthType === 'http' ? healthPath.trim() || '/' : undefined,
        timeout: parseInt(healthTimeout, 10) || 3,
      },
    };

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to deploy container.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Deploy Managed Container</h3>
            <p className="text-xs text-slate-400">
              Register a container with health monitoring and automatic crash recovery
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Container Name *
              </label>
              <input
                type="text"
                placeholder="e.g. demo-nginx"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Docker Image *
              </label>
              <input
                type="text"
                placeholder="e.g. nginx:alpine"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Host Port (optional)
              </label>
              <input
                type="number"
                placeholder="e.g. 8080"
                value={hostPort}
                onChange={(e) => setHostPort(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Container Port (optional)
              </label>
              <input
                type="number"
                placeholder="e.g. 80"
                value={containerPort}
                onChange={(e) => setContainerPort(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-slate-200">Restart on failure</span>
              <p className="text-xs text-slate-400">
                Automatically restart container when it exits unexpectedly or becomes unhealthy
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoRestart}
              onChange={(e) => setAutoRestart(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          <div className="border-t border-slate-800 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Health Check Policy
            </h4>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[
                { id: 'docker', label: 'Docker Native' },
                { id: 'http', label: 'HTTP Probe' },
                { id: 'none', label: 'Process Only' },
              ].map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setHealthType(h.id)}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition ${
                    healthType === h.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>

            {healthType === 'http' && (
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    HTTP Probe Path
                  </label>
                  <input
                    type="text"
                    placeholder="/healthz or /"
                    value={healthPath}
                    onChange={(e) => setHealthPath(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Timeout (sec)
                  </label>
                  <input
                    type="number"
                    value={healthTimeout}
                    onChange={(e) => setHealthTimeout(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Environment Variables
              </h4>
              <button
                type="button"
                onClick={handleAddEnv}
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
              >
                <Plus className="w-3 h-3" />
                Add Variable
              </button>
            </div>

            {envPairs.length > 0 && (
              <div className="space-y-2">
                {envPairs.map((pair, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="KEY"
                      value={pair.key}
                      onChange={(e) => handleEnvChange(idx, 'key', e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-slate-500">=</span>
                    <input
                      type="text"
                      placeholder="VALUE"
                      value={pair.value}
                      onChange={(e) => handleEnvChange(idx, 'value', e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveEnv(idx)}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-600/20 transition flex items-center gap-2"
            >
              {isSubmitting ? 'Deploying...' : 'Deploy Container'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

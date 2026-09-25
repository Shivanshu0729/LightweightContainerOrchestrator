import { Box, PlayCircle, CheckCircle2, AlertTriangle, XCircle, RotateCcw } from 'lucide-react';
import type { SystemStats } from '../types';

interface StatsCardsProps {
  stats: SystemStats | null;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const cards = [
    {
      title: 'Total Containers',
      value: stats?.total_containers ?? 0,
      icon: Box,
      color: 'text-[#f0b37c]',
      bgColor: 'bg-[#3a2637]',
      borderColor: 'border-[#80606a]/50',
    },
    {
      title: 'Running',
      value: stats?.running_containers ?? 0,
      icon: PlayCircle,
      color: 'text-[#9bd4c0]',
      bgColor: 'bg-[#233c3b]',
      borderColor: 'border-[#6aa895]/40',
    },
    {
      title: 'Healthy',
      value: stats?.healthy_containers ?? 0,
      icon: CheckCircle2,
      color: 'text-[#9bd4c0]',
      bgColor: 'bg-[#233c3b]',
      borderColor: 'border-[#6aa895]/40',
    },
    {
      title: 'Unhealthy',
      value: stats?.unhealthy_containers ?? 0,
      icon: AlertTriangle,
      color: 'text-[#f0b37c]',
      bgColor: 'bg-[#45302e]',
      borderColor: 'border-[#c27a5d]/45',
    },
    {
      title: 'Failed / Stalled',
      value: stats?.failed_containers ?? 0,
      icon: XCircle,
      color: 'text-[#e47770]',
      bgColor: 'bg-[#43252f]',
      borderColor: 'border-[#b4525a]/45',
    },
    {
      title: 'Auto Restarts',
      value: stats?.total_restarts ?? 0,
      icon: RotateCcw,
      color: 'text-[#d9a7c7]',
      bgColor: 'bg-[#35233e]',
      borderColor: 'border-[#986d9b]/45',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.title}
            className={`rounded-2xl border p-4 ${c.borderColor} ${c.bgColor} backdrop-blur-sm transition-colors duration-200 hover:brightness-110`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#c7afb2]">{c.title}</span>
              <Icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div className="mt-2 flex items-baseline">
              <span className="text-3xl font-bold tracking-tight text-[#fff4e9]">{c.value}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  colorClass: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, colorClass }) => (
  <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between ${colorClass}`}>
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1 uppercase tracking-wider">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
    </div>
    <div className={`p-3 rounded-xl bg-opacity-20 ${colorClass.replace('border-l-4', 'bg-current text-current')}`}>
      {icon}
    </div>
  </div>
);

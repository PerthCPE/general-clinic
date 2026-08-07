import React, { useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { StatCard } from './StatCard';
import {
  Code,
  Copy,
  Check,
  Component,
  Stethoscope,
  Search,
  LayoutDashboard,
  Users,
  PlusCircle,
  Sliders,
  Sparkles
} from 'lucide-react';
import { QueueStatus } from '../../types';

export const ComponentShowcase: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Playground state
  const [demoBadgeStatus, setDemoBadgeStatus] = useState<QueueStatus>('Waiting');
  const [demoButtonLabel, setDemoButtonLabel] = useState('Examine');
  const [demoStatVal, setDemoStatVal] = useState(25);
  const [demoStatTitle, setDemoStatTitle] = useState('Total Patients Today');

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Figma System Banner */}
      <div className="bg-gradient-to-r from-[#162a4a] via-[#1e3a68] to-[#2563eb] rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
          <Component className="w-96 h-96 -mr-20 -mt-20" />
        </div>
        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-blue-500/30 border border-blue-400/30 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-blue-200">
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            <span>ClinicMS Figma Design System v1.0</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Figma Component UI Kit & Design Tokens
          </h1>
          <p className="text-blue-100/80 text-sm leading-relaxed">
            Inspect, test, and copy component specifications built to mirror the Figma designs with pixel-perfect accuracy. Fully compliant with Tailwind CSS v4 & React TypeScript.
          </p>
        </div>
      </div>

      {/* Component 1: Status Badges */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              Status Badges (Pills)
            </h2>
            <p className="text-xs text-slate-500">
              Figma Frame: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">Component/Badge/QueueStatus</code>
            </p>
          </div>
          <button
            onClick={() => copyToClipboard(`<StatusBadge status="${demoBadgeStatus}" />`, 'badge')}
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200/60"
          >
            {copiedId === 'badge' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedId === 'badge' ? 'Copied React Code' : 'Copy Component'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2">
          {(['Waiting', 'Examining', 'Lab', 'Completed', 'Cancelled'] as QueueStatus[]).map((st) => (
            <div key={st} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col items-center gap-2">
              <StatusBadge status={st} />
              <span className="text-[11px] font-mono text-slate-500">{st}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Component 2: Stat Cards */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              Quick Stat Cards
            </h2>
            <p className="text-xs text-slate-500">
              Figma Frame: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">Component/Card/StatTile</code>
            </p>
          </div>
          <button
            onClick={() => copyToClipboard(`<StatCard title="Total Patients Today" value={25} iconType="users" />`, 'statcard')}
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200/60"
          >
            {copiedId === 'statcard' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedId === 'statcard' ? 'Copied' : 'Copy JSX'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <StatCard title="Total Patients Today" value={25} iconType="users" />
          <StatCard title="Currently Waiting" value={8} iconType="clock" />
          <StatCard title="Completed Visits" value={15} iconType="check" />
        </div>
      </section>

      {/* Component 3: Buttons & Controls */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
              Interactive Buttons
            </h2>
            <p className="text-xs text-slate-500">
              Figma Frame: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">Component/Button/Primary & Secondary</code>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Action Examine Button */}
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-semibold text-slate-500">Action Button (Examine)</div>
            <button className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4" />
              <span>Examine</span>
            </button>
            <div className="text-[11px] font-mono text-slate-400 bg-white p-2 rounded border border-slate-200">
              bg-[#2563eb] text-white rounded-lg text-xs font-semibold
            </div>
          </div>

          {/* New Patient Button */}
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-semibold text-slate-500">Primary Green Button</div>
            <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4" />
              <span>New Queue Patient</span>
            </button>
            <div className="text-[11px] font-mono text-slate-400 bg-white p-2 rounded border border-slate-200">
              bg-emerald-600 text-white rounded-xl font-semibold
            </div>
          </div>

          {/* Search Pill Input */}
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-semibold text-slate-500">Pill Search Bar</div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                readOnly
                value="Search patients, records..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#f0f4f8] text-slate-600 text-xs rounded-full border border-slate-200"
              />
            </div>
            <div className="text-[11px] font-mono text-slate-400 bg-white p-2 rounded border border-slate-200">
              bg-[#f0f4f8] rounded-full pl-10 pr-4 text-sm
            </div>
          </div>
        </div>
      </section>

      {/* Component 4: Sidebar Navigation Item Specs */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-800"></span>
            Sidebar Navigation Item States
          </h2>
          <p className="text-xs text-slate-500">
            Dark Navy Background (<code className="font-mono">#162a4a</code>) with Active State (<code className="font-mono">#2b446e</code>)
          </p>
        </div>

        <div className="bg-[#162a4a] p-6 rounded-2xl max-w-xl space-y-3">
          {/* Active Item */}
          <div className="space-y-1">
            <span className="text-[10px] text-blue-300 font-mono font-semibold uppercase">State: Active</span>
            <div className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl bg-[#2b446e] text-white font-semibold text-sm shadow-inner">
              <LayoutDashboard className="w-5 h-5 text-white" />
              <span>Dashboard</span>
            </div>
          </div>

          {/* Inactive Item */}
          <div className="space-y-1 pt-2">
            <span className="text-[10px] text-slate-400 font-mono font-semibold uppercase">State: Default / Inactive</span>
            <div className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-slate-300 font-medium text-sm hover:bg-[#1f355c]">
              <Users className="w-5 h-5 text-slate-300" />
              <span>Patient Queue</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Figma Component Playground */}
      <section className="bg-slate-900 text-white rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">
              Live Interactive Component Tester
            </h2>
          </div>
          <span className="text-xs bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full font-mono">
            Interactive Props
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Controls */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Badge Status Property
              </label>
              <select
                value={demoBadgeStatus}
                onChange={(e) => setDemoBadgeStatus(e.target.value as QueueStatus)}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:border-blue-500"
              >
                <option value="Waiting">Waiting (Green)</option>
                <option value="Examining">Examining (Blue)</option>
                <option value="Lab">Lab (Amber)</option>
                <option value="Completed">Completed (Slate)</option>
                <option value="Cancelled">Cancelled (Red)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Stat Tile Count
              </label>
              <input
                type="number"
                value={demoStatVal}
                onChange={(e) => setDemoStatVal(Number(e.target.value))}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Stat Tile Label
              </label>
              <input
                type="text"
                value={demoStatTitle}
                onChange={(e) => setDemoStatTitle(e.target.value)}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          {/* Render Preview */}
          <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 flex flex-col justify-center space-y-6">
            <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">
              Component Output Preview
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">Badge Output:</span>
                <StatusBadge status={demoBadgeStatus} />
              </div>

              <div>
                <span className="text-xs text-slate-400 block mb-2">Stat Tile Output:</span>
                <StatCard title={demoStatTitle} value={demoStatVal} iconType="users" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

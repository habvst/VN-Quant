import { Check, Code2, Copy, Cpu, Database, FileCode, Layers, Server, ShieldCheck, Terminal } from 'lucide-react';
import React, { useEffect, useState } from 'react';

export const ArchitectureView: React.FC = () => {
  const [blueprint, setBlueprint] = useState<any>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'DOCKERFILE' | 'COMPOSE' | 'K8S'>('DOCKERFILE');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/system/blueprint')
      .then((res) => res.json())
      .then((data) => setBlueprint(data));
  }, []);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActiveCode = () => {
    if (!blueprint) return '';
    if (activeCodeTab === 'DOCKERFILE') return blueprint.dockerfile;
    if (activeCodeTab === 'COMPOSE') return blueprint.dockerCompose;
    return blueprint.k8sManifest;
  };

  return (
    <div className="p-4 bg-[#050505] text-[#d1d5db] min-h-screen space-y-4 font-mono">
      {/* Header Banner */}
      <div className="bg-[#0a0a0a] p-4 rounded-sm border border-gray-800 shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-sm bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-mono font-black text-white">KIẾN TRÚC THIẾT KẾ HỆ THỐNG ENTERPRISE (SYSTEM BLUEPRINT)</h2>
            <p className="text-xs text-gray-400 font-mono">Microservices, TimescaleDB, Kafka, Redis, Docker & Kubernetes Production Deployment Specs</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 font-mono text-xs">
        {/* Left 6 cols: Architecture Specs & ERD */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 space-y-3 shadow-xl">
            <h3 className="font-bold text-blue-400 flex items-center space-x-2 border-b border-gray-800 pb-2 uppercase tracking-wider">
              <Layers className="w-4 h-4" />
              <span>TỔNG QUAN MICROSERVICES ARCHITECTURE</span>
            </h3>

            <div className="space-y-2 text-gray-300">
              <div>
                <strong className="text-emerald-400">Kiến trúc:</strong> {blueprint?.architecture}
              </div>
              <div>
                <strong className="text-blue-400">Database Engine:</strong> {blueprint?.database}
              </div>
            </div>

            <div className="pt-2">
              <span className="font-bold text-gray-200 block mb-2 uppercase">DANH SÁCH MICROSERVICES CHÍNH:</span>
              <ul className="space-y-1.5 list-disc pl-4 text-gray-400 text-[11px]">
                {blueprint?.services?.map((s: string, idx: number) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* TimescaleDB Schema */}
          <div className="bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 space-y-3 shadow-xl">
            <h3 className="font-bold text-blue-400 flex items-center space-x-2 border-b border-gray-800 pb-2 uppercase tracking-wider">
              <Database className="w-4 h-4" />
              <span>TIMESCALEDB ERD SCHEMA (FINANCIAL TIME-SERIES)</span>
            </h3>

            <pre className="bg-[#050505] p-3 rounded-sm border border-gray-800 text-[11px] text-emerald-400 overflow-x-auto">
{`-- Create Stock Market Candles Hypertable
CREATE TABLE stock_candles (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    period VARCHAR(5) NOT NULL, -- 1M, 5M, 1H, 1D
    open NUMERIC(10, 2) NOT NULL,
    high NUMERIC(10, 2) NOT NULL,
    low NUMERIC(10, 2) NOT NULL,
    close NUMERIC(10, 2) NOT NULL,
    volume BIGINT NOT NULL
);

-- Convert to TimescaleDB hypertable partitioned by time
SELECT create_hypertable('stock_candles', 'time');`}
            </pre>
          </div>
        </div>

        {/* Right 6 cols: Docker & Kubernetes Deployment Code */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#0a0a0a] rounded-sm p-4 border border-gray-800 space-y-3 shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <div className="flex items-center space-x-2">
                {(['DOCKERFILE', 'COMPOSE', 'K8S'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveCodeTab(t)}
                    className={`px-3 py-1 rounded-sm transition ${
                      activeCodeTab === t ? 'bg-blue-600 text-white font-bold' : 'bg-[#050505] text-gray-400 border border-gray-800'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handleCopy(getActiveCode())}
                className="bg-[#050505] hover:bg-gray-900 text-gray-200 px-3 py-1 rounded-sm border border-gray-800 flex items-center space-x-1.5 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'ĐÃ COPY' : 'COPY CODE'}</span>
              </button>
            </div>

            <div className="flex-1 bg-[#050505] p-3 rounded-sm border border-gray-800 overflow-x-auto text-[11px] text-gray-300 font-mono">
              <pre>{getActiveCode()}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

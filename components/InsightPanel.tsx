
import React from 'react';
import { Insight } from '../types';
import { AlertCircle, Zap, Info } from 'lucide-react';

interface InsightPanelProps {
  insights: Insight[];
  loading: boolean;
}

export const InsightPanel: React.FC<InsightPanelProps> = ({ insights, loading }) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="animate-pulse bg-slate-100 h-24 rounded-xl border border-slate-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-500" />
        AI 智能洞察 (Project Nexus)
      </h3>
      
      {insights.map((insight) => (
        <div 
          key={insight.id}
          className={`p-4 rounded-xl border-l-4 shadow-sm bg-white ${
            insight.type === 'WARNING' ? 'border-l-red-500' : 
            insight.type === 'CAUSAL' ? 'border-l-purple-500' : 'border-l-blue-500'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {insight.type === 'WARNING' ? <AlertCircle className="w-5 h-5 text-red-500" /> : <Info className="w-5 h-5 text-slate-400" />}
            </div>
            <div>
              <div className="font-bold text-slate-800">{insight.title}</div>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{insight.description}</p>
            </div>
          </div>
        </div>
      ))}

      {insights.length === 0 && (
        <div className="p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
          需要更多数据进行时间轴关联推理
        </div>
      )}
    </div>
  );
};

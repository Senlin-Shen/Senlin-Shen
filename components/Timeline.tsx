
import React from 'react';
import { FHIRResource, ResourceType } from '../types';
import { Calendar, Activity, FileText, ClipboardList, CheckSquare, Square } from 'lucide-react';

interface TimelineProps {
  data: FHIRResource[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelect: (item: FHIRResource) => void;
}

const getIcon = (type: ResourceType) => {
  switch (type) {
    case ResourceType.OBSERVATION: return <Activity className="w-4 h-4 text-blue-500" />;
    case ResourceType.CONDITION: return <FileText className="w-4 h-4 text-red-500" />;
    case ResourceType.PROCEDURE: return <ClipboardList className="w-4 h-4 text-purple-500" />;
    default: return <Calendar className="w-4 h-4 text-slate-400" />;
  }
};

export const Timeline: React.FC<TimelineProps> = ({ data, selectedIds, onToggleSelect, onSelect }) => {
  const sortedData = [...data].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="relative border-l-2 border-slate-200 ml-6 py-4">
      {sortedData.map((item) => {
        const isSelected = selectedIds.includes(item.id);
        return (
          <div key={item.id} className="mb-8 ml-6 relative group">
            {/* Checkbox Trigger */}
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleSelect(item.id); }}
              className="absolute -left-[3.25rem] mt-1.5 p-1 bg-white rounded-md border border-slate-200 hover:border-blue-400 transition-all z-10"
            >
              {isSelected ? <CheckSquare className="w-3 h-3 text-blue-600" /> : <Square className="w-3 h-3 text-slate-300" />}
            </button>

            {/* Timeline Dot Icon */}
            <div className={`absolute -left-10 mt-1 bg-white border-2 rounded-full p-1.5 transition-colors ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 group-hover:border-blue-300'}`}>
              {getIcon(item.resourceType)}
            </div>
            
            {/* Content Card */}
            <div 
              onClick={() => onSelect(item)}
              className={`cursor-pointer p-4 rounded-xl border transition-all shadow-sm hover:shadow-md ${isSelected ? 'bg-blue-50 border-blue-200 shadow-blue-50' : 'bg-white border-slate-200 hover:border-blue-100'}`}
            >
              <div className="flex justify-between items-start">
                <div className="text-xs font-mono text-slate-500 mb-1">{item.timestamp.split('T')[0]}</div>
                {isSelected && <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">已选中</span>}
              </div>
              <div className="font-semibold text-slate-800 line-clamp-2">{item.display}</div>
              <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{item.resourceType}</div>
            </div>
          </div>
        );
      })}
      
      {data.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>暂无病历记录，请导入资料</p>
        </div>
      )}
    </div>
  );
};

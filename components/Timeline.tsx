
import React from 'react';
import { FHIRResource, ResourceType } from '../types';
import { Calendar, Activity, FileText, ClipboardList } from 'lucide-react';

interface TimelineProps {
  data: FHIRResource[];
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

export const Timeline: React.FC<TimelineProps> = ({ data, onSelect }) => {
  const sortedData = [...data].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="relative border-l-2 border-slate-200 ml-4 py-4">
      {sortedData.map((item, idx) => (
        <div key={item.id} className="mb-8 ml-6 relative group">
          {/* Timeline Dot */}
          <div className="absolute -left-10 mt-1 bg-white border-2 border-slate-200 rounded-full p-1.5 group-hover:border-blue-500 transition-colors">
            {getIcon(item.resourceType)}
          </div>
          
          {/* Content Card */}
          <div 
            onClick={() => onSelect(item)}
            className="cursor-pointer bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
          >
            <div className="text-xs font-mono text-slate-500 mb-1">{item.timestamp.split('T')[0]}</div>
            <div className="font-semibold text-slate-800">{item.display}</div>
            <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{item.resourceType}</div>
          </div>
        </div>
      ))}
      
      {data.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>暂无病历记录，请上传报告</p>
        </div>
      )}
    </div>
  );
};


import React, { useState, useEffect, useRef } from 'react';
import { Timeline } from './components/Timeline';
import { InsightPanel } from './components/InsightPanel';
import { ChatInterface } from './components/ChatInterface';
import { processMedicalRecord, generateMedicalInsights, askMedicalQuestion } from './services/medicalService';
import { FHIRResource, Insight, ChatMessage } from './types';
import { 
  ShieldCheck, BrainCircuit, HeartPulse, Menu, X, PlusCircle, 
  FileSearch, Sparkles, ChevronDown, Download, 
  Trash2, Database, Loader2, User, Paperclip, Image as ImageIcon
} from 'lucide-react';

interface FilePreview {
  id: string;
  file: File;
  base64: string;
  type: string;
}

const App: React.FC = () => {
  const [patients, setPatients] = useState([{ id: '1', name: '张建国', tag: '慢性高血压' }]);
  const [activePatientId, setActivePatientId] = useState<string | null>('1');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [history, setHistory] = useState<FHIRResource[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [currentReport, setCurrentReport] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  
  // 附件管理
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePatient = patients.find(p => p.id === activePatientId);

  // 图片压缩逻辑
  const compressImage = (file: File): Promise<{ base64: string, type: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1200; 
          if (width > height && width > maxDim) { height *= maxDim / width; width = maxDim; }
          else if (height > maxDim) { width *= maxDim / height; height = maxDim; }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          resolve({ base64: compressed.split(',')[1], type: 'image/jpeg' });
        };
      };
      reader.onerror = reject;
    });
  };

  // Fixed TypeScript errors by casting the FileList to File[] to prevent 'unknown' type inference
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const newPreviews: FilePreview[] = [];
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const { base64 } = await compressImage(file);
        newPreviews.push({ id: Math.random().toString(), file, base64, type: file.type });
      }
    }
    setPreviews(prev => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePreview = (id: string) => setPreviews(prev => prev.filter(p => p.id !== id));

  const startAnalysis = async () => {
    if (previews.length === 0) return;
    setIsParsing(true);
    try {
      const payload = previews.map(p => ({ data: p.base64, mimeType: 'image/jpeg' }));
      const { report, resources } = await processMedicalRecord(payload);
      
      setCurrentReport(prev => prev ? prev + "\n\n" + report : report);
      const newHistory = [...history, ...resources];
      setHistory(newHistory);
      setPreviews([]);
      
      const newInsights = await generateMedicalInsights(newHistory);
      setInsights(newInsights);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsChatting(true);
    try {
      const context = `当前报告: ${currentReport}\n已识别节点: ${JSON.stringify(history)}`;
      const reply = await askMedicalQuestion(text, context);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: reply, timestamp: Date.now() }]);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden select-text">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-[#1e293b] text-white flex flex-col z-20`}>
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HeartPulse className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-black tracking-tight">健数智合</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="mb-6">
             <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">临床时间轴</div>
             <Timeline 
               data={history} 
               selectedIds={[]} 
               onToggleSelect={() => {}} 
               onSelect={() => {}} 
             />
          </div>
        </div>

        <div className="p-6 bg-slate-900">
           <button 
             onClick={() => fileInputRef.current?.click()}
             className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
           >
             <PlusCircle className="w-5 h-5" />
             导入病历资料
           </button>
           <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*" className="hidden" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg"><Menu className="w-5 h-5"/></button>}
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">隐私安全空间</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
             <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">{activePatient?.name[0]}</div>
             <span className="text-sm font-bold text-slate-700">{activePatient?.name}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-8">
            {/* 上传预览区 */}
            {previews.length > 0 && (
              <section className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-500" />
                    待处理附件 ({previews.length})
                  </h3>
                  <button 
                    onClick={startAnalysis} 
                    disabled={isParsing}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isParsing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                    开始临床解析
                  </button>
                </div>
                <div className="flex flex-wrap gap-4">
                  {previews.map(p => (
                    <div key={p.id} className="relative group">
                      <img src={`data:image/jpeg;base64,${p.base64}`} className="w-20 h-20 object-cover rounded-xl border border-slate-200" />
                      <button onClick={() => removePreview(p.id)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm min-h-[500px] flex flex-col">
              <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <FileSearch className="w-5 h-5 text-blue-600" />
                  <h2 className="font-bold text-slate-800">多维度标准化报告</h2>
                </div>
                {currentReport && <button className="p-2 hover:bg-white rounded-lg border border-slate-200"><Download className="w-4 h-4"/></button>}
              </div>
              <div className="p-8 prose prose-slate max-w-none flex-1">
                {currentReport ? (
                  <div className="whitespace-pre-wrap text-slate-700 leading-relaxed select-text">{currentReport}</div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 py-32">
                    <Database className="w-16 h-16 mb-4 opacity-10" />
                    <p className="font-bold text-[10px] uppercase tracking-widest">请从侧边栏导入临床资料</p>
                  </div>
                )}
              </div>
            </section>
            
            <InsightPanel insights={insights} loading={false} />
          </div>

          <div className="w-full lg:w-[400px] shrink-0 h-fit sticky top-8">
            <ChatInterface messages={messages} onSendMessage={handleSendMessage} isTyping={isChatting} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;

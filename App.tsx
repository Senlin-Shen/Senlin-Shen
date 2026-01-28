
import React, { useState, useEffect, useRef } from 'react';
import { Timeline } from './components/Timeline';
import { InsightPanel } from './components/InsightPanel';
import { ChatInterface } from './components/ChatInterface';
import { processMedicalRecord, generateMedicalInsights, askMedicalQuestion } from './services/medicalService';
import { FHIRResource, Insight, ChatMessage } from './types';
import { 
  ShieldCheck, BrainCircuit, HeartPulse, Menu, X, PlusCircle, 
  FileSearch, Sparkles, ChevronDown, Download, 
  Trash2, Database, Loader2, User, Paperclip, Image as ImageIcon,
  AlertCircle
} from 'lucide-react';

interface FilePreview {
  id: string;
  file: File;
  base64: string;
  type: string;
}

const App: React.FC = () => {
  const [patients] = useState([{ id: '1', name: '张建国', tag: '慢性高血压' }]);
  const [activePatientId] = useState<string | null>('1');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [history, setHistory] = useState<FHIRResource[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [currentReport, setCurrentReport] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePatient = patients.find(p => p.id === activePatientId);

  // 前端 Canvas 动态压缩 (1.5MB 目标)
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
          
          // 初始质量 0.8，如果还是太大则进一步降低质量
          let quality = 0.8;
          let base64 = canvas.toDataURL('image/jpeg', quality);
          
          // 1.5MB 约为 2,000,000 字符的 base64
          while (base64.length > 2000000 && quality > 0.3) {
            quality -= 0.1;
            base64 = canvas.toDataURL('image/jpeg', quality);
          }
          
          resolve({ base64: base64.split(',')[1], type: 'image/jpeg' });
        };
      };
      reader.onerror = reject;
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setErrorMessage(null);
    const newPreviews: FilePreview[] = [];
    for (const file of files) {
      try {
        if (file.type.startsWith('image/')) {
          const { base64 } = await compressImage(file);
          newPreviews.push({ id: Math.random().toString(36).substring(7), file, base64, type: 'image/jpeg' });
        } else {
          setErrorMessage("目前仅支持图片格式 (JPG/PNG/WEBP) 的病历解析。");
        }
      } catch (err) {
        setErrorMessage("图片处理失败，请重试。");
      }
    }
    setPreviews(prev => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePreview = (id: string) => setPreviews(prev => prev.filter(p => p.id !== id));

  const startAnalysis = async () => {
    if (previews.length === 0) return;
    setIsParsing(true);
    setErrorMessage(null);
    try {
      const payload = previews.map(p => ({ data: p.base64, mimeType: p.type }));
      const { report, resources } = await processMedicalRecord(payload);
      
      setCurrentReport(prev => prev ? prev + "\n\n---\n\n" + report : report);
      setHistory(prev => [...prev, ...resources]);
      setPreviews([]);
      
      const newInsights = await generateMedicalInsights([...history, ...resources]);
      setInsights(newInsights);
    } catch (err: any) {
      setErrorMessage(err.message || "请求失败，请检查 API 配置或网络。");
    } finally {
      setIsParsing(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsChatting(true);
    setErrorMessage(null);

    try {
      const context = `当前报告内容: ${currentReport}\n已识别时间轴: ${JSON.stringify(history)}`;
      const reply = await askMedicalQuestion(text, context);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: reply, timestamp: Date.now() }]);
    } catch (err: any) {
      setErrorMessage(`对话出错: ${err.message}`);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden select-text">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-[#1e293b] text-white flex flex-col z-20 shadow-xl`}>
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HeartPulse className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-black tracking-tight">健数智合</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="mb-6">
             <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 px-2">临床时间轴</div>
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
             className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
           >
             <PlusCircle className="w-5 h-5" />
             导入病历资料
           </button>
           <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*" className="hidden" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Error Alert Overlay */}
        {errorMessage && (
          <div className="absolute top-20 right-8 left-8 lg:left-auto lg:w-96 z-50 animate-in slide-in-from-top-4 duration-300">
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl shadow-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div className="text-sm">
                <p className="font-bold">操作失败</p>
                <p className="opacity-80">{errorMessage}</p>
              </div>
              <button onClick={() => setErrorMessage(null)} className="ml-auto p-1 hover:bg-red-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <header className="h-16 bg-white border-b flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg"><Menu className="w-5 h-5 text-slate-600"/></button>}
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">豆包临床引擎·隐私空间</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
             <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">{activePatient?.name[0]}</div>
             <span className="text-sm font-bold text-slate-700">{activePatient?.name}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 flex flex-col lg:flex-row gap-8 custom-scrollbar">
          <div className="flex-1 space-y-8 max-w-4xl">
            {/* 上传预览区 */}
            {previews.length > 0 && (
              <section className="bg-white p-6 rounded-3xl border-2 border-blue-500/20 shadow-xl shadow-blue-500/5 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-500" />
                    待解析附件 ({previews.length})
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={() => setPreviews([])} className="px-4 py-2 text-slate-400 hover:text-red-500 text-sm font-bold">清空</button>
                    <button 
                      onClick={startAnalysis} 
                      disabled={isParsing}
                      className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20"
                    >
                      {isParsing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                      {isParsing ? '解析中...' : '开始结构化分析'}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  {previews.map(p => (
                    <div key={p.id} className="relative group">
                      <img src={`data:image/jpeg;base64,${p.base64}`} className="w-24 h-24 object-cover rounded-xl border-2 border-slate-100 shadow-sm" />
                      <button onClick={() => removePreview(p.id)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm min-h-[500px] flex flex-col overflow-hidden">
              <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <FileSearch className="w-5 h-5 text-blue-600" />
                  </div>
                  <h2 className="font-bold text-slate-800">标准化临床报告</h2>
                </div>
                {currentReport && <button className="p-2 hover:bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-blue-600"><Download className="w-4 h-4"/></button>}
              </div>
              <div className="p-10 prose prose-slate max-w-none flex-1 selection:bg-blue-100">
                {currentReport ? (
                  <div className="whitespace-pre-wrap text-slate-700 leading-relaxed select-text font-medium">{currentReport}</div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 py-32">
                    <Database className="w-20 h-20 mb-6 opacity-5 animate-pulse" />
                    <p className="font-bold text-xs uppercase tracking-[0.2em] text-slate-400">等待临床数据导入...</p>
                    <p className="text-[10px] mt-2 opacity-60">点击侧边栏导入或直接拖拽图片到此区域</p>
                  </div>
                )}
              </div>
            </section>
            
            <InsightPanel insights={insights} loading={false} />
          </div>

          <div className="w-full lg:w-[420px] shrink-0 h-fit sticky top-8">
            <ChatInterface messages={messages} onSendMessage={handleSendMessage} isTyping={isChatting} />
            <div className="mt-4 p-4 bg-slate-100/50 rounded-2xl border border-slate-200">
               <div className="text-[10px] font-black text-slate-400 uppercase mb-2">模型状态</div>
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                 <span className="text-[11px] font-bold text-slate-600 tracking-tighter uppercase">Ark Pro - Stable Connectivity</span>
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;

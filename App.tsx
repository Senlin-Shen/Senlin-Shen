
import React, { useState, useRef } from 'react';
import { Timeline } from './components/Timeline';
import { InsightPanel } from './components/InsightPanel';
import { ChatInterface } from './components/ChatInterface';
import { processMedicalRecordStream, askMedicalQuestionStream, generateMedicalInsights, extractResourcesFromText } from './services/medicalService';
import { FHIRResource, Insight, ChatMessage } from './types';
import { 
  ShieldCheck, HeartPulse, Menu, X, PlusCircle, 
  FileSearch, Sparkles, Download, 
  Database, Loader2, Paperclip, AlertCircle
} from 'lucide-react';

interface FilePreview {
  id: string;
  base64: string;
  type: string;
}

const App: React.FC = () => {
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

  // 1200px 限制 + 0.7 质量压缩，确保单图不超 Vercel 限制
  const compressImage = (file: File): Promise<FilePreview> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const max = 1200;
          if (width > height && width > max) { height *= max / width; width = max; }
          else if (height > max) { width *= max / height; height = max; }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', 0.7);
          resolve({ id: Math.random().toString(36).substring(7), base64: base64.split(',')[1], type: 'image/jpeg' });
        };
      };
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setErrorMessage(null);
    const compressed = await Promise.all(files.map(compressImage));
    setPreviews(prev => [...prev, ...compressed]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startAnalysis = async () => {
    if (previews.length === 0) return;
    setIsParsing(true);
    setErrorMessage(null);
    setCurrentReport(""); // 清空旧报告，准备接收流

    try {
      const payload = previews.map(p => ({ data: p.base64, mimeType: p.type }));
      const fullText = await processMedicalRecordStream(payload, (chunk) => {
        setCurrentReport(prev => prev + chunk);
      });
      
      const resources = extractResourcesFromText(fullText);
      setHistory(prev => [...prev, ...resources]);
      setPreviews([]);
      
      const newInsights = await generateMedicalInsights([...history, ...resources]);
      setInsights(newInsights);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsChatting(true);
    
    const botId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: botId, role: 'assistant', content: "", timestamp: Date.now() }]);

    try {
      const context = `报告: ${currentReport}\n历史: ${JSON.stringify(history)}`;
      await askMedicalQuestionStream(text, context, (chunk) => {
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: m.content + chunk } : m));
      });
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden select-text text-slate-900">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-[#1e293b] text-white flex flex-col z-20 shadow-xl overflow-hidden`}>
        <div className="p-6 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <HeartPulse className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-black tracking-tight whitespace-nowrap">健数智合</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
           <Timeline data={history} selectedIds={[]} onToggleSelect={() => {}} onSelect={() => {}} />
        </div>

        <div className="p-6 bg-slate-900 border-t border-slate-700">
           <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all">
             <PlusCircle className="w-5 h-5" /> 导入化验单
           </button>
           <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*" className="hidden" />
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative selection:bg-blue-100 selection:text-blue-900">
        {errorMessage && (
          <div className="absolute top-20 right-8 left-8 lg:left-auto lg:w-96 z-50 animate-in slide-in-from-top-4">
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl shadow-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div className="text-sm">
                <p className="font-bold">引擎异常</p>
                <p className="opacity-80 break-all">{errorMessage}</p>
              </div>
              <button onClick={() => setErrorMessage(null)} className="ml-auto p-1"><X className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        <header className="h-16 bg-white border-b flex items-center justify-between px-8 shrink-0 z-10">
          <div className="flex items-center gap-4">
            {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg"><Menu className="w-5 h-5"/></button>}
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 font-bold text-[10px] uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4" /> 豆包 Ark 流式处理中
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 flex flex-col lg:flex-row gap-8 custom-scrollbar">
          <div className="flex-1 space-y-8 max-w-4xl">
            {previews.length > 0 && (
              <section className="bg-white p-6 rounded-3xl border-2 border-blue-500/20 shadow-xl animate-in zoom-in-95">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-500" /> 待解析附件 ({previews.length})
                  </h3>
                  <button onClick={startAnalysis} disabled={isParsing} className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50">
                    {isParsing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                    {isParsing ? '解析中...' : '开始流式分析'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-4">
                  {previews.map(p => (
                    <div key={p.id} className="relative group">
                      <img src={`data:image/jpeg;base64,${p.base64}`} className="w-20 h-20 object-cover rounded-xl border-2 border-slate-100" />
                      <button onClick={() => setPreviews(prev => prev.filter(x => x.id !== p.id))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3"/></button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm min-h-[500px] flex flex-col">
              <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg"><FileSearch className="w-5 h-5 text-blue-600" /></div>
                  <h2 className="font-bold text-slate-800">流式临床报告</h2>
                </div>
                {isParsing && <div className="h-1 w-24 bg-blue-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600 animate-[loading_2s_infinite]"></div></div>}
              </div>
              <div className="p-10 prose prose-slate max-w-none flex-1">
                {currentReport ? (
                  <div className="whitespace-pre-wrap text-slate-700 leading-relaxed select-text font-medium">{currentReport}</div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 py-32">
                    <Database className="w-20 h-20 mb-6 opacity-5" />
                    <p className="font-bold text-xs tracking-[0.2em] text-slate-400">等待临床数据导入...</p>
                  </div>
                )}
              </div>
            </section>
            
            <InsightPanel insights={insights} loading={false} />
          </div>

          <div className="w-full lg:w-[420px] shrink-0 h-fit sticky top-8">
            <ChatInterface messages={messages} onSendMessage={handleSendMessage} isTyping={isChatting} />
          </div>
        </div>
      </main>
      <style>{`
        @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      `}</style>
    </div>
  );
};

export default App;

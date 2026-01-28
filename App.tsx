
import React, { useState, useEffect, useRef } from 'react';
import { Timeline } from './components/Timeline';
import { InsightPanel } from './components/InsightPanel';
import { ChatInterface } from './components/ChatInterface';
import { processMedicalRecord, generateMedicalInsights, askMedicalQuestion } from './services/medicalService';
import { FHIRResource, Insight, ChatMessage } from './types';
import { 
  ShieldCheck, BrainCircuit, HeartPulse, Menu, X, PlusCircle, 
  FileSearch, Sparkles, ChevronDown, Download, 
  Trash2, CheckSquare, Square, Fingerprint, 
  Database, BarChart3, Stethoscope, Loader2, User
} from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  age?: string;
  gender?: string;
  tag?: string;
}

const App: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([
    { id: '1', name: '张建国', age: '65', gender: '男', tag: '慢性高血压' },
    { id: '2', name: '李晓华', age: '42', gender: '女', tag: '术后康复' }
  ]);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [showPatientSelector, setShowPatientSelector] = useState(false);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  
  const [history, setHistory] = useState<FHIRResource[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [currentReport, setCurrentReport] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [isParsing, setIsParsing] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePatient = patients.find(p => p.id === activePatientId);

  useEffect(() => {
    if (!activePatientId) {
      setMessages([{ 
        id: 'init', 
        role: 'assistant', 
        content: "欢迎使用「健数智合」。我是您的 AI 医疗数据助理。平台已接入 Gemini 3 Pro 临床大模型，支持解析门诊、住院、检验等全量病历。请上传资料开始自动化建档。", 
        timestamp: Date.now() 
      }]);
    }
  }, [activePatientId]);

  const compressImage = (file: File): Promise<string> => {
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
          const maxDim = 1600; 
          
          if (width > height && width > maxDim) {
            height = (height * maxDim) / width;
            width = maxDim;
          } else if (height > maxDim) {
            width = (width * maxDim) / height;
            height = maxDim;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
        };
        img.onerror = () => reject(new Error("图片加载失败"));
      };
      reader.onerror = () => reject(new Error("文件读取失败"));
    });
  };

  // Fix: Corrected handleFileUpload to handle File typing and complete truncated logic
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsParsing(true);
    // FIX: Cast to File[] to solve the "unknown" type error in lines 99, 100, 102
    const fileList = Array.from(files) as File[];
    
    try {
      for (const file of fileList) {
        if (file.type.startsWith('image/')) {
          const compressedBase64 = await compressImage(file);
          const { report, resources } = await processMedicalRecord({ data: compressedBase64, mimeType: 'image/jpeg' });
          setCurrentReport(prev => prev + "\n\n" + report);
          setHistory(prev => [...prev, ...resources]);
        }
      }
      
      // Update insights after batch processing
      setIsReasoning(true);
      const newInsights = await generateMedicalInsights(history);
      setInsights(newInsights);
      setIsReasoning(false);

    } catch (err: any) {
      console.error("Upload Error:", err);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsChatting(true);

    try {
      const context = `Current Patient Report: ${currentReport}\nExtracted Insights: ${JSON.stringify(insights)}`;
      const reply = await askMedicalQuestion(text, context);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-white border-r border-slate-200 flex flex-col z-20`}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
              <HeartPulse className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tighter text-slate-800">健数智合</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="px-2 py-4">
            <button 
              onClick={() => setShowPatientSelector(!showPatientSelector)}
              className="w-full flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-400 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                  {activePatient ? activePatient.name[0] : <User className="w-4 h-4" />}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-800">{activePatient?.name || '选择患者'}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest">{activePatient?.tag || '待同步'}</div>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showPatientSelector ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className="px-2 pb-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">时间轴追溯</h3>
            <Timeline 
              data={history} 
              selectedIds={selectedResourceIds}
              onToggleSelect={(id) => setSelectedResourceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
              onSelect={() => {}} 
            />
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-100">
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
          >
            {isParsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
            {isParsing ? '正在识别' : '导入影像/报告'}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            multiple 
            accept="image/*" 
            className="hidden" 
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg mr-2">
                <Menu className="w-5 h-5 text-slate-600" />
              </button>
            )}
            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full border border-green-100">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">隐私安全已就绪</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                  U{i}
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 flex gap-8">
          {/* Analysis View */}
          <div className="flex-1 space-y-8">
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <FileSearch className="w-5 h-5 text-blue-600" />
                  </div>
                  <h2 className="font-black text-slate-800 tracking-tight">结构化临床报告</h2>
                </div>
                {currentReport && (
                  <button className="p-2 hover:bg-white rounded-lg text-slate-400 border border-transparent hover:border-slate-200 transition-all">
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="p-8 prose prose-slate max-w-none prose-headings:font-black prose-headings:tracking-tight prose-strong:text-blue-700">
                {currentReport ? (
                  <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-medium">
                    {currentReport}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                    <Database className="w-16 h-16 mb-4 opacity-10" />
                    <p className="font-bold uppercase tracking-widest text-[10px]">等待数据输入...</p>
                  </div>
                )}
              </div>
            </section>
            
            <InsightPanel insights={insights} loading={isReasoning} />
          </div>

          {/* Chat Sidepanel */}
          <div className="w-[400px] shrink-0 sticky top-0 h-fit">
            <ChatInterface 
              messages={messages} 
              onSendMessage={handleSendMessage} 
              isTyping={isChatting} 
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;

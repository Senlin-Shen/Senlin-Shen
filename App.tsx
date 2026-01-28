
import React, { useState, useEffect, useRef } from 'react';
import { Timeline } from './components/Timeline';
import { InsightPanel } from './components/InsightPanel';
import { ChatInterface } from './components/ChatInterface';
import { processMedicalRecord, generateMedicalInsights, askMedicalQuestion } from './services/medicalService';
import { FHIRResource, Insight, ChatMessage } from './types';
import { 
  ShieldCheck, BrainCircuit, HeartPulse, Menu, X, PlusCircle, 
  FileSearch, Sparkles, ChevronDown, Download, 
  Trash2, CheckSquare, Square, UserPlus, Fingerprint, 
  Database, BarChart3, Stethoscope, Loader2
} from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  age?: string;
  gender?: string;
  tag?: string;
}

const App: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
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
        content: "欢迎使用「健数智合」。我是您的 AI 医疗数据助理。平台已接入火山引擎豆包多模态大模型，支持解析门诊、住院、检验等全量病历。请上传资料开始自动化建档。", 
        timestamp: Date.now() 
      }]);
    }
  }, [activePatientId]);

  const handlePatientSwitch = (patientId: string) => {
    setActivePatientId(patientId);
    setShowPatientSelector(false);
  };

  const processFile = (file: File): Promise<{ report: string; resources: FHIRResource[] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');

      if (isPdf || isImage) {
        reader.onload = async () => {
          try {
            const base64 = (reader.result as string).split(',')[1];
            const result = await processMedicalRecord({ data: base64, mimeType: file.type });
            resolve(result);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsDataURL(file);
      } else {
        reader.onload = async () => {
          try {
            const text = reader.result as string;
            const result = await processMedicalRecord(undefined, text);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsText(file);
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsParsing(true);
    // Fix: Explicitly cast Array.from(files) to File[] to resolve 'unknown' type issues in TS
    const fileList = Array.from(files) as File[];
    
    try {
      // 串行或并行处理文件，这里采用串行以保证逻辑清晰
      let allNewResources: FHIRResource[] = [];
      let combinedReport = currentReport;

      for (const file of fileList) {
        try {
          // Fix: Now file is properly typed as File, satisfying the requirement for processFile
          const result = await processFile(file);
          allNewResources = [...allNewResources, ...result.resources];
          combinedReport = combinedReport ? `${combinedReport}\n\n--- 补充病历档案 ---\n\n${result.report}` : result.report;
          
          // 首次上传时自动创建患者档案
          if (!activePatientId) {
             const nameMatch = result.report.match(/(?:姓名|患者)[:：]\s*([^\s\n\r|]+)/);
             const extractedName = nameMatch ? nameMatch[1].trim() : "匿名就诊人_" + Math.floor(Math.random() * 1000);
             
             const newPatient: Patient = {
               id: Date.now().toString(),
               name: extractedName,
               tag: "多维度自动识别"
             };
             setPatients([newPatient]);
             setActivePatientId(newPatient.id);
             
             setMessages(prev => [...prev, { 
               id: Date.now().toString(), 
               role: 'assistant', 
               content: `「健数智合」已识别到新就诊人：${extractedName}。系统正在同步解析您的多份病历资料并构建临床时间轴。`, 
               timestamp: Date.now() 
             }]);
          }
        } catch (fileErr) {
          // Fix: Now file is typed as File, so .name property is accessible without errors
          console.error(`处理文件 ${file.name} 失败:`, fileErr);
        }
      }

      setCurrentReport(combinedReport);
      if (allNewResources.length > 0) {
        const updatedHistory = [...history, ...allNewResources];
        setHistory(updatedHistory);
        refreshInsights(updatedHistory);
      }

    } catch (err: any) {
      alert(`解析失败: ${err.message}`);
    } finally {
      setIsParsing(false);
      // 清空 input 状态，允许重复上传相同文件
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const refreshInsights = async (currentHistory: FHIRResource[]) => {
    setIsReasoning(true);
    try {
      const newInsights = await generateMedicalInsights(currentHistory);
      setInsights(newInsights);
    } finally {
      setIsReasoning(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedResourceIds.length === history.length) {
      setSelectedResourceIds([]);
    } else {
      setSelectedResourceIds(history.map(h => h.id));
    }
  };

  const handleSendMessage = async (text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() }]);
    setIsChatting(true);
    try {
      const response = await askMedicalQuestion(text, currentReport || JSON.stringify(history));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: response, timestamp: Date.now() }]);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      <aside className={`bg-[#1e293b] text-slate-300 transition-all duration-300 flex flex-col shadow-2xl ${sidebarOpen ? 'w-80' : 'w-0'}`}>
        <div className="p-5 border-b border-slate-700/50 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 font-bold text-blue-400">
              <Database className="w-5 h-5" />
              <span className="tracking-widest uppercase text-xs text-blue-400">临床记忆时间轴</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 hover:bg-slate-700 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>

          {history.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <button 
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400 hover:text-white transition-colors"
              >
                {selectedResourceIds.length === history.length ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                全选 ({selectedResourceIds.length})
              </button>
              {selectedResourceIds.length > 0 && (
                <button onClick={() => { setHistory([]); setSelectedResourceIds([]); }} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-900/50">
          <Timeline 
            data={history} 
            selectedIds={selectedResourceIds}
            onToggleSelect={(id) => setSelectedResourceIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
            onSelect={() => {}} 
          />
        </div>

        <div className="p-5 border-t border-slate-700 bg-slate-900">
          <label className={`flex items-center justify-center gap-3 w-full py-4 rounded-xl transition-all shadow-xl active:scale-95 group cursor-pointer ${isParsing ? 'bg-slate-700 pointer-events-none' : 'bg-blue-600 hover:bg-blue-500'}`}>
            {isParsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform" />}
            <span className="font-bold text-sm">{isParsing ? '处理资料中...' : '导入病历资料'}</span>
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              accept="image/*,application/pdf,.txt,.docx" 
              onChange={handleFileUpload} 
              disabled={isParsing} 
              multiple 
            />
          </label>
          <div className="grid grid-cols-3 gap-2 mt-4">
             <div className="flex flex-col items-center gap-1 opacity-50">
               <Stethoscope className="w-4 h-4" />
               <span className="text-[8px] uppercase">临床视角</span>
             </div>
             <div className="flex flex-col items-center gap-1 opacity-50">
               <BarChart3 className="w-4 h-4" />
               <span className="text-[8px] uppercase">统计专家</span>
             </div>
             <div className="flex flex-col items-center gap-1 opacity-50">
               <HeartPulse className="w-4 h-4" />
               <span className="text-[8px] uppercase">营养指引</span>
             </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm no-print">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-xl">
                <Menu className="w-5 h-5 text-slate-600" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-1.5 rounded-lg shadow-inner">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tighter text-slate-800 leading-none">健数智合</h1>
                <p className="text-[9px] font-bold text-blue-500 uppercase mt-1 tracking-widest">Digital Health Integration</p>
              </div>
            </div>
          </div>

          <div className="relative">
            {activePatient ? (
              <button 
                onClick={() => setShowPatientSelector(!showPatientSelector)}
                className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white transition-all shadow-sm"
              >
                <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-xs">
                  {activePatient.name.substring(0, 1)}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">当前档案</div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-black text-slate-800">{activePatient.name}</span>
                    <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showPatientSelector ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-2 text-slate-400 text-xs px-4">
                <Fingerprint className="w-4 h-4" />
                <span>等待临床数据输入...</span>
              </div>
            )}

            {showPatientSelector && (
              <div className="absolute right-0 mt-3 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50">
                {patients.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => handlePatientSwitch(p.id)}
                    className={`w-full text-left p-3 rounded-xl transition-colors ${p.id === activePatientId ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <div className="font-bold text-sm">{p.name}</div>
                    <div className="text-[10px] opacity-60 uppercase">{p.tag}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto custom-scrollbar">
          <div className="lg:col-span-8 space-y-6">
            <section className="report-card rounded-2xl overflow-hidden flex flex-col min-h-[700px] transition-all relative">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 no-print">
                <div className="flex items-center gap-3">
                  <FileSearch className="w-5 h-5 text-blue-600" />
                  <h2 className="text-sm font-bold text-slate-700">多维度标准化报告</h2>
                </div>
                <div className="flex items-center gap-2">
                  {currentReport && (
                    <button onClick={() => window.print()} className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200" title="打印/导出 PDF">
                      <Download className="w-4 h-4 text-slate-600" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
                {currentReport ? (
                  <article className="prose prose-slate max-w-none whitespace-pre-wrap text-slate-700 leading-relaxed">
                    {currentReport}
                  </article>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-32 no-print">
                    <Sparkles className="w-12 h-12 mb-6 text-blue-100 animate-pulse" />
                    <p className="text-sm font-bold text-slate-600">等待导入临床资料</p>
                    <p className="text-[10px] mt-2 max-w-[240px] text-center opacity-60 leading-relaxed font-medium">
                      支持多文件选择。导入后，「健数智合」将自动从临床、统计、营养三个专业视角完成数据的标准化拆解。
                    </p>
                  </div>
                )}
              </div>
              
              {isParsing && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 no-print animate-in fade-in duration-300">
                   <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                   <p className="mt-4 text-sm font-black text-blue-600 uppercase tracking-widest">豆包临床引擎正在深度整合中...</p>
                   <p className="text-[10px] text-slate-400 mt-2">支持多模态全量病历识别</p>
                </div>
              )}
            </section>
            
            <div className="no-print">
                <InsightPanel insights={insights} loading={isReasoning} />
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col space-y-6 no-print">
            <ChatInterface 
              messages={messages} 
              onSendMessage={handleSendMessage} 
              isTyping={isChatting} 
            />
            
            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">数据隐私与合规性</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed italic relative z-10">
                “健数智合”遵循临床数据处理规范。所有解析过程均在火山引擎专有加密空间中完成。模型识别逻辑针对临床主任、统计学家视角进行深度对齐，不存储原始影像。
              </p>
              <Database className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-50 opacity-[0.03]" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;

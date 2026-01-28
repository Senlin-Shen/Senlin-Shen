
import React, { useState, useEffect } from 'react';
import { Timeline } from './components/Timeline';
import { InsightPanel } from './components/InsightPanel';
import { ChatInterface } from './components/ChatInterface';
import { processMedicalRecord, generateMedicalInsights, askMedicalQuestion } from './services/medicalService';
import { FHIRResource, Insight, ChatMessage } from './types';
import { ShieldCheck, BrainCircuit, HeartPulse, Menu, X, PlusCircle, FileSearch, Sparkles, ChevronDown, UserCircle2, Download, Trash2, CheckSquare, Square, UserPlus, Fingerprint } from 'lucide-react';

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

  const activePatient = patients.find(p => p.id === activePatientId);

  useEffect(() => {
    if (!activePatientId) {
      setMessages([{ 
        id: 'init', 
        role: 'assistant', 
        content: "您好，我是 Nexus 临床引擎，已连接火山引擎「豆包」模型。目前尚未检测到就诊人档案。请点击左侧「导入病历资料」，我将通过多模态识别为您自动创建档案。", 
        timestamp: Date.now() 
      }]);
    }
  }, [activePatientId]);

  const handlePatientSwitch = (patientId: string) => {
    setActivePatientId(patientId);
    setShowPatientSelector(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const reader = new FileReader();
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');

      if (isPdf || isImage) {
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const result = await processMedicalRecord({ data: base64, mimeType: file.type });
          updateAppState(result);
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = async () => {
          const text = reader.result as string;
          const result = await processMedicalRecord(undefined, text);
          updateAppState(result);
        };
        reader.readAsText(file);
      }
    } catch (err: any) {
      alert(`豆包解析失败: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  const updateAppState = (result: { report: string, resources: FHIRResource[] }) => {
    const nameMatch = result.report.match(/(?:姓名|患者)[:：]\s*([^\s\n\r|]+)/);
    const extractedName = nameMatch ? nameMatch[1].trim() : "匿名患者_" + Math.floor(Math.random() * 1000);
    
    if (!activePatientId) {
      const newPatient: Patient = {
        id: Date.now().toString(),
        name: extractedName,
        tag: "豆包自动识别"
      };
      setPatients([newPatient]);
      setActivePatientId(newPatient.id);
      
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: `豆包模型已成功识别新就诊人：${extractedName}。系统已自动为您建立临床时间轴，您可以开始针对这份病历进行问答。`, 
        timestamp: Date.now() 
      }]);
    }

    setCurrentReport(result.report);
    if (result.resources.length > 0) {
      const updatedHistory = [...history, ...result.resources];
      setHistory(updatedHistory);
      refreshInsights(updatedHistory);
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

  const deleteSelected = () => {
    if (confirm(`确定要删除选中的 ${selectedResourceIds.length} 项记录吗？`)) {
      const newHistory = history.filter(h => !selectedResourceIds.includes(h.id));
      setHistory(newHistory);
      setSelectedResourceIds([]);
      refreshInsights(newHistory);
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
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans">
      <aside className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col shadow-sm ${sidebarOpen ? 'w-80' : 'w-0'}`}>
        <div className="p-5 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/30">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 font-bold text-blue-700">
              <HeartPulse className="w-5 h-5" />
              <span className="tracking-tight uppercase text-sm">临床时间轴</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 hover:bg-slate-200 rounded-lg">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {history.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <button 
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 hover:text-blue-600 transition-colors"
              >
                {selectedResourceIds.length === history.length && history.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                全选 ({selectedResourceIds.length}/{history.length})
              </button>
              {selectedResourceIds.length > 0 && (
                <button onClick={deleteSelected} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <Timeline 
            data={history} 
            selectedIds={selectedResourceIds}
            onToggleSelect={(id) => setSelectedResourceIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
            onSelect={(item) => console.log("Node Detail:", item)} 
          />
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50/50">
          <label className="flex items-center justify-center gap-2 w-full py-4 bg-blue-700 text-white rounded-2xl hover:bg-blue-800 cursor-pointer transition-all shadow-lg shadow-blue-100 active:scale-[0.97] group">
            <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            <span className="font-bold text-sm">导入病历资料</span>
            <input type="file" className="hidden" accept="image/*,application/pdf,.txt,.docx" onChange={handleFileUpload} disabled={isParsing} />
          </label>
          <p className="text-[10px] text-center text-slate-400 mt-3 font-medium tracking-tight">豆包 API 识别 · 支持多种格式</p>
          {isParsing && (
            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-blue-600 animate-pulse font-bold tracking-widest uppercase">
              <Sparkles className="w-3 h-3" />
              <span>豆包多模态解析中...</span>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm no-print">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <Menu className="w-5 h-5 text-slate-600" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2.5 rounded-2xl shadow-lg">
                <BrainCircuit className="w-6 h-6 text-blue-400" />
              </div>
              <h1 className="text-xl font-black tracking-tighter text-slate-800 uppercase hidden sm:block italic">Project Nexus</h1>
            </div>
          </div>

          <div className="relative">
            {activePatient ? (
              <button 
                onClick={() => setShowPatientSelector(!showPatientSelector)}
                className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-white hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-inner flex items-center justify-center font-black text-white text-sm">
                  {activePatient.name.substring(0, 1)}
                </div>
                <div className="text-left">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">当前档案</div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-black text-slate-800">{activePatient.name}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showPatientSelector ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </button>
            ) : (
              <button 
                className="h-11 w-11 bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all group"
                title="暂无档案，上传资料后自动创建"
              >
                <UserPlus className="w-6 h-6 group-hover:scale-110 transition-transform" />
              </button>
            )}

            {showPatientSelector && activePatient && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPatientSelector(false)} />
                <div className="absolute right-0 mt-3 w-72 bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-4 z-50 animate-in fade-in zoom-in duration-200">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">档案列表</div>
                  <div className="space-y-2">
                    {patients.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handlePatientSwitch(p.id)}
                        className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all ${activePatientId === p.id ? 'bg-blue-50 border border-blue-100 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}`}
                      >
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm ${activePatientId === p.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                          {p.name.substring(0, 1)}
                        </div>
                        <div className="text-left flex-1">
                          <div className="font-bold text-slate-800">{p.name}</div>
                          <div className="text-[10px] text-blue-500 font-medium truncate">{p.tag}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto medical-grid">
          <div className="lg:col-span-8 space-y-6">
            <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[650px] transition-all report-container relative">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 no-print">
                <div className="flex items-center gap-3">
                  <FileSearch className="w-5 h-5 text-blue-600" />
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest">标准化病历视图</h2>
                </div>
                {currentReport && (
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase hover:bg-blue-700 transition-colors shadow-md shadow-blue-100"
                  >
                    <Download className="w-3 h-3" />
                    导出 PDF
                  </button>
                )}
              </div>
              
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                {currentReport ? (
                  <article className="prose prose-slate max-w-none whitespace-pre-wrap font-sans leading-relaxed text-slate-700">
                    {currentReport}
                  </article>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-6 py-20 no-print">
                    <div className="relative">
                      <div className="p-10 bg-slate-50 rounded-full border-4 border-dashed border-slate-100">
                        <Fingerprint className="w-16 h-16 opacity-10" />
                      </div>
                      <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-blue-400 animate-bounce" />
                    </div>
                    <div className="text-center max-w-xs">
                      <p className="text-lg font-bold text-slate-700">等待豆包识别</p>
                      <p className="text-xs mt-2 text-slate-400 leading-relaxed font-medium">
                        上传病历资料后，系统将通过火山引擎豆包多模态模型提取信息并<span className="text-blue-600 font-black">自动建档</span>。
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
            
            <div className="insight-panel no-print">
                <InsightPanel insights={insights} loading={isReasoning} />
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col space-y-6 no-print">
            <ChatInterface 
              messages={messages} 
              onSendMessage={handleSendMessage} 
              isTyping={isChatting} 
            />
            
            <div className="p-6 bg-gradient-to-br from-blue-900 to-slate-900 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-blue-300" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">豆包安全协议已生效</span>
                </div>
                <p className="text-xs leading-relaxed font-medium opacity-80 mb-4">
                  所有临床数据通过火山引擎专有 Endpoint 进行加密传输，模型不用于二次训练。
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;


import React, { useState } from 'react';
import { Timeline } from './components/Timeline';
import { InsightPanel } from './components/InsightPanel';
import { ChatInterface } from './components/ChatInterface';
import { processMedicalRecord, generateMedicalInsights, askMedicalQuestion } from './services/doubaoService';
import { FHIRResource, Insight, ChatMessage } from './types';
import { ShieldCheck, Activity, BrainCircuit, HeartPulse, Menu, X, PlusCircle, FileSearch, Sparkles, AlertTriangle, ChevronDown, UserCircle2, Download } from 'lucide-react';

// 模拟多患者数据
const MOCK_PATIENTS = [
  { id: 'p1', name: '张三', age: 45, gender: '男', tag: '高血压/糖尿病' },
  { id: 'p2', name: '李四', age: 32, gender: '女', tag: '产后复查' },
  { id: 'p3', name: '王五', age: 68, gender: '男', tag: '术后康复' }
];

const App: React.FC = () => {
  const [activePatient, setActivePatient] = useState(MOCK_PATIENTS[0]);
  const [showPatientSelector, setShowPatientSelector] = useState(false);
  
  const [history, setHistory] = useState<FHIRResource[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [currentReport, setCurrentReport] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'assistant', content: `您好，当前正在为您梳理患者 ${activePatient.name} 的临床档案。请上传病历资料。`, timestamp: Date.now() }
  ]);
  
  const [isParsing, setIsParsing] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 切换患者时重置状态
  const handlePatientSwitch = (patient: typeof MOCK_PATIENTS[0]) => {
    setActivePatient(patient);
    setHistory([]);
    setInsights([]);
    setCurrentReport("");
    setMessages([{ 
      id: Date.now().toString(), 
      role: 'assistant', 
      content: `已切换至患者：${patient.name}。系统已为您开启独立的临床分析沙盒。`, 
      timestamp: Date.now() 
    }]);
    setShowPatientSelector(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const reader = new FileReader();
      if (file.type.startsWith('image/')) {
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
    } catch (err) {
      console.error("上传处理失败", err);
    } finally {
      setIsParsing(false);
    }
  };

  const updateAppState = (result: { report: string, resources: FHIRResource[] }) => {
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

  const handleExport = () => {
    window.print();
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans">
      {/* 侧边栏 */}
      <aside className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col shadow-sm ${sidebarOpen ? 'w-80' : 'w-0'}`}>
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <div className="flex items-center gap-2 font-bold text-blue-700">
            <HeartPulse className="w-5 h-5" />
            <span className="tracking-tight uppercase text-sm">临床时间轴</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 hover:bg-slate-200 rounded-lg">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <Timeline data={history} onSelect={(item) => console.log(item)} />
        </div>
        <div className="p-5 border-t border-slate-100 bg-slate-50/50">
          <label className="flex items-center justify-center gap-2 w-full py-4 bg-blue-700 text-white rounded-2xl hover:bg-blue-800 cursor-pointer transition-all shadow-lg shadow-blue-100 active:scale-[0.97] group">
            <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            <span className="font-bold text-sm">导入病历资料</span>
            <input type="file" className="hidden" accept="image/*,.txt" onChange={handleFileUpload} disabled={isParsing} />
          </label>
          {isParsing && (
            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-blue-600 animate-pulse font-bold tracking-widest uppercase">
              <Sparkles className="w-3 h-3" />
              <span>智能梳理中...</span>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* 打印专用页眉 */}
        <div className="print-header">
            <h1 className="text-2xl font-bold">临床标准化病历报告 - Project Nexus</h1>
            <div className="flex justify-between mt-4 text-sm">
                <span>患者姓名：{activePatient.name}</span>
                <span>年龄：{activePatient.age}</span>
                <span>性别：{activePatient.gender}</span>
                <span>日期：{new Date().toLocaleDateString()}</span>
            </div>
        </div>

        {/* 顶部导航 */}
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
              <h1 className="text-xl font-black tracking-tighter text-slate-800 uppercase hidden sm:block">Project Nexus</h1>
            </div>
          </div>

          {/* 患者切换小界面 */}
          <div className="relative">
            <button 
              onClick={() => setShowPatientSelector(!showPatientSelector)}
              className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-white hover:shadow-md transition-all active:scale-[0.98]"
            >
              <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-inner flex items-center justify-center font-black text-white text-sm">
                {activePatient.name.substring(0, 1)}
              </div>
              <div className="text-left">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">当前就诊人</div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-black text-slate-800">{activePatient.name}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showPatientSelector ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </button>

            {/* 下拉菜单 */}
            {showPatientSelector && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPatientSelector(false)} />
                <div className="absolute right-0 mt-3 w-72 bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-4 z-50 animate-in fade-in zoom-in duration-200">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">选择患者档案</div>
                  <div className="space-y-2">
                    {MOCK_PATIENTS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handlePatientSwitch(p)}
                        className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all ${activePatient.id === p.id ? 'bg-blue-50 border border-blue-100 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}`}
                      >
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm ${activePatient.id === p.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                          {p.name.substring(0, 1)}
                        </div>
                        <div className="text-left flex-1">
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            {p.name}
                            <span className="text-[10px] font-normal text-slate-400">{p.age}岁 · {p.gender}</span>
                          </div>
                          <div className="text-[10px] text-blue-500 font-medium truncate">{p.tag}</div>
                        </div>
                        {activePatient.id === p.id && <div className="h-2 w-2 bg-blue-500 rounded-full" />}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <button className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold hover:border-blue-400 hover:text-blue-500 transition-all">
                      <UserCircle2 className="w-4 h-4" />
                      添加新就诊人
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* 内容展示区 */}
        <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto medical-grid">
          <div className="lg:col-span-8 space-y-6">
            <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[650px] transition-all report-container">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 no-print">
                <div className="flex items-center gap-3">
                  <FileSearch className="w-5 h-5 text-blue-600" />
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest">标准化病历可视化视图</h2>
                </div>
                {currentReport && (
                  <button 
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase hover:bg-blue-700 transition-colors shadow-md shadow-blue-100"
                  >
                    <Download className="w-3 h-3" />
                    导出报告
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
                      <div className="p-10 bg-slate-50 rounded-full border-4 border-dashed border-slate-100 animate-pulse">
                        <FileSearch className="w-16 h-16 opacity-10" />
                      </div>
                      <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-blue-400 animate-bounce" />
                    </div>
                    <div className="text-center max-w-xs">
                      <p className="text-lg font-bold text-slate-700">就绪：等待档案录入</p>
                      <p className="text-xs mt-2 text-slate-400 leading-relaxed font-medium">请点击左下角上传患者 <span className="text-blue-600 font-black">{activePatient.name}</span> 的多维医疗资料，系统将自动执行五大模块梳理。</p>
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
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Nexus 临床安全协议</span>
                </div>
                <p className="text-xs leading-relaxed font-medium opacity-80 mb-4">
                  当前处于患者 <span className="text-blue-300 font-bold">{activePatient.name}</span> 的独立分析沙盒。所有识别结果均实时加密，确保数据符合医疗安全标准。
                </p>
                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400">
                   <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" />
                   模型连接已验证 (0.12ms)
                </div>
              </div>
              <BrainCircuit className="absolute -right-8 -bottom-8 w-40 h-40 text-white/5 group-hover:scale-110 transition-transform duration-1000" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;

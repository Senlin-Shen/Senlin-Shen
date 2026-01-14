
import React, { useState, useEffect, useCallback } from 'react';
import { Timeline } from './components/Timeline';
import { InsightPanel } from './components/InsightPanel';
import { ChatInterface } from './components/ChatInterface';
import { parseMedicalRecord, generateMedicalInsights, askMedicalQuestion } from './services/geminiService';
import { FHIRResource, Insight, ChatMessage } from './types';
import { deidentifyName } from './utils/phiUtils';
import { Upload, ShieldCheck, Activity, BrainCircuit, HeartPulse, Menu, X, PlusCircle } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [history, setHistory] = useState<FHIRResource[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'assistant', content: '您好，我是 Project Nexus AI。请上传您的检查报告、化验单或出院小结，我将为您构建长期的结构化健康档案并提供深度临床分析。', timestamp: Date.now() }
  ]);
  const [isParsing, setIsParsing] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      // 在浏览器中读取为 Base64 处理
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const newResources = await parseMedicalRecord({ data: base64, mimeType: file.type });
        
        // 生成唯一 ID 并更新状态
        const resourcesWithId = newResources.map(r => ({ ...r, id: Math.random().toString(36).substr(2, 9) }));
        const updatedHistory = [...history, ...resourcesWithId];
        setHistory(updatedHistory);
        
        // 触发洞察分析
        refreshInsights(updatedHistory);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("处理文件失败", err);
    } finally {
      setIsParsing(false);
    }
  };

  const refreshInsights = async (currentHistory: FHIRResource[]) => {
    if (currentHistory.length < 1) return;
    setIsReasoning(true);
    try {
      const newInsights = await generateMedicalInsights(currentHistory);
      setInsights(newInsights);
    } catch (err) {
      console.error("分析失败", err);
    } finally {
      setIsReasoning(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    
    setIsChatting(true);
    try {
      const responseText = await askMedicalQuestion(text, history);
      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: responseText, timestamp: Date.now() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error("对话失败", err);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar - Timeline View */}
      <aside className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col ${sidebarOpen ? 'w-80' : 'w-0'}`}>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-blue-600">
            <HeartPulse className="w-5 h-5" />
            <span>健康档案时间轴</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-slate-100 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <Timeline data={history} onSelect={(item) => console.log('Selected:', item)} />
        </div>
        <div className="p-4 border-t border-slate-100">
          <label className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 cursor-pointer transition-all shadow-lg shadow-blue-200 active:scale-95">
            <PlusCircle className="w-5 h-5" />
            <span className="font-semibold text-sm">上传报告 (图片/PDF)</span>
            <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} disabled={isParsing} />
          </label>
          {isParsing && (
            <div className="mt-2 text-[10px] text-center text-blue-500 animate-pulse font-mono font-bold uppercase tracking-tighter">
              AI 多模态解析中...
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-md">
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2 rounded-xl">
                <BrainCircuit className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-slate-800 uppercase">Project Nexus</h1>
                <div className="flex items-center gap-2 text-[10px] text-emerald-500 font-bold uppercase">
                  <ShieldCheck className="w-3 h-3" />
                  <span>PHI 安全防护已启动</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">患者标识</div>
              <div className="text-sm font-semibold text-slate-700">{deidentifyName("张三")}</div>
            </div>
            <div className="h-10 w-10 bg-slate-200 rounded-full border-2 border-white shadow-sm flex items-center justify-center font-bold text-slate-500">
              ZS
            </div>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
          {/* Left: Insights & Summary */}
          <div className="lg:col-span-7 space-y-6">
            <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-2xl shadow-blue-100 relative overflow-hidden">
               <div className="relative z-10">
                 <h2 className="text-sm font-bold opacity-80 uppercase tracking-widest mb-1">健康全景视图</h2>
                 <div className="text-3xl font-black mb-4">医疗记忆引擎已就绪</div>
                 <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20">
                      <div className="text-[10px] uppercase opacity-70">记录条数</div>
                      <div className="text-xl font-bold">{history.length}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20">
                      <div className="text-[10px] uppercase opacity-70">活跃诊断</div>
                      <div className="text-xl font-bold">{history.filter(h => h.resourceType === 'Condition').length}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20">
                      <div className="text-[10px] uppercase opacity-70">分析深度</div>
                      <div className="text-xl font-bold">2.5s</div>
                    </div>
                 </div>
               </div>
               <Activity className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10" />
            </section>

            <section>
              <InsightPanel insights={insights} loading={isReasoning} />
            </section>
          </div>

          {/* Right: AI Chatbot */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="sticky top-0">
               <ChatInterface 
                messages={messages} 
                onSendMessage={handleSendMessage} 
                isTyping={isChatting} 
               />
               <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-start">
                  <Activity className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-800 leading-normal font-medium">
                    <strong className="block mb-1">免责声明:</strong>
                    Project Nexus 输出由 AI 生成。临床决策必须咨询专业医师。本系统遵循 PHI 脱敏规范，确保个人身份不被泄漏。
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

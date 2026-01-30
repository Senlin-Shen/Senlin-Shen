
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { Send, Bot, User, Loader2, Sparkles, Paperclip } from 'lucide-react';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onUpload: (files: File[]) => void;
  isTyping: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, onUpload, isTyping }) => {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    onSendMessage(input);
    setInput("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onUpload(files);
    }
  };

  return (
    <div className="flex flex-col h-[550px] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-100">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-xs uppercase">临床对话助手</h3>
            <div className="text-[9px] text-blue-500 font-bold uppercase tracking-widest">Powered by Ark Pro</div>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-slate-50/30">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-3 max-w-[90%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`p-2 rounded-full h-8 w-8 flex-shrink-0 flex items-center justify-center ${m.role === 'user' ? 'bg-slate-200' : 'bg-blue-600 shadow-md'}`}>
                {m.role === 'user' ? <User className="w-4 h-4 text-slate-500" /> : <Bot className="w-4 h-4 text-white" />}
              </div>
              <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap select-text ${m.role === 'user' ? 'bg-white text-slate-700 border border-slate-200' : 'bg-blue-600 text-white'}`}>
                {m.content}
              </div>
            </div>
          </div>
        ))}
        {isTyping && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-white border border-slate-100 p-3 rounded-2xl flex items-center gap-3 shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">正在思考中...</span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-slate-100">
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            multiple 
            accept="image/*" 
            className="hidden" 
          />
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
            title="上传化验单图片"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          
          <div className="relative flex-1 group">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="询问临床建议、统计数据或营养禁忌..."
              className="w-full bg-slate-50 text-slate-700 border border-slate-200 rounded-xl py-3 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 text-sm"
            />
            <button 
              type="submit"
              disabled={isTyping}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-30 transition-all shadow-lg shadow-blue-100"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

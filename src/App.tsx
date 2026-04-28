import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Send, 
  Trash2, 
  Plus, 
  Code, 
  Search, 
  Github, 
  Layers, 
  Cpu,
  RefreshCcw,
  Sidebar as SidebarIcon,
  MessageSquare,
  Terminal,
  Globe,
  Sparkles,
  Mic,
  MicOff
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { cn } from './lib/utils';
import { Message, Conversation } from './types';
import { sendMessageStream } from './services/gemini';

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'coding' | 'search' | 'general'>('coding');
  const [dateRange, setDateRange] = useState<'anytime' | 'past-24h' | 'past-week' | 'past-month'>('anytime');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find(c => c.id === activeId);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeConversation?.messages]);

  const createNewConversation = () => {
    const newId = crypto.randomUUID();
    const newConv: Conversation = {
      id: newId,
      title: 'New Discussion',
      messages: [],
      updatedAt: Date.now()
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveId(newId);
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const handleSend = async (overrideInput?: string) => {
    const chatInput = overrideInput ?? input;
    if (!chatInput.trim() || isStreaming) return;

    if (isListening) {
      stopListening();
    }

    let convId = activeId;
    if (!convId) {
      const newId = crypto.randomUUID();
      const newConv: Conversation = {
        id: newId,
        title: chatInput.slice(0, 30) + '...',
        messages: [],
        updatedAt: Date.now()
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveId(newId);
      convId = newId;
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: chatInput,
      type: mode === 'search' ? 'search' : (mode === 'coding' ? 'code' : 'text'),
      timestamp: Date.now()
    };

    setConversations(prev => prev.map(c => 
      c.id === convId ? { ...c, messages: [...c.messages, userMsg], updatedAt: Date.now() } : c
    ));

    setInput('');
    setIsStreaming(true);

    const modelMsgId = crypto.randomUUID();
    const modelMsg: Message = {
      id: modelMsgId,
      role: 'model',
      content: '',
      type: mode === 'search' ? 'search' : (mode === 'coding' ? 'code' : 'text'),
      timestamp: Date.now()
    };

    setConversations(prev => prev.map(c => 
      c.id === convId ? { ...c, messages: [...c.messages, modelMsg] } : c
    ));

    try {
      const currentConv = conversations.find(c => c.id === convId);
      const history = currentConv ? currentConv.messages : [];
      const stream = sendMessageStream(history, chatInput, mode, dateRange);
      
      let fullContent = '';
      for await (const chunk of stream) {
        fullContent += chunk.text;
        setConversations(prev => prev.map(c => 
          c.id === convId ? {
            ...c,
            messages: c.messages.map(m => 
              m.id === modelMsgId ? { 
                ...m, 
                content: fullContent, 
                groundingMetadata: chunk.groundingMetadata ?? m.groundingMetadata 
              } : m
            )
          } : c
        ));
      }
    } catch (error) {
      console.error('RANA error:', error);
    } finally {
      setIsStreaming(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognitionRef.current.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        setInput(prev => prev + (prev.endsWith(' ') ? '' : ' ') + finalTranscript);
      }
    };

    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="flex h-screen bg-bg-base text-[#e4e4e7] font-sans selection:bg-accent-primary/30">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="overflow-hidden border-r border-border-subtle bg-sidebar flex flex-col"
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-6 h-6 bg-accent-primary rounded-md flex items-center justify-center shrink-0">
            <Cpu size={16} className="text-white" />
          </div>
          <h1 className="font-display font-bold text-white tracking-tight truncate">RANA AI</h1>
        </div>

        <div className="px-4 mb-6">
          <button 
            onClick={createNewConversation}
            className="w-full flex items-center justify-center gap-2 bg-accent-primary hover:bg-blue-500 text-white py-2 rounded-lg transition-all text-xs font-bold"
          >
            <Plus size={14} />
            New Session
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-6 custom-scrollbar pb-6">
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-3">Navigation</span>
            <div className="space-y-1">
              {[
                { id: 'coding', label: 'Code Generation', icon: Terminal },
                { id: 'search', label: 'Web Search', icon: Globe },
                { id: 'general', label: 'Creative Chat', icon: MessageSquare },
              ].map(item => (
                <div
                  key={item.id}
                  onClick={() => setMode(item.id as any)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm",
                    mode === item.id ? "bg-border-subtle text-white" : "text-text-muted hover:text-white"
                  )}
                >
                  <item.icon size={16} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-3">History</span>
            <div className="space-y-1">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => setActiveId(conv.id)}
                  className={cn(
                    "group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all text-sm",
                    activeId === conv.id ? "bg-border-subtle text-white" : "text-text-muted hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <MessageSquare size={14} />
                    <span className="truncate">{conv.title}</span>
                  </div>
                  <button 
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border-subtle">
          <div className="flex items-center gap-3 p-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent-primary to-purple-500" />
            <div className="text-[11px] overflow-hidden">
              <p className="font-display font-bold text-white truncate text-xs tracking-tight">RANA Architect</p>
              <p className="text-accent-secondary/70 font-bold text-[9px] uppercase tracking-widest truncate">Neural Active</p>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-border-subtle flex items-center justify-between px-6 bg-bg-base/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-border-subtle rounded-lg text-text-muted transition-colors"
            >
              <SidebarIcon size={18} />
            </button>
            <div className="h-4 w-[1px] bg-border-subtle" />
            <div className="flex gap-1.5 overflow-x-auto scroll-none">
              {[
                { id: 'coding', label: 'Architect', Icon: Terminal },
                { id: 'search', label: 'Explorer', Icon: Globe },
                { id: 'general', label: 'Assistant', Icon: Sparkles },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-widest transition-all whitespace-nowrap",
                    mode === m.id 
                      ? "bg-accent-primary text-white shadow-lg border border-accent-primary/20" 
                      : "text-text-muted hover:text-white hover:bg-white/5"
                  )}
                >
                  <m.Icon size={12} />
                  {m.label}
                </button>
              ))}
            </div>

            {mode === 'search' && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1.5 ml-4 px-3 py-1 bg-surface-elevated border border-border-subtle rounded-lg"
              >
                {[
                  { id: 'anytime', label: 'Anytime' },
                  { id: 'past-24h', label: '24H' },
                  { id: 'past-week', label: 'Week' },
                  { id: 'past-month', label: 'Month' },
                ].map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setDateRange(range.id as any)}
                    className={cn(
                      "text-[9px] font-black uppercase tracking-tighter px-2 py-1 rounded transition-colors",
                      dateRange === range.id ? "bg-accent-primary/20 text-accent-primary" : "text-text-muted hover:text-white"
                    )}
                  >
                    {range.label}
                  </button>
                ))}
              </motion.div>
            )}

            <div className="h-4 w-[1px] bg-border-subtle ml-2" />
            <div className="text-[10px] hidden md:block">
              <span className="text-text-muted uppercase tracking-[0.2em] font-bold">Node:</span>
              <span className="ml-2 font-black text-accent-secondary shadow-[0_0_10px_rgba(34,211,238,0.2)]">GEN-3-PRO</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex -space-x-1.5">
               {[Code, Search, Layers].map((Icon, i) => (
                 <div key={i} className="w-7 h-7 rounded-full border-2 border-bg-base bg-sidebar flex items-center justify-center shadow-sm">
                   <Icon size={12} className="text-text-muted"/>
                 </div>
               ))}
             </div>
          </div>
        </header>

        {/* Chat Feed */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 custom-scrollbar scroll-smooth"
        >
          {(!activeConversation || activeConversation.messages.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-8">
              <div className="w-16 h-16 bg-accent-primary/20 rounded-2xl flex items-center justify-center border border-accent-primary/30 shadow-[0_0_30px_rgba(129,140,248,0.2)]">
                <Cpu size={32} className="text-accent-primary" />
              </div>
              <div className="space-y-4">
                <h2 className="text-4xl font-display font-bold tracking-tight text-white leading-tight">How can RANA assist today?</h2>
                <p className="text-text-muted text-sm leading-relaxed max-w-sm mx-auto">
                  Architectural code generation, real-time search, and creative synthesis in a unified intelligence interface.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 w-full pt-4">
                {[
                  { icon: Code, label: "FastAPI Endpoints", desc: "Build secure RESTful APIs", color: "text-blue-400" },
                  { icon: Search, label: "Market Research", desc: "Real-time industry insights", color: "text-cyan-400" },
                  { icon: Terminal, label: "Logic Breakdown", desc: "Deep architectural analysis", color: "text-indigo-400" },
                  { icon: Globe, label: "Global Events", desc: "Latest search synthesis", color: "text-purple-400" },
                ].map((item, i) => (
                  <button 
                    key={i}
                    onClick={() => setInput(item.label)}
                    className="flex flex-col items-start p-5 bg-surface-elevated/50 backdrop-blur-sm border border-border-subtle rounded-2xl hover:bg-accent-primary/5 hover:border-accent-primary/30 transition-all text-left group"
                  >
                    <item.icon size={20} className={cn(item.color, "mb-4 group-hover:scale-110 transition-transform")} />
                    <p className="font-bold text-[13px] text-white tracking-tight">{item.label}</p>
                    <p className="text-[11px] text-text-muted mt-2 leading-relaxed">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-10">
              {activeConversation.messages.map((msg, idx) => {
                const prevUserMsg = msg.role === 'model' ? activeConversation.messages[idx - 1] : null;
                const searchKeywords = prevUserMsg?.type === 'search' 
                  ? prevUserMsg.content
                      .split(/\s+/)
                      .filter(word => word.length > 3)
                      .map(word => word.replace(/[^\w]/g, ''))
                  : [];

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg.id}
                    className={cn(
                      "flex flex-col gap-4 group",
                      msg.role === 'user' ? "items-end" : "items-start"
                    )}
                  >
                    {msg.role === 'user' ? (
                      <div className="bg-accent-primary text-white px-6 py-4 rounded-[24px_24px_4px_24px] max-w-[80%] text-sm leading-relaxed shadow-xl font-medium">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="w-full flex flex-col gap-6">
                        {msg.groundingMetadata?.searchEntryPoint && (
                          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-accent-secondary animate-pulse">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent-secondary shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                            Synthesizing Real-Time Knowledge...
                          </div>
                        )}
                        
                        <div className="bg-surface-elevated/40 backdrop-blur-xl border border-border-subtle rounded-[24px] overflow-hidden shadow-2xl relative group/card">
                          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-primary/20 to-transparent" />
                          <div className="p-8 text-[15px] text-slate-200 leading-relaxed font-light">
                            <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-transparent prose-pre:p-0">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  text({ children }: any) {
                                    if (typeof children !== 'string' || !searchKeywords.length) return <>{children}</>;
                                    const pattern = new RegExp(`(${searchKeywords.join('|')})`, 'gi');
                                    const parts = children.split(pattern);
                                    return (
                                      <>
                                        {parts.map((part, i) => 
                                          pattern.test(part) ? (
                                            <mark key={i} className="bg-accent-primary/20 text-accent-primary rounded px-0.5 py-0 font-medium">{part}</mark>
                                          ) : part
                                        )}
                                      </>
                                    );
                                  },
                                  code({ node, inline, className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                      <div className="my-6 rounded-xl overflow-hidden border border-border-subtle bg-black shadow-2xl">
                                        <div className="bg-sidebar/50 px-4 py-2.5 flex items-center justify-between border-b border-border-subtle">
                                          <span className="text-[10px] uppercase font-bold text-text-muted tracking-widest">{match[1]}</span>
                                          <div className="flex gap-1.5">
                                            {[1,2,3].map(i => <div key={i} className="w-2 h-2 rounded-full bg-border-subtle" />)}
                                          </div>
                                        </div>
                                        <SyntaxHighlighter
                                          style={vscDarkPlus as any}
                                          language={match[1]}
                                          PreTag="div"
                                          className="!m-0 !bg-black !p-6 !text-[13px]"
                                          {...props}
                                        >
                                          {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                      </div>
                                    ) : (
                                      <code className={cn("bg-border-subtle px-1.5 py-0.5 rounded text-accent-primary font-mono text-[13px]", className)} {...props}>
                                        {children}
                                      </code>
                                    )
                                  }
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          </div>

                          {msg.groundingMetadata?.groundingChunks && (
                            <div className="px-6 py-4 bg-bg-base/50 border-t border-border-subtle flex flex-col gap-4">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Sources & References</span>
                                {msg.type === 'search' && (
                                  <button
                                    onClick={() => handleSend(prevUserMsg?.content)}
                                    disabled={isStreaming}
                                    className="flex items-center gap-2 text-[10px] bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary border border-accent-primary/20 px-3 py-1 rounded-md transition-all font-bold uppercase tracking-wider disabled:opacity-50"
                                  >
                                    <RefreshCcw size={10} className={isStreaming ? "animate-spin" : ""} />
                                    Re-trigger Search
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {msg.groundingMetadata.groundingChunks?.map((chunk: any, i: number) => (
                                  chunk.web?.uri && (
                                    <a 
                                      key={i}
                                      href={chunk.web.uri}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[11px] bg-sidebar hover:bg-border-subtle border border-border-subtle px-3 py-1.5 rounded-md text-text-muted hover:text-white transition-all flex items-center gap-2"
                                    >
                                      <Globe size={10} />
                                      {chunk.web.title || "Reference"}
                                    </a>
                                  )
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted px-2">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {msg.role === 'model' ? 'Aura Professional' : 'Identity Verified'}
                    </div>
                  </motion.div>
                );
              })}
              {isStreaming && (
                <div className="flex items-center gap-3 text-accent-primary text-[10px] font-bold animate-pulse uppercase tracking-[0.2em]">
                  <RefreshCcw size={12} className="animate-spin" />
                  RANA is conceptualizing...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Dock */}
        <div className="p-8 bg-gradient-to-t from-bg-base via-bg-base/95 to-transparent">
          <div className="max-w-4xl mx-auto relative group">
            {/* Ambient Background Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-accent-primary/20 to-accent-secondary/20 rounded-3xl blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            
            <div className={cn(
              "relative p-2 rounded-[28px] bg-surface-elevated/80 backdrop-blur-2xl border transition-all shadow-2xl",
              isStreaming ? "opacity-60 border-border-subtle" : "border-white/10 focus-within:border-accent-primary/50 focus-within:ring-4 focus-within:ring-accent-primary/10"
            )}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isStreaming}
                placeholder={mode === 'coding' ? "Ask RANA to build an architecture or refactor code..." : "Search for real-time data, news, or specifics..."}
                className="w-full bg-transparent border-none focus:ring-0 resize-none min-h-[48px] max-h-[300px] px-4 py-3 text-sm text-[#e4e4e7] placeholder:text-text-muted custom-scrollbar"
                rows={1}
                autoFocus
              />
              <div className="flex items-center justify-between px-4 pb-2">
                <div className="flex items-center gap-3">
                   <div className="px-2 py-1 bg-border-subtle rounded text-[10px] font-bold text-text-muted uppercase tracking-tighter">
                     Ctrl + K Search
                   </div>
                   <div className="h-4 w-[1px] bg-border-subtle" />
                   <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                     {mode === 'coding' ? 'Coding Mode Active' : 'Search Enabled'}
                   </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleListening}
                    disabled={isStreaming}
                    className={cn(
                      "w-10 h-10 rounded-xl transition-all flex items-center justify-center",
                      isListening ? "bg-red-500/20 text-red-500" : "bg-border-subtle text-[#71717a] hover:text-white"
                    )}
                    title={isListening ? "Stop Listening" : "Start Listening"}
                  >
                    {isListening ? (
                      <div className="relative">
                        <MicOff size={18} />
                        <motion.div 
                          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="absolute inset-0 bg-red-400 rounded-full -z-10" 
                        />
                      </div>
                    ) : <Mic size={18} />}
                  </button>
                  <button 
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isStreaming}
                    className={cn(
                      "w-10 h-10 rounded-xl transition-all shadow-xl flex items-center justify-center",
                      input.trim() && !isStreaming 
                        ? "bg-accent-primary hover:bg-blue-500 text-white hover:scale-105 active:scale-95" 
                        : "bg-border-subtle text-[#71717a]"
                    )}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
            
            <p className="text-[10px] text-center text-text-muted mt-4 uppercase tracking-[0.3em] font-bold">
              Empowered by Gemini 3.1 Pro Architect Reasoning
            </p>
          </div>
        </div>
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

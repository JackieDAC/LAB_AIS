import React, { useState, useEffect, useRef } from 'react';
import { 
  UserRole, 
  StageType, 
  Project, 
  INITIAL_WEIGHTS,
  Language,
  UserProfile
} from './types';
import { STAGE_CONFIG, TRANSLATIONS } from './constants';
import DesignWheel from './components/DesignWheel';
import AnnotationCanvas from './components/AnnotationCanvas';
import { generateStageSuggestions, analyzeFeedback } from './services/geminiService';
import { 
  Users, 
  Settings, 
  LogOut, 
  Upload, 
  Plus, 
  MessageSquare, 
  CheckSquare, 
  Download, 
  Sparkles,
  FileText,
  Menu,
  X,
  Lock,
  Layout,
  Globe,
  UserCircle,
  Shield,
  FileSpreadsheet,
  Rocket,
  Eye,
  ChevronLeft,
  ChevronRight,
  Maximize2
} from 'lucide-react';

// --- MOCK DATA GENERATOR ---
const createNewProject = (studentName: string, studentId: string, title: string): Project => {
  const stages: any = {};
  Object.values(StageType).forEach(type => {
    stages[type] = {
      type,
      status: type === StageType.EMPATHIZE ? 'IN_PROGRESS' : 'LOCKED',
      options: [],
      checklists: [
        { id: '1', text: 'Requirement 1 met', completed: false },
        { id: '2', text: 'Requirement 2 met', completed: false }
      ],
      instructorFeedback: '',
      score: 0,
      weight: INITIAL_WEIGHTS[type as StageType]
    };
  });
  
  return {
    id: Date.now().toString(),
    title,
    studentName,
    studentId,
    classId: 'CLASS-101',
    isActive: true,
    stages,
    totalScore: 0,
    createdAt: new Date().toISOString()
  };
};

// --- APP COMPONENT ---
const App: React.FC = () => {
  // --- GLOBAL STATE ---
  const [language, setLanguage] = useState<Language>('vi'); // Default Vietnamese
  const t = TRANSLATIONS[language];

  const [userRole, setUserRole] = useState<UserRole>(UserRole.STUDENT);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  // --- ADMIN STATE (MOCK DATABASE) ---
  const [validStudentIds, setValidStudentIds] = useState<string[]>(['1234567890', '0987654321']); 
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  
  // Navigation State
  const [view, setView] = useState<'SETUP' | 'DASHBOARD' | 'STAGE_DETAIL' | 'REPORT' | 'ADMIN_DASHBOARD' | 'GRADING'>('SETUP');
  const [currentStage, setCurrentStage] = useState<StageType>(StageType.EMPATHIZE);
  
  // UI State
  const [isAnnotating, setIsAnnotating] = useState<{ url: string; assetId: string; optionId: string } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Auth State
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string>("");
  const [aiAnalysis, setAiAnalysis] = useState<string>("");

  // Setup Form State
  const [setupData, setSetupData] = useState({ 
      name: '', 
      email: '', 
      studentId: '', 
      title: '', 
      type: 'INDIVIDUAL' 
  });
  const [setupError, setSetupError] = useState('');

  // --- HANDLERS ---

  const updateProjectState = (updated: Project) => {
    setProject(updated);
    setAllProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginEmail === 'nguyenduydac@gmail.com' && loginPass === '12345123') {
      setUserRole(UserRole.INSTRUCTOR); 
      setShowLogin(false);
      setLoginError('');
      setLoginEmail('');
      setLoginPass('');
      setView('ADMIN_DASHBOARD');
    } else {
      setLoginError(t.loginError);
    }
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const text = evt.target?.result as string;
        const ids = text.split(/[\n,]+/).map(id => id.trim()).filter(id => id.length === 10);
        setValidStudentIds(prev => [...new Set([...prev, ...ids])]);
        alert(`${t.csvSuccess} (${ids.length} IDs found)`);
    };
    reader.readAsText(file);
  };

  const handleExportResults = () => {
    // CSV Header
    const headers = [
      "Student ID", 
      "Name", 
      "Email", 
      "Project Title", 
      "Total Score", 
      "Empathize Status", "Empathize Score",
      "Define Status", "Define Score",
      "Ideate Status", "Ideate Score",
      "Prototype Status", "Prototype Score",
      "Test Status", "Test Score",
      "Implement Status", "Implement Score"
    ];

    // CSV Rows based on VALID ID LIST (as requested)
    const rows = validStudentIds.map(id => {
      // Find user and project
      const user = registeredUsers.find(u => u.studentId === id);
      const proj = allProjects.find(p => p.studentId === id);
      
      const row = [
        id,
        user ? user.name : "Not Registered",
        user ? user.email : "",
        proj ? proj.title : "No Project",
        proj ? proj.totalScore : "0"
      ];

      // Add stage details
      Object.values(StageType).forEach(stage => {
         if (proj && proj.stages[stage]) {
             row.push(proj.stages[stage].status);
             row.push(proj.stages[stage].score.toString());
         } else {
             row.push("N/A");
             row.push("0");
         }
      });

      return row.join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `design_thinker_results_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateProject = () => {
    setSetupError('');
    if (!setupData.name || !setupData.title || !setupData.email || !setupData.studentId) {
        setSetupError('Please fill all fields.');
        return;
    }
    if (!validStudentIds.includes(setupData.studentId)) {
        setSetupError(t.idError);
        return;
    }
    const newUser: UserProfile = {
        id: Date.now().toString(),
        name: setupData.name,
        email: setupData.email,
        studentId: setupData.studentId,
        isOnline: true,
        lastActive: new Date().toISOString(),
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${setupData.name}`
    };
    setRegisteredUsers(prev => {
        const exists = prev.find(u => u.studentId === newUser.studentId);
        if (exists) return prev.map(u => u.studentId === newUser.studentId ? {...u, isOnline: true} : u);
        return [...prev, newUser];
    });
    setCurrentUser(newUser);
    const newProject = createNewProject(setupData.name, setupData.studentId, setupData.title);
    setProject(newProject);
    setAllProjects(prev => [...prev, newProject]);
    setUserRole(UserRole.STUDENT);
    setView('DASHBOARD');
  };

  const handleLogout = () => {
    if (userRole === UserRole.STUDENT && currentUser) {
        setRegisteredUsers(prev => prev.map(u => u.id === currentUser.id ? {...u, isOnline: false} : u));
        setCurrentUser(null);
        setProject(null);
    }
    setUserRole(UserRole.STUDENT);
    setIsMenuOpen(false);
    setView('SETUP');
    setSetupData({ name: '', email: '', studentId: '', title: '', type: 'INDIVIDUAL' });
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
      if (!currentUser) return;
      const updated = { ...currentUser, ...updates };
      setCurrentUser(updated);
      setRegisteredUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
  };

  const handleStageSelect = (stage: StageType) => {
    setCurrentStage(stage);
    setView('STAGE_DETAIL');
    setAiSuggestion("");
    setAiAnalysis("");
  };

  const handleAddOption = () => {
    if (!project) return;
    const updatedProject = { ...project };
    updatedProject.stages[currentStage].options.push({
      id: Date.now().toString(),
      title: `Option ${updatedProject.stages[currentStage].options.length + 1}`,
      description: '',
      assets: [],
      isSelected: false
    });
    updateProjectState(updatedProject);
  };

  const handleFileUpload = (optionId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !project) return;
    const url = URL.createObjectURL(file);
    const type = file.type.includes('image') ? 'image' : file.type.includes('pdf') ? 'pdf' : 'doc';
    const updatedProject = { ...project };
    const option = updatedProject.stages[currentStage].options.find(o => o.id === optionId);
    if (option) {
      option.assets.push({
        id: Date.now().toString(),
        name: file.name,
        url,
        type,
        annotations: []
      });
    }
    updateProjectState(updatedProject);
  };

  const handleSubmitStage = () => {
    if (!project) return;
    const updatedProject = { ...project };
    updatedProject.stages[currentStage].status = 'SUBMITTED';
    updateProjectState(updatedProject);
    setView('DASHBOARD');
  };

  const handleScoreUpdate = (score: number) => {
    if (!project) return;
    const updatedProject = { ...project };
    updatedProject.stages[currentStage].score = score;
    updateProjectState(updatedProject);
  };

  const handleFeedbackUpdate = (feedback: string) => {
    if (!project) return;
    const updatedProject = { ...project };
    updatedProject.stages[currentStage].instructorFeedback = feedback;
    updateProjectState(updatedProject);
  };

  const handleStageVerdict = (approved: boolean) => {
    if (!project) return;
    const updatedProject = { ...project };
    updatedProject.stages[currentStage].status = approved ? 'APPROVED' : 'REJECTED';
    if (approved) {
        const stages = Object.values(StageType);
        const currentIndex = stages.indexOf(currentStage);
        if (currentIndex < stages.length - 1) {
            const nextStage = stages[currentIndex + 1];
            if (updatedProject.stages[nextStage].status === 'LOCKED') {
                updatedProject.stages[nextStage].status = 'IN_PROGRESS';
            }
        }
    }
    let totalWeightedScore = 0;
    Object.values(updatedProject.stages).forEach(s => {
        totalWeightedScore += (s.score * (s.weight / 100));
    });
    updatedProject.totalScore = parseFloat(totalWeightedScore.toFixed(2));
    updateProjectState(updatedProject);
    if(view !== 'GRADING') setView('DASHBOARD'); // Stay in grading view if already there
  };

  const handleGetAiHelp = async () => {
    if (!project) return;
    setAiLoading(true);
    const suggestion = await generateStageSuggestions(currentStage, project.title);
    setAiSuggestion(suggestion);
    setAiLoading(false);
  };
  
  useEffect(() => {
     if (userRole === UserRole.STUDENT && project && view === 'STAGE_DETAIL') {
         const stageData = project.stages[currentStage];
         if ((stageData.status === 'APPROVED' || stageData.status === 'REJECTED') && stageData.instructorFeedback && !aiAnalysis) {
             analyzeFeedback(stageData.instructorFeedback, stageData.score).then(setAiAnalysis);
         }
     }
  }, [project, currentStage, view, userRole, aiAnalysis]);


  // --- SUB-COMPONENTS ---
  
  const Header = () => (
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="relative">
                 <button 
                   onClick={() => setIsMenuOpen(!isMenuOpen)}
                   className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
                 >
                    <Menu size={24} />
                 </button>
                 {isMenuOpen && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                     <div className="absolute top-full left-0 mt-2 w-64 bg-white shadow-xl rounded-xl border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                        <div className="px-3 py-3 border-b border-gray-100 mb-2">
                           <p className="text-xs font-bold text-gray-400 uppercase">{t.menu}</p>
                        </div>
                        <button onClick={() => { setView('SETUP'); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700 font-medium flex items-center gap-2">
                           <Plus size={16} /> {t.setupTitle}
                        </button>
                        {project && (
                           <>
                             <button onClick={() => { setView('DASHBOARD'); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700 font-medium flex items-center gap-2">
                                <Layout size={16} /> {t.dashboard}
                             </button>
                             <button onClick={() => { setView('REPORT'); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700 font-medium flex items-center gap-2">
                                <FileText size={16} /> {t.viewReport}
                             </button>
                           </>
                        )}
                        {userRole === UserRole.INSTRUCTOR && (
                             <button onClick={() => { setView('ADMIN_DASHBOARD'); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-purple-50 text-purple-700 font-medium flex items-center gap-2">
                                <Shield size={16} /> {t.adminDashboard}
                             </button>
                        )}
                        <div className="my-2 border-t border-gray-100"></div>
                        {userRole === UserRole.STUDENT && currentUser && (
                           <>
                            <button onClick={() => { setShowSettings(true); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700 font-medium flex items-center gap-2">
                                <Settings size={16} /> {t.profile}
                            </button>
                             <button onClick={handleLogout} className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 font-medium flex items-center gap-2">
                                <LogOut size={16} /> {t.signOut}
                             </button>
                           </>
                        )}
                        {userRole === UserRole.INSTRUCTOR && (
                           <button onClick={handleLogout} className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 font-medium flex items-center gap-2">
                              <LogOut size={16} /> {t.signOut} (Instructor)
                           </button>
                        )}
                        {!currentUser && userRole === UserRole.STUDENT && (
                            <button onClick={() => { setShowLogin(true); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-purple-50 text-purple-600 font-medium flex items-center gap-2">
                                <Lock size={16} /> {t.instructorLogin}
                            </button>
                        )}
                     </div>
                   </>
                 )}
             </div>

             <div className="flex items-center gap-2 cursor-pointer" onClick={() => project && setView('DASHBOARD')}>
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">DT</div>
                <h1 className="font-bold text-gray-800 hidden sm:block">{t.appTitle}</h1>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             <button onClick={() => setLanguage(l => l === 'en' ? 'vi' : 'en')} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">
                <Globe size={12} /> {language === 'en' ? 'EN' : 'VN'}
             </button>
             {currentUser && (
                <div className="flex items-center gap-2" title={currentUser.name}>
                    <img src={currentUser.avatar} alt="Avatar" className="w-8 h-8 rounded-full border border-gray-200" />
                    <span className="text-xs font-bold text-gray-700 hidden sm:inline">{currentUser.name}</span>
                </div>
             )}
             <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border ${
                 userRole === UserRole.INSTRUCTOR 
                   ? 'bg-purple-100 text-purple-700 border-purple-200' 
                   : 'bg-blue-50 text-blue-700 border-blue-100'
             }`}>
                 {userRole === UserRole.INSTRUCTOR ? <Sparkles size={12} /> : <Users size={12} />}
                 {userRole === UserRole.INSTRUCTOR ? 'INSTRUCTOR' : 'STUDENT'}
             </div>
          </div>
        </div>
      </header>
  );

  const SettingsModal = () => (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
              <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2"><Settings size={20}/> {t.settings}</h2>
              <div className="space-y-6">
                  <div className="flex items-center gap-4">
                      <img src={currentUser?.avatar} className="w-20 h-20 rounded-full bg-gray-100" />
                      <div>
                          <p className="font-bold text-lg">{currentUser?.name}</p>
                          <p className="text-sm text-gray-500">{currentUser?.studentId}</p>
                          <button 
                            onClick={() => updateProfile({ avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${Date.now()}` })}
                            className="text-xs text-blue-600 hover:underline mt-1"
                          >
                             {t.changeAvatar}
                          </button>
                      </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <div>
                          <label className="text-xs font-bold text-gray-400 uppercase">{t.email}</label>
                          <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800">{currentUser?.email}</span>
                              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckSquare size={10} /> {t.verified}
                              </span>
                          </div>
                      </div>
                      <div>
                           <label className="text-xs font-bold text-gray-400 uppercase">{t.language}</label>
                           <div className="flex gap-2 mt-1">
                               <button onClick={() => setLanguage('en')} className={`px-3 py-1 rounded text-sm border ${language === 'en' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}>English</button>
                               <button onClick={() => setLanguage('vi')} className={`px-3 py-1 rounded text-sm border ${language === 'vi' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}>Tiếng Việt</button>
                           </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
  );

  // --- VIEWS ---
  
  // SPLIT SCREEN GRADING VIEW
  if (view === 'GRADING' && project) {
      const stageKeys = Object.values(StageType);
      const stageIdx = stageKeys.indexOf(currentStage);
      const stageConfig = STAGE_CONFIG[currentStage];
      
      const navigateStage = (delta: number) => {
          const newIdx = stageIdx + delta;
          if (newIdx >= 0 && newIdx < stageKeys.length) {
              setCurrentStage(stageKeys[newIdx]);
          }
      };

      return (
          <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
             <Header />
             
             {isAnnotating && (
                <AnnotationCanvas 
                    imageUrl={isAnnotating.url}
                    initialAnnotations={
                        project.stages[currentStage].options.find(o => o.id === isAnnotating.optionId)
                        ?.assets.find(a => a.id === isAnnotating.assetId)?.annotations || []
                    }
                    readOnly={false} // Instructor can annotate
                    onClose={() => setIsAnnotating(null)}
                    onSave={(anns) => {
                        const updated = {...project};
                        const opt = updated.stages[currentStage].options.find(o => o.id === isAnnotating.optionId);
                        const asset = opt?.assets.find(a => a.id === isAnnotating.assetId);
                        if (asset) asset.annotations = anns;
                        updateProjectState(updated);
                    }}
                />
             )}

             <div className="flex flex-1 overflow-hidden">
                 {/* LEFT: INSTRUCTOR PANEL */}
                 <div className="w-1/2 flex flex-col border-r border-gray-200 bg-white shadow-lg z-10">
                     <div className="p-4 border-b bg-gray-50 flex items-center justify-between shrink-0">
                         <div>
                             <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">{t.instructorPanel}</h2>
                             <p className="text-lg font-bold text-gray-800">{project.title}</p>
                         </div>
                         <button onClick={() => setView('ADMIN_DASHBOARD')} className="text-gray-500 hover:text-gray-800 p-2">
                             <X size={20} />
                         </button>
                     </div>
                     
                     <div className="p-4 bg-white border-b flex items-center justify-between shrink-0">
                         <button onClick={() => navigateStage(-1)} disabled={stageIdx === 0} className="p-2 hover:bg-gray-100 rounded disabled:opacity-30">
                             <ChevronLeft />
                         </button>
                         <div className="text-center">
                             <p className="text-xs text-gray-400 font-bold uppercase">{t.stage} {stageIdx + 1}/{stageKeys.length}</p>
                             <p className={`font-bold ${stageConfig.color}`}>{stageConfig.label}</p>
                         </div>
                         <button onClick={() => navigateStage(1)} disabled={stageIdx === stageKeys.length - 1} className="p-2 hover:bg-gray-100 rounded disabled:opacity-30">
                             <ChevronRight />
                         </button>
                     </div>

                     <div className="flex-1 overflow-y-auto p-6 space-y-6">
                         {/* Requirements */}
                         <div>
                            <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <CheckSquare size={16} /> {t.requirements}
                            </h3>
                            <div className="space-y-2 bg-gray-50 p-3 rounded-lg border">
                                {project.stages[currentStage].checklists.map(item => (
                                    <div key={item.id} className="flex items-start gap-2">
                                        <input 
                                            type="checkbox" 
                                            checked={item.completed}
                                            onChange={() => {
                                                const updated = {...project};
                                                const chk = updated.stages[currentStage].checklists.find(c => c.id === item.id);
                                                if(chk) chk.completed = !chk.completed;
                                                updateProjectState(updated);
                                            }}
                                            className="mt-1"
                                        />
                                        <span className={`text-sm ${item.completed ? 'text-gray-500 line-through' : 'text-gray-700'}`}>{item.text}</span>
                                    </div>
                                ))}
                            </div>
                         </div>

                         {/* Feedback */}
                         <div>
                             <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <MessageSquare size={16} /> {t.feedback}
                            </h3>
                            <textarea 
                                className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-40"
                                placeholder="Write feedback here..."
                                value={project.stages[currentStage].instructorFeedback}
                                onChange={(e) => handleFeedbackUpdate(e.target.value)}
                            />
                         </div>

                         {/* Scoring */}
                         <div>
                             <h3 className="font-bold text-gray-800 mb-2">{t.grading}</h3>
                             <div className="flex items-center gap-4 mb-4">
                                 <div className="flex items-center gap-2">
                                     <span className="text-sm text-gray-600">{t.score}</span>
                                     <input 
                                        type="number" 
                                        min="0" max="10" 
                                        value={project.stages[currentStage].score}
                                        onChange={(e) => handleScoreUpdate(Number(e.target.value))}
                                        className="w-20 p-2 text-center border rounded font-bold text-lg"
                                    />
                                    <span className="text-gray-400">/ 10</span>
                                 </div>
                                 <div className="text-xs text-gray-400">Weight: {project.stages[currentStage].weight}%</div>
                             </div>

                             <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => handleStageVerdict(false)}
                                    className="bg-red-100 text-red-700 py-3 rounded-lg font-bold hover:bg-red-200 border border-red-200 transition"
                                >
                                    {t.reject}
                                </button>
                                <button 
                                    onClick={() => handleStageVerdict(true)}
                                    className="bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 shadow-md hover:shadow-lg transition"
                                >
                                    {t.approve}
                                </button>
                             </div>
                         </div>
                     </div>
                 </div>

                 {/* RIGHT: STUDENT PANEL VIEW */}
                 <div className="w-1/2 flex flex-col bg-gray-50">
                     <div className="p-4 border-b bg-white flex items-center justify-between shrink-0">
                         <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">{t.studentView}</h2>
                         <div className="flex items-center gap-2">
                             <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${project.studentName}`} className="w-6 h-6 rounded-full" />
                             <span className="text-sm font-bold text-gray-700">{project.studentName}</span>
                         </div>
                     </div>

                     <div className="flex-1 overflow-y-auto p-8">
                         {/* Student Content Simulation */}
                         <div className={`rounded-xl p-6 text-white shadow-md mb-6 ${stageConfig.bgColor}`}>
                            <div className="flex items-center gap-3 mb-2">
                                {stageConfig.icon}
                                <h2 className="text-2xl font-bold">{stageConfig.label}</h2>
                            </div>
                            <p className="opacity-90">{stageConfig.description}</p>
                        </div>

                        <div className="space-y-6">
                            <h3 className="font-bold text-gray-800 text-lg border-b pb-2">{t.workOptions}</h3>
                            
                            {project.stages[currentStage].options.length === 0 && (
                                <div className="text-center p-10 border-2 border-dashed border-gray-300 rounded-xl text-gray-400">
                                    Student has not submitted any work yet.
                                </div>
                            )}

                            {project.stages[currentStage].options.map((option) => (
                                <div key={option.id} className="bg-white border rounded-xl p-6 shadow-sm">
                                    <h4 className="font-bold text-gray-800 mb-4">{option.title}</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        {option.assets.map(asset => (
                                            <div 
                                                key={asset.id} 
                                                className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-blue-500 transition shadow-sm"
                                                onClick={() => setIsAnnotating({ url: asset.url, assetId: asset.id, optionId: option.id })}
                                            >
                                                {asset.type === 'image' ? (
                                                    <img src={asset.url} className="w-full h-full object-cover" alt="asset" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">PDF</div>
                                                )}
                                                
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                     <div className="bg-white/90 text-gray-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                                                         <Maximize2 size={12}/> Inspect
                                                     </div>
                                                </div>

                                                {asset.annotations.length > 0 && (
                                                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs w-6 h-6 flex items-center justify-center rounded-full font-bold shadow-sm border-2 border-white">
                                                        {asset.annotations.length}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                     </div>
                 </div>
             </div>
          </div>
      );
  }

  if (view === 'ADMIN_DASHBOARD') {
      return (
          <div className="min-h-screen flex flex-col bg-gray-50">
             <Header />
             <div className="max-w-6xl mx-auto w-full p-6">
                 <div className="flex justify-between items-center mb-8">
                     <div>
                         <h1 className="text-3xl font-bold text-gray-800">{t.adminDashboard}</h1>
                         <p className="text-gray-500">Manage students and validation lists.</p>
                     </div>
                     <div className="flex gap-2">
                        <button 
                            onClick={handleExportResults}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 shadow-lg transition-transform hover:scale-105"
                        >
                            <Download size={18} /> {t.exportResults}
                        </button>
                        <label className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 shadow-lg transition-transform hover:scale-105">
                             <FileSpreadsheet size={18} /> {t.uploadCsv}
                             <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
                        </label>
                     </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                     <div className="bg-white p-6 rounded-xl shadow-sm border">
                         <h3 className="text-gray-500 text-sm font-bold uppercase mb-2">{t.validIds}</h3>
                         <p className="text-4xl font-bold text-purple-600">{validStudentIds.length}</p>
                     </div>
                     <div className="bg-white p-6 rounded-xl shadow-sm border">
                         <h3 className="text-gray-500 text-sm font-bold uppercase mb-2">{t.registeredUsers}</h3>
                         <p className="text-4xl font-bold text-blue-600">{registeredUsers.length}</p>
                     </div>
                     <div className="bg-white p-6 rounded-xl shadow-sm border">
                         <h3 className="text-gray-500 text-sm font-bold uppercase mb-2">{t.online}</h3>
                         <p className="text-4xl font-bold text-green-600">{registeredUsers.filter(u => u.isOnline).length}</p>
                     </div>
                 </div>

                 <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-8">
                     <div className="px-6 py-4 border-b bg-gray-50">
                         <h3 className="font-bold text-gray-700">Student Status</h3>
                     </div>
                     <table className="w-full text-left">
                         <thead>
                             <tr className="text-sm text-gray-500 border-b">
                                 <th className="px-6 py-3 font-medium">Student</th>
                                 <th className="px-6 py-3 font-medium">ID</th>
                                 <th className="px-6 py-3 font-medium">Email</th>
                                 <th className="px-6 py-3 font-medium">Status</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y">
                             {registeredUsers.length === 0 && (
                                 <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">No students registered yet.</td></tr>
                             )}
                             {registeredUsers.map(u => (
                                 <tr key={u.id} className="hover:bg-gray-50">
                                     <td className="px-6 py-4 flex items-center gap-3">
                                         <img src={u.avatar} className="w-8 h-8 rounded-full" />
                                         <span className="font-medium">{u.name}</span>
                                     </td>
                                     <td className="px-6 py-4 text-gray-600 font-mono text-sm">{u.studentId}</td>
                                     <td className="px-6 py-4 text-gray-600">{u.email}</td>
                                     <td className="px-6 py-4">
                                         {u.isOnline ? (
                                             <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                                                 <span className="w-2 h-2 bg-green-500 rounded-full"></span> {t.online}
                                             </span>
                                         ) : (
                                             <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-bold">
                                                 {t.offline}
                                             </span>
                                         )}
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>

                 {/* PROJECT LIST SECTION */}
                 <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-700">Submitted Projects</h3>
                    </div>
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-sm text-gray-500 border-b">
                                <th className="px-6 py-3 font-medium">Project Title</th>
                                <th className="px-6 py-3 font-medium">Student</th>
                                <th className="px-6 py-3 font-medium">Progress</th>
                                <th className="px-6 py-3 font-medium">Score</th>
                                <th className="px-6 py-3 font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {allProjects.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No projects started yet.</td></tr>
                            )}
                            {allProjects.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-bold text-gray-800">{p.title}</td>
                                    <td className="px-6 py-4 text-gray-600">{p.studentName}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-1">
                                            {Object.values(p.stages).map((s, i) => (
                                                <div key={i} title={s.type} className={`w-3 h-3 rounded-full ${
                                                    s.status === 'APPROVED' ? 'bg-green-500' : 
                                                    s.status === 'SUBMITTED' ? 'bg-blue-500' :
                                                    s.status === 'IN_PROGRESS' ? 'bg-yellow-500' : 
                                                    s.status === 'REJECTED' ? 'bg-red-500' : 'bg-gray-200'
                                                }`} />
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono font-bold text-blue-600">{p.totalScore}/10</td>
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => {
                                                setProject(p);
                                                setView('GRADING');
                                            }}
                                            className="text-sm text-blue-600 hover:underline font-medium flex items-center gap-1"
                                        >
                                            <Eye size={16} /> Inspect / Grade
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
             </div>
          </div>
      );
  }

  if (view === 'SETUP') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md relative animate-in fade-in zoom-in duration-300">
           <div className="absolute top-4 right-4">
              <button onClick={() => setShowLogin(true)} className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1">
                 <Lock size={14} /> {t.instructorLogin}
              </button>
           </div>

          <div className="text-center mb-6">
             <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg">DT</div>
             <h1 className="text-3xl font-bold text-gray-800">{t.appTitle}</h1>
             <p className="text-gray-500">{t.slogan}</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t.projectName}</label>
              <input 
                type="text" 
                className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                value={setupData.title}
                onChange={e => setSetupData({...setupData, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t.studentName}</label>
              <input 
                type="text" 
                className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                value={setupData.name}
                onChange={e => setSetupData({...setupData, name: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t.email}</label>
                  <input 
                    type="email" 
                    className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    value={setupData.email}
                    onChange={e => setSetupData({...setupData, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t.studentId}</label>
                  <input 
                    type="text" 
                    maxLength={10}
                    className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    value={setupData.studentId}
                    onChange={e => setSetupData({...setupData, studentId: e.target.value})}
                  />
                </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t.projectType}</label>
              <select 
                className="mt-1 w-full p-2 border rounded-lg outline-none bg-white"
                value={setupData.type}
                onChange={e => setSetupData({...setupData, type: e.target.value})}
              >
                <option value="INDIVIDUAL">{t.individual}</option>
                <option value="GROUP">{t.group}</option>
              </select>
            </div>
            
            {setupError && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{setupError}</p>}

            <button 
              onClick={handleCreateProject}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-md hover:shadow-lg mt-2 flex items-center justify-center gap-2"
            >
              <Rocket size={18} /> {t.start}
            </button>
            
            {/* Language Toggle on Setup */}
            <div className="flex justify-center mt-4 pt-4 border-t">
                 <button onClick={() => setLanguage(l => l === 'en' ? 'vi' : 'en')} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <Globe size={14} /> {language === 'en' ? 'Switch to Vietnamese' : 'Switch to English'}
                 </button>
            </div>
          </div>
        </div>

        {/* Auth Modal */}
        {showLogin && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
                    <button onClick={() => setShowLogin(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Lock size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">{t.instructorLogin}</h2>
                    </div>
                    <form onSubmit={handleAdminLogin} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">{t.email}</label>
                            <input 
                                type="email" 
                                className="w-full p-2 border rounded-lg outline-none focus:border-purple-500"
                                value={loginEmail}
                                onChange={e => setLoginEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Password</label>
                            <input 
                                type="password" 
                                className="w-full p-2 border rounded-lg outline-none focus:border-purple-500"
                                value={loginPass}
                                onChange={e => setLoginPass(e.target.value)}
                            />
                        </div>
                        {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
                        <button type="submit" className="w-full bg-purple-600 text-white py-2 rounded-lg font-bold hover:bg-purple-700">
                            Login
                        </button>
                    </form>
                </div>
            </div>
        )}
      </div>
    );
  }

  // --- REPORT VIEW ---
  if (view === 'REPORT') {
      const stageKeys = Object.values(StageType);
      return (
          <div className="min-h-screen bg-gray-50 p-6">
              <div className="max-w-4xl mx-auto bg-white shadow-2xl rounded-xl overflow-hidden print:shadow-none">
                  <div className="bg-slate-900 text-white p-8 flex justify-between items-center">
                      <div>
                          <h1 className="text-3xl font-bold">Project Report</h1>
                          <p className="opacity-80">{project?.title}</p>
                      </div>
                      <div className="text-right">
                          <div className="text-4xl font-bold text-green-400">{project?.totalScore}<span className="text-xl text-white">/10</span></div>
                          <p className="text-sm opacity-75">Final Grade</p>
                      </div>
                  </div>
                  
                  <div className="p-8">
                      <div className="flex justify-between items-start mb-8">
                          <div>
                            <p className="font-semibold text-gray-600">{t.studentName}:</p>
                            <p className="text-xl font-bold text-gray-900">{project?.studentName}</p>
                            <p className="text-sm text-gray-500 font-mono">ID: {project?.studentId}</p>
                          </div>
                          <div className="bg-white p-2 border rounded-lg shadow-sm">
                              <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=Project:${project?.id}`} 
                                alt="Project QR" 
                                className="w-24 h-24"
                              />
                              <p className="text-[10px] text-center mt-1 text-gray-500">Scan to View</p>
                          </div>
                      </div>

                      <table className="w-full mb-8">
                          <thead>
                              <tr className="border-b-2 border-gray-200">
                                  <th className="text-left py-2 font-bold text-gray-600">{t.stage}</th>
                                  <th className="text-center py-2 font-bold text-gray-600">{t.weight}</th>
                                  <th className="text-center py-2 font-bold text-gray-600">{t.score}</th>
                                  <th className="text-right py-2 font-bold text-gray-600">Weighted</th>
                              </tr>
                          </thead>
                          <tbody>
                              {stageKeys.map(stage => {
                                  const data = project?.stages[stage];
                                  if(!data) return null;
                                  return (
                                      <tr key={stage} className="border-b border-gray-100">
                                          <td className="py-3 font-medium text-gray-800">{STAGE_CONFIG[stage].label}</td>
                                          <td className="text-center text-gray-500">{data.weight}%</td>
                                          <td className="text-center font-bold text-blue-600">{data.score}</td>
                                          <td className="text-right font-mono text-gray-700">{(data.score * (data.weight/100)).toFixed(2)}</td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                      
                      <div className="border-t pt-8 text-center print:hidden">
                           <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto">
                               <Download size={18} /> Download PDF / Print
                           </button>
                           <button onClick={() => setView('DASHBOARD')} className="mt-4 text-gray-500 underline text-sm">
                               {t.backToCycle}
                           </button>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
      <Header />
      
      {showSettings && <SettingsModal />}
      
      {isAnnotating && project && (
          <AnnotationCanvas 
            imageUrl={isAnnotating.url}
            initialAnnotations={
                project.stages[currentStage].options.find(o => o.id === isAnnotating.optionId)
                ?.assets.find(a => a.id === isAnnotating.assetId)?.annotations || []
            }
            readOnly={userRole === UserRole.STUDENT}
            onClose={() => setIsAnnotating(null)}
            onSave={(anns) => {
                const updated = {...project};
                const opt = updated.stages[currentStage].options.find(o => o.id === isAnnotating.optionId);
                const asset = opt?.assets.find(a => a.id === isAnnotating.assetId);
                if (asset) asset.annotations = anns;
                updateProjectState(updated);
            }}
          />
      )}

      <main className="flex-1 max-w-6xl mx-auto w-full p-4">
        {view === 'DASHBOARD' && project && (
          <div className="animate-fade-in">
             <div className="text-center mb-8">
                 <h2 className="text-2xl font-bold text-gray-800">{t.appTitle}</h2>
                 <p className="text-gray-500">{t.slogan}</p>
             </div>
             <DesignWheel 
                currentStage={currentStage}
                stagesStatus={Object.entries(project.stages).reduce((acc, [key, val]) => ({...acc, [key]: { status: val.status, score: val.score }}), {} as any)}
                onStageSelect={handleStageSelect}
             />
          </div>
        )}

        {view === 'STAGE_DETAIL' && project && (
          <div className="space-y-6">
            <button onClick={() => setView('DASHBOARD')} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
                ← {t.backToCycle}
            </button>
            
            <div className={`rounded-xl p-6 text-white shadow-lg ${STAGE_CONFIG[currentStage].bgColor}`}>
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                             {STAGE_CONFIG[currentStage].icon}
                             <h2 className="text-2xl font-bold">{STAGE_CONFIG[currentStage].label}</h2>
                        </div>
                        <p className="opacity-90">{STAGE_CONFIG[currentStage].description}</p>
                    </div>
                    <div className="text-right bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                        <p className="text-xs uppercase tracking-wider opacity-75">{t.weight}</p>
                        <p className="font-bold text-xl">{project.stages[currentStage].weight}%</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT: WORKSPACE */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Gemini Suggestion Box */}
                    {userRole === UserRole.STUDENT && project.stages[currentStage].status !== 'APPROVED' && (
                        <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-10"><Sparkles size={100} /></div>
                            <div className="relative z-10">
                                <h3 className="font-bold text-purple-700 flex items-center gap-2">
                                    <Sparkles size={16} /> {t.aiHelp}
                                </h3>
                                {!aiSuggestion ? (
                                    <button 
                                        onClick={handleGetAiHelp} 
                                        disabled={aiLoading}
                                        className="mt-2 text-sm text-purple-600 underline hover:text-purple-800"
                                    >
                                        {aiLoading ? 'Thinking...' : 'Get suggestions for this stage'}
                                    </button>
                                ) : (
                                    <div className="mt-2 text-sm text-gray-700 prose prose-sm max-w-none">
                                        <div dangerouslySetInnerHTML={{ __html: aiSuggestion.replace(/\n/g, '<br/>') }} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Options / Submissions */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                             <h3 className="font-bold text-gray-800">{t.workOptions}</h3>
                             {userRole === UserRole.STUDENT && project.stages[currentStage].status !== 'LOCKED' && project.stages[currentStage].status !== 'APPROVED' && (
                                 <button onClick={handleAddOption} className="text-sm flex items-center gap-1 text-blue-600 font-medium">
                                     <Plus size={16} /> {t.addOption}
                                 </button>
                             )}
                        </div>
                        
                        {project.stages[currentStage].options.length === 0 && (
                            <div className="p-8 text-center bg-gray-100 rounded-xl border border-dashed border-gray-300 text-gray-500">
                                No work submitted yet.
                            </div>
                        )}

                        {project.stages[currentStage].options.map((option, idx) => (
                            <div key={option.id} className="bg-white border rounded-xl p-4 shadow-sm">
                                <div className="flex justify-between mb-4">
                                    <h4 className="font-bold text-gray-700">{option.title}</h4>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {option.assets.map(asset => (
                                        <div 
                                            key={asset.id} 
                                            className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer border hover:border-blue-500 transition"
                                            onClick={() => setIsAnnotating({ url: asset.url, assetId: asset.id, optionId: option.id })}
                                        >
                                            {asset.type === 'image' ? (
                                                <img src={asset.url} className="w-full h-full object-cover" alt="asset" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400">PDF</div>
                                            )}
                                            {asset.annotations.length > 0 && (
                                                <div className="absolute top-1 right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                                                    {asset.annotations.length}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {userRole === UserRole.STUDENT && project.stages[currentStage].status !== 'APPROVED' && (
                                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer aspect-square">
                                            <Upload size={20} className="text-gray-400 mb-1" />
                                            <span className="text-xs text-gray-500">{t.upload}</span>
                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(option.id, e)} />
                                        </label>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: FEEDBACK & ACTION */}
                <div className="space-y-6">
                    {/* Checklist */}
                    <div className="bg-white p-4 rounded-xl border shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <CheckSquare size={16} /> {t.requirements}
                        </h3>
                        <div className="space-y-2">
                            {project.stages[currentStage].checklists.map(item => (
                                <div key={item.id} className="flex items-start gap-2">
                                    <input 
                                        type="checkbox" 
                                        checked={item.completed}
                                        disabled={userRole === UserRole.STUDENT}
                                        onChange={() => {
                                            if (userRole !== UserRole.INSTRUCTOR) return;
                                            const updated = {...project};
                                            const chk = updated.stages[currentStage].checklists.find(c => c.id === item.id);
                                            if(chk) chk.completed = !chk.completed;
                                            updateProjectState(updated);
                                        }}
                                        className="mt-1"
                                    />
                                    <span className={`text-sm ${item.completed ? 'text-gray-500 line-through' : 'text-gray-700'}`}>{item.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Instructor Feedback Box */}
                    <div className="bg-white p-4 rounded-xl border shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <MessageSquare size={16} /> {t.feedback}
                        </h3>
                        {userRole === UserRole.INSTRUCTOR ? (
                            <textarea 
                                className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-32"
                                placeholder="Write feedback here..."
                                value={project.stages[currentStage].instructorFeedback}
                                onChange={(e) => handleFeedbackUpdate(e.target.value)}
                            />
                        ) : (
                            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 min-h-[4rem]">
                                {project.stages[currentStage].instructorFeedback || "No feedback yet."}
                            </div>
                        )}
                        {aiAnalysis && userRole === UserRole.STUDENT && (
                            <div className="mt-2 p-2 bg-green-50 text-green-800 text-xs rounded border border-green-100">
                                <strong>AI Summary:</strong> {aiAnalysis}
                            </div>
                        )}
                    </div>

                    {/* Actions / Grading */}
                    <div className="bg-white p-4 rounded-xl border shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-3">{t.grading}</h3>
                        
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm text-gray-600">{t.score} (0-10)</span>
                            {userRole === UserRole.INSTRUCTOR ? (
                                <input 
                                    type="number" 
                                    min="0" max="10" 
                                    value={project.stages[currentStage].score}
                                    onChange={(e) => handleScoreUpdate(Number(e.target.value))}
                                    className="w-16 p-1 text-center border rounded font-bold"
                                />
                            ) : (
                                <span className="font-bold text-xl">{project.stages[currentStage].score}</span>
                            )}
                        </div>

                        {userRole === UserRole.STUDENT && project.stages[currentStage].status === 'IN_PROGRESS' && (
                            <button 
                                onClick={handleSubmitStage}
                                className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700"
                            >
                                {t.submit}
                            </button>
                        )}

                        {userRole === UserRole.INSTRUCTOR && (
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => handleStageVerdict(false)}
                                    className="bg-red-100 text-red-700 py-2 rounded-lg font-bold hover:bg-red-200"
                                >
                                    {t.reject}
                                </button>
                                <button 
                                    onClick={() => handleStageVerdict(true)}
                                    className="bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700"
                                >
                                    {t.approve}
                                </button>
                            </div>
                        )}
                        
                         {userRole === UserRole.STUDENT && project.stages[currentStage].status === 'APPROVED' && (
                             <div className="text-center text-green-600 font-bold py-2 bg-green-50 rounded-lg">
                                 Stage Approved
                             </div>
                         )}
                         {userRole === UserRole.STUDENT && project.stages[currentStage].status === 'REJECTED' && (
                             <div className="text-center text-red-600 font-bold py-2 bg-red-50 rounded-lg">
                                 Action Required
                             </div>
                         )}
                    </div>
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
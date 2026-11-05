import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useClients } from '../context/ClientContext';
import { LanguageSwitcherButton } from '../context/LanguageContext';
import {
  LogOut,
  Users,
  UserPlus,
  UserCheck,
  ShieldCheck,
  Menu,
  X,
  ChevronRight,
  BadgeCheck,
  Calendar,
  Building2,
  Landmark,
  Globe2,
  Building,
  Briefcase,
  FileText,
  TrendingUp,
  Mail,
  FileSpreadsheet,
  History,
} from 'lucide-react';
import { subscribeToAppointments } from '../services/firestoreSync';

export type ActiveTab =
  | 'profile'
  | 'clients'
  | 'add'
  | 'autoentrepreneur'
  | 'sarl_eurl'
  | 'registre_rc'
  | 'hors_wilaya'
  | 'suivi_bureau'
  | 'tarifs_dossiers'
  | 'team'
  | 'paie'
  | 'revenues'
  | 'appointments'
  | 'calendar'
  | 'gmail'
  | 'sheets'
  | 'logs';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export const Sidebar: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  mobileOpen = false,
  setMobileOpen,
}) => {
  const { user, logout, pendingEmployeesCount, isMasterAdmin } = useAuth();
  const { clients, logs: activityLogs } = useClients();
  const isAdmin = user?.role === 'Administrateur';

  // Live count for appointments & unread notifications
  const [appointmentsCount, setAppointmentsCount] = useState<number>(0);
  const [unreadAppointmentsCount, setUnreadAppointmentsCount] = useState<number>(0);

  useEffect(() => {
    const unsub = subscribeToAppointments((list) => {
      setAppointmentsCount(list.length);
      const unread = list.filter((a) => !a.notificationVue).length;
      setUnreadAppointmentsCount(unread);
    });
    return () => unsub();
  }, []);

  const rawNavItems: Array<{
    id: ActiveTab;
    label: string;
    subtitle?: string;
    icon: React.ReactNode;
    badge?: number | string;
    badgeAlert?: boolean;
    masterOnly?: boolean;
  }> = [
    {
      id: 'profile',
      label: isMasterAdmin ? 'Profil Administrateur' : 'Mon Profil Employé',
      icon: <UserCheck className="w-4 h-4" />,
      badge: isMasterAdmin && pendingEmployeesCount > 0 ? `${pendingEmployeesCount} att.` : undefined,
      badgeAlert: isMasterAdmin && pendingEmployeesCount > 0,
    },
    {
      id: 'appointments',
      label: 'Rendez-vous Clients',
      icon: <Calendar className="w-4 h-4" />,
      badge: unreadAppointmentsCount > 0 ? `${unreadAppointmentsCount} nouv.` : appointmentsCount > 0 ? appointmentsCount : undefined,
      badgeAlert: unreadAppointmentsCount > 0,
    },
    {
      id: 'clients',
      label: 'Liste des Clients',
      icon: <Users className="w-4 h-4" />,
      badge: clients.length,
    },
    {
      id: 'add',
      label: 'Ajouter un Client',
      icon: <UserPlus className="w-4 h-4" />,
    },
    {
      id: 'autoentrepreneur',
      label: 'Auto-Entrepreneur',
      icon: <BadgeCheck className="w-4 h-4" />,
      badge: clients.filter((c) => c.typeDossier === 'Auto-entrepreneur').length || undefined,
    },
    {
      id: 'sarl_eurl',
      label: 'SARL / EURL',
      icon: <Building2 className="w-4 h-4" />,
      badge: clients.filter((c) => c.typeDossier === 'Entreprise').length || undefined,
    },
    {
      id: 'registre_rc',
      label: 'Registre RC',
      icon: <Landmark className="w-4 h-4" />,
      badge: clients.filter((c) => c.typeDossier === 'RC').length || undefined,
    },
    {
      id: 'hors_wilaya',
      label: 'Hors Wilaya',
      icon: <Globe2 className="w-4 h-4" />,
      badge: clients.filter((c) => c.typeDossier === 'Inscription & Suivi (Hors Wilaya)').length || undefined,
    },
    {
      id: 'suivi_bureau',
      label: 'Suivi Bureau',
      icon: <Building className="w-4 h-4" />,
      badge: clients.filter((c) => c.typeDossier === 'Inscription & Suivi (Bureau)').length || undefined,
    },
    {
      id: 'tarifs_dossiers',
      label: 'Tarifs & Papiers (PDF)',
      icon: <FileText className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'team',
      label: 'Notre Équipe',
      icon: <Briefcase className="w-4 h-4" />,
      badge: isMasterAdmin && pendingEmployeesCount > 0 ? pendingEmployeesCount : undefined,
      badgeAlert: isMasterAdmin && pendingEmployeesCount > 0,
      masterOnly: true, // STRICTLY RESTRICTED TO zinemoh106@gmail.com
    },
    {
      id: 'paie',
      label: 'Fiches de Paie',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      id: 'revenues',
      label: 'Tableau des Revenus',
      icon: <TrendingUp className="w-4 h-4" />,
      masterOnly: true, // STRICTLY RESTRICTED TO zinemoh106@gmail.com
    },
    {
      id: 'calendar',
      label: 'Google Calendar',
      icon: <Calendar className="w-4 h-4 text-blue-400" />,
      subtitle: 'Agenda & Synchronisation',
    },
    {
      id: 'gmail',
      label: 'Messagerie Gmail',
      icon: <Mail className="w-4 h-4" />,
    },
    {
      id: 'sheets',
      label: 'Google Sheets',
      icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'logs',
      label: "Journal d'Activité",
      icon: <History className="w-4 h-4" />,
      badge: activityLogs.length > 0 ? activityLogs.length : undefined,
    },
  ];

  // Restrict 'team' and 'revenues' tabs exclusively to the Master Administrator email (zinemoh106@gmail.com)
  const navItems = rawNavItems.filter((item) => !item.masterOnly || isMasterAdmin);

  const handleSelect = (id: ActiveTab) => {
    setActiveTab(id);
    if (setMobileOpen) {
      setMobileOpen(false);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 w-[85vw] max-w-[300px] sm:w-68 shrink-0 select-none border-r border-slate-800">
      {/* Brand Header with Official SERVI-DOX Logo */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3">
        <button
          onClick={() => handleSelect('profile')}
          className="flex items-center gap-3 text-left group focus:outline-none min-w-0"
        >
          <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-xs">
            <img
              src="/assets/aistudio/Sans_titre_b7fbb046.png"
              alt="SERVI-DOX"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <span className="font-extrabold tracking-tight text-white text-base block leading-none truncate">
              SERVI-DOX
            </span>
            <span className="text-[11px] text-slate-400 font-medium block mt-1 truncate">
              Espace Administrateur
            </span>
          </div>
        </button>

        {setMobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden min-w-[42px] min-h-[42px] p-2 text-slate-300 hover:text-white bg-slate-800 rounded-xl flex items-center justify-center"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Administrator Summary Pill */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={() => handleSelect('profile')}
          className={`w-full p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
            activeTab === 'profile'
              ? 'bg-blue-600/20 border-blue-500/50 text-white'
              : 'bg-slate-800/70 border-slate-700/70 hover:bg-slate-800 text-slate-200'
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 border border-blue-400/40">
            {user?.avatarInitials || 'SD'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-white truncate">{user?.name}</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </div>
            <span className="text-[11px] text-slate-400 truncate block">{user?.email}</span>
          </div>
        </button>
      </div>

      {/* Navigation Links (All pages) */}
      <div className="px-3 py-2 flex-1 overflow-y-auto space-y-1">
        <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Menu Principal SERVI-DOX
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`w-full px-3 py-3 sm:py-2.5 rounded-xl text-left transition-all flex items-center justify-between gap-2.5 group ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                    isActive
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-800 text-slate-400 group-hover:text-white'
                  }`}
                >
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate leading-tight">{item.label}</div>
                  {item.subtitle && (
                    <div
                      className={`text-[10px] truncate mt-0.5 ${
                        isActive ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {item.subtitle}
                    </div>
                  )}
                </div>
              </div>

              {item.badge !== undefined ? (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold shrink-0 ${
                    item.badgeAlert
                      ? 'bg-amber-400 text-slate-950 animate-pulse'
                      : isActive
                      ? 'bg-white text-blue-700'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              ) : (
                <ChevronRight
                  className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                    isActive ? 'text-white translate-x-0.5' : 'text-slate-600 group-hover:text-slate-400'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Logout Action */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <button
          onClick={logout}
          className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-300 hover:text-white hover:bg-rose-600/80 border border-rose-500/20 hover:border-rose-500 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Static Lateral Menu */}
      <aside className="hidden lg:block h-screen sticky top-0 shrink-0 print:hidden">{sidebarContent}</aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setMobileOpen && setMobileOpen(false)}
          />
          <div className="relative z-10 h-full max-w-[85vw]">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};

export const Navbar: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  setMobileOpen,
}) => {
  const { user, logout, pendingEmployeesCount, isMasterAdmin } = useAuth();

  const tabTitles: Record<ActiveTab, string> = {
    profile: isMasterAdmin ? 'Profil Administrateur' : 'Mon Profil Employé',
    clients: 'Liste & Contrôle des Clients',
    add: 'Ajouter un Client',
    autoentrepreneur: 'Auto-Entrepreneurs & CASNOS',
    sarl_eurl: 'Dossiers SARL & EURL (100 000 DA)',
    registre_rc: 'Registre du Commerce RC (50 000 DA)',
    hors_wilaya: 'Clients Hors Wilaya (15 000 DA)',
    suivi_bureau: 'Suivi au Bureau (12 000 DA)',
    tarifs_dossiers: 'Tarifs & Papiers (PDF)',
    team: 'Notre Équipe — Employés',
    paie: 'Fiches de Paie & Bilans',
    revenues: 'Tableau des Revenus (DA)',
    appointments: 'Rendez-vous Clients',
    calendar: 'Google Calendar — Planning',
    gmail: 'Messagerie Gmail',
    sheets: 'Google Sheets — Tableurs',
    logs: "Journal d'Activité",
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 h-14 sm:h-15 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 w-full max-w-full print:hidden">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {setMobileOpen && (
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden min-w-[42px] min-h-[42px] p-2 text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center shrink-0"
            aria-label="Ouvrir le menu latéral"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <span className="text-xs sm:text-base font-extrabold text-slate-900 truncate block">
            {tabTitles[activeTab]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <LanguageSwitcherButton variant="light" />

        {isMasterAdmin && pendingEmployeesCount > 0 && (
          <button
            onClick={() => setActiveTab('profile')}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-bold transition-colors shadow-2xs shrink-0"
          >
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
            <span>
              {pendingEmployeesCount} employé{pendingEmployeesCount > 1 ? 's' : ''} à valider
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('profile')}
          className="flex items-center gap-2 px-1.5 sm:px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition-colors text-left shrink-0"
          title="Accéder au Profil"
        >
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[150px]">
              {user?.name}
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold leading-tight">
              {user?.jobTitle || user?.role || 'Administrateur'}
            </span>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
            {user?.avatarInitials || 'SD'}
          </div>
        </button>

        <button
          onClick={logout}
          title="Se déconnecter"
          className="min-w-[40px] min-h-[40px] p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center justify-center shrink-0"
          aria-label="Se déconnecter"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

/**
 * Barre de Navigation Tactile Basse pour iPhone & Android (zone du pouce)
 */
export const MobileBottomNav: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  setMobileOpen,
}) => {
  const { clients } = useClients();

  const items: Array<{
    id: ActiveTab | 'menu_drawer';
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      id: 'profile',
      label: 'Profil',
      icon: <UserCheck className="w-5 h-5" />,
    },
    {
      id: 'clients',
      label: 'Clients',
      icon: <Users className="w-5 h-5" />,
      badge: clients.length > 0 ? clients.length : undefined,
    },
    {
      id: 'add',
      label: '+ Ajouter',
      icon: <UserPlus className="w-5 h-5" />,
    },
    {
      id: 'appointments',
      label: 'RDV',
      icon: <Calendar className="w-5 h-5" />,
    },
    {
      id: 'menu_drawer',
      label: 'Menu',
      icon: <Menu className="w-5 h-5" />,
    },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center h-16 px-1 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] print:hidden"
      aria-label="Navigation mobile rapide"
    >
      {items.map((item) => {
        const isMenuTrigger = item.id === 'menu_drawer';
        const isActive = !isMenuTrigger && activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (isMenuTrigger) {
                if (setMobileOpen) setMobileOpen(true);
              } else {
                setActiveTab(item.id as ActiveTab);
                if (setMobileOpen) setMobileOpen(false);
              }
            }}
            className={`relative flex flex-col items-center justify-center h-14 rounded-xl transition-all cursor-pointer ${
              isActive
                ? 'text-blue-700 bg-blue-50/90 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 font-semibold'
            }`}
          >
            <div className="relative">
              {item.icon}
              {item.badge !== undefined && (
                <span className="absolute -top-1.5 -right-3 px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[9px] font-mono font-bold leading-tight">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full px-0.5">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};


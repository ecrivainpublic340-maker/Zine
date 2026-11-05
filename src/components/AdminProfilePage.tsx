import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, RegisteredUserRecord } from '../context/AuthContext';
import { useClients } from '../context/ClientContext';
import { TypeDossier, TARIFS_SERVIDOX_DA } from '../types/client';
import { formatDA, getEmployeeWhatsAppUrl, getWhatsAppUrl } from '../utils/format';
import { ActiveTab } from './Navbar';
import {
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  Users,
  UserPlus,
  TrendingUp,
  History,
  Lock,
  Download,
  Trash2,
  ArrowRight,
  Calendar,
  LogOut,
  FolderKanban,
  Check,
  Clock,
  XCircle,
  MessageCircle,
  Briefcase,
  FileText,
  KeyRound,
  Eye,
  EyeOff,
  Plus,
  Edit3,
  RefreshCw,
  Search,
} from 'lucide-react';

interface AdminProfilePageProps {
  onNavigate: (tab: ActiveTab) => void;
}

export const AdminProfilePage: React.FC<AdminProfilePageProps> = ({ onNavigate }) => {
  const {
    user,
    registeredUsers,
    pendingEmployeesCount,
    securityPassword,
    updateSecurityPassword,
    requirePasswordConfirmation,
    createUserInsideApp,
    updateUserInsideApp,
    approveUserAccount,
    rejectUserAccount,
    deleteUserAccount,
    updateProfile,
    loginWithGoogle,
    logout,
    isMasterAdmin,
  } = useAuth();
  const {
    clients,
    logs: activityLogs,
    addClient,
    deleteClient,
    exportCSV,
    showToast,
  } = useClients();
  const isAdmin = user?.role === 'Administrateur' || isMasterAdmin;

  // Form states for editing admin profile
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [cabinetName, setCabinetName] = useState(user?.cabinetName || 'SERVI-DOX');
  const [address, setAddress] = useState(user?.address || 'Alger, Algérie');
  const [newPassword, setNewPassword] = useState('');

  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Security password state
  const [newSecPassword, setNewSecPassword] = useState(securityPassword);
  const [showSecPassword, setShowSecPassword] = useState(false);

  // Create User Profile Inside Site Modal / Form state
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPwd, setShowNewUserPwd] = useState(false);
  const [newUserPhoneCode, setNewUserPhoneCode] = useState('+213');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<RegisteredUserRecord['role']>('Employé');
  const [newUserJobTitle, setNewUserJobTitle] = useState('Gestionnaire Dossiers SERVI-DOX');
  const [userFormError, setUserFormError] = useState<string | null>(null);

  // Edit User Password / Role inline state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserJobTitle, setEditUserJobTitle] = useState('');
  const [editUserRole, setEditUserRole] = useState<RegisteredUserRecord['role']>('Employé');

  // Create Client Profile Inside Site state
  const [showCreateClientForm, setShowCreateClientForm] = useState(false);
  const [clientNom, setClientNom] = useState('');
  const [clientPrenom, setClientPrenom] = useState('');
  const [clientPhoneCode, setClientPhoneCode] = useState('+213');
  const [clientContact, setClientContact] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientVille, setClientVille] = useState('16 - Alger');
  const [clientTypeDossier, setClientTypeDossier] = useState<TypeDossier>('Auto-entrepreneur');
  const [clientMontantTotal, setClientMontantTotal] = useState<number>(40000);
  const [clientMontantEncaisse, setClientMontantEncaisse] = useState<number>(40000);
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => {
    setNewSecPassword(securityPassword);
  }, [securityPassword]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setCabinetName(user.cabinetName || 'SERVI-DOX');
      setAddress(user.address || 'Alger, Algérie');
    }
  }, [user]);

  const stats = useMemo(() => {
    const totalClients = clients.length;
    const dossiersEnCours = clients.filter((c) => c.statut === 'En cours').length;
    const dossiersValides = clients.filter((c) => c.statut === 'Validé').length;
    const totalFacture = clients.reduce((sum, c) => sum + (c.montantTotal || 0), 0);
    const totalEncaisse = clients.reduce((sum, c) => sum + (c.montantEncaisse || 0), 0);
    const totalReste = clients.reduce(
      (sum, c) =>
        sum +
        (c.montantReste !== undefined
          ? c.montantReste
          : Math.max(0, (c.montantTotal || 0) - (c.montantEncaisse || 0))),
      0
    );

    return {
      totalClients,
      dossiersEnCours,
      dossiersValides,
      totalFacture,
      totalEncaisse,
      totalReste,
    };
  }, [clients]);

  const filteredClientsPreview = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 12);
    const q = clientSearch.toLowerCase().trim();
    return clients
      .filter(
        (c) =>
          `${c.nom} ${c.prenom}`.toLowerCase().includes(q) ||
          (c.contact || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.typeDossier || '').toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [clients, clientSearch]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);
    setErrorMessage(null);

    if (newPassword && newPassword.trim().length > 0 && newPassword.trim().length < 4) {
      setErrorMessage('Le nouveau mot de passe doit contenir au moins 4 caractères.');
      return;
    }

    requirePasswordConfirmation(
      `Enregistrer les modifications du profil (${name})`,
      () => {
        const res = updateProfile(
          {
            name,
            email,
            phone,
            cabinetName,
            address,
          },
          newPassword.trim() || undefined
        );

        if (res.success) {
          setNewPassword('');
          setSaveMessage('Profil mis à jour et synchronisé sur tous vos PC.');
          showToast('Profil mis à jour', 'Vos informations ont été enregistrées sur le Cloud.');
          setTimeout(() => setSaveMessage(null), 4000);
        } else {
          setErrorMessage(res.error || 'Erreur lors de la mise à jour du profil.');
        }
      }
    );
  };

  const handleSaveSecurityPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecPassword || newSecPassword.trim().length < 4) {
      showToast(
        'Mot de passe trop court',
        'Le mot de passe de sécurité doit comporter au moins 4 caractères.',
        'error'
      );
      return;
    }
    requirePasswordConfirmation(
      'Modifier le mot de passe de sécurité global des données (Ajout / Suppression)',
      () => {
        const res = updateSecurityPassword(newSecPassword.trim());
        if (res.success) {
          showToast(
            'Mot de passe de sécurité mis à jour',
            'Ce nouveau mot de passe protège désormais les données sur tous vos PC.',
            'success'
          );
        } else {
          showToast('Erreur', res.error || 'Impossible de modifier le mot de passe.', 'error');
        }
      }
    );
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);

    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setUserFormError('Veuillez remplir le nom, l’adresse email et le mot de passe.');
      return;
    }
    if (newUserPassword.trim().length < 4) {
      setUserFormError('Le mot de passe doit contenir au moins 4 caractères.');
      return;
    }

    const fullPhone = newUserPhone.trim()
      ? `${newUserPhoneCode} ${newUserPhone.trim().replace(/^0+/, '')}`
      : '';

    requirePasswordConfirmation(
      `Créer le profil utilisateur : ${newUserName.trim()} (${newUserRole})`,
      () => {
        const res = createUserInsideApp({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword.trim(),
          phone: fullPhone,
          role: newUserRole,
          jobTitle: newUserJobTitle.trim() || newUserRole,
        });

        if (!res.success) {
          setUserFormError(res.error || 'Erreur lors de la création du profil.');
          showToast('Erreur', res.error || 'Erreur lors de la création.', 'error');
        } else {
          showToast(
            'Profil Utilisateur créé !',
            `Le profil de ${newUserName.trim()} est actif et synchronisé sur tous vos PC.`,
            'success'
          );
          setNewUserName('');
          setNewUserEmail('');
          setNewUserPassword('');
          setNewUserPhone('');
          setShowCreateUserForm(false);
        }
      }
    );
  };

  const handleSaveUserEdit = (u: RegisteredUserRecord) => {
    requirePasswordConfirmation(
      `Modifier le profil utilisateur de ${u.name}`,
      () => {
        const res = updateUserInsideApp(u.id, {
          role: editUserRole,
          jobTitle: editUserJobTitle.trim() || u.jobTitle,
          ...(editUserPassword.trim().length >= 4 ? { password: editUserPassword.trim() } : {}),
        });
        if (res.success) {
          showToast(
            'Profil modifié',
            `Les informations de ${u.name} ont été mises à jour sur le Cloud.`,
            'success'
          );
          setEditingUserId(null);
          setEditUserPassword('');
        }
      }
    );
  };

  const handleDeleteUserWithPassword = (u: RegisteredUserRecord) => {
    requirePasswordConfirmation(
      `Supprimer définitivement le profil utilisateur : ${u.name} (${u.email})`,
      () => {
        deleteUserAccount(u.id);
        showToast(
          'Profil utilisateur supprimé',
          `Le compte de ${u.name} a été supprimé sur tous vos appareils.`,
          'warning'
        );
      }
    );
  };

  const handleCreateClientInsideSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientNom.trim() || !clientPrenom.trim() || !clientContact.trim()) {
      showToast(
        'Champs requis',
        'Veuillez renseigner le Nom, Prénom et Téléphone du client.',
        'error'
      );
      return;
    }

    const fullContact = `${clientPhoneCode} ${clientContact.trim().replace(/^0+/, '')}`;
    const reste = Math.max(0, Number(clientMontantTotal) - Number(clientMontantEncaisse));

    requirePasswordConfirmation(
      `Créer le profil client : ${clientNom.trim().toUpperCase()} ${clientPrenom.trim()} (${clientTypeDossier})`,
      () => {
        addClient({
          nom: clientNom.trim(),
          prenom: clientPrenom.trim(),
          dateInscription: new Date().toISOString().split('T')[0],
          adresse: clientVille,
          ville: clientVille,
          codePostal: '16000',
          email: clientEmail.trim(),
          contact: fullContact,
          typeDossier: clientTypeDossier,
          motifDossier: `Dossier ${clientTypeDossier} créé depuis le Panneau de Gestion`,
          statut: 'En cours',
          montantTotal: Number(clientMontantTotal) || 0,
          montantEncaisse: Number(clientMontantEncaisse) || 0,
          montantReste: reste,
          notes: '',
        });

        setClientNom('');
        setClientPrenom('');
        setClientContact('');
        setClientEmail('');
        setShowCreateClientForm(false);
      }
    );
  };

  const formattedRegDate = user?.registeredAt
    ? new Date(user.registeredAt).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : "Aujourd'hui";

  const isGmailAccount =
    user?.authProvider === 'gmail' ||
    (user?.email && user.email.toLowerCase().endsWith('@gmail.com'));

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-5 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Top Hero Banner: Administrator or Employee Welcome */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-8 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
        <div className="flex items-start sm:items-center gap-3.5 sm:gap-5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center">
              <img
                src="/assets/aistudio/Sans_titre_b7fbb046.png"
                alt="SERVI-DOX"
                className="w-full h-full object-contain"
              />
            </div>
            <span
              className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 border-2 border-slate-900"
              title="Synchronisé Cloud Multi-PC"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {isAdmin
                    ? 'Profil Administrateur Principal'
                    : `Collaborateur · ${user?.jobTitle || 'SERVI-DOX'}`}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                <span>Sync Multi-PC</span>
              </span>
              {isGmailAccount && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span>Gmail</span>
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight mt-1.5 break-words">
              Bienvenue, {user?.name || 'Administrateur SERVI-DOX'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5 break-all sm:break-normal">
              {user?.email} · Contrôle Multi-PC & Mobile
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setShowCreateUserForm(true)}
            className="min-h-[44px] w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-slate-900 shrink-0" />
            <span>+ Créer Profil Utilisateur</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateClientForm(true)}
            className="min-h-[44px] w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>+ Créer Profil Client</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          SECTION 1: SÉCURITÉ & MOT DE PASSE DES DONNÉES (MULTI-PC)
          ===================================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-blue-800/50">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-bold">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Protection des Données & Synchronisation Multi-PC</span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
              Mot de Passe de Sécurité pour l'Ajout et la Suppression des Données
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Toute création ou suppression de client, de dossier, d'auto-entrepreneur, d'employé ou
              de profil utilisateur demande ce mot de passe. Il est synchronisé instantanément sur
              tous vos ordinateurs via Cloud Firestore.
            </p>
          </div>

          <form
            onSubmit={handleSaveSecurityPassword}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0"
          >
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showSecPassword ? 'text' : 'password'}
                value={newSecPassword}
                onChange={(e) => setNewSecPassword(e.target.value)}
                placeholder="Mot de passe sécurité..."
                className="w-full sm:w-56 pl-9 pr-9 py-2.5 text-xs font-mono font-bold bg-slate-950/90 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="button"
                onClick={() => setShowSecPassword(!showSecPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                title={showSecPassword ? 'Masquer' : 'Afficher'}
              >
                {showSecPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="submit"
              className="px-4 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Mettre à jour le mot de passe</span>
            </button>
          </form>
        </div>
      </div>

      {/* =====================================================================
          SECTION 2: GESTION DES PROFILS UTILISATEURS (CRÉER / MODIFIER / SUPPRIMER)
          ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Gestion des Profils Utilisateurs (Créer & Supprimer à l'intérieur du site)
                </h2>
                <span className="px-2.5 py-0.5 text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                  {registeredUsers.length} profil{registeredUsers.length > 1 ? 's' : ''} enregistré
                  {registeredUsers.length > 1 ? 's' : ''}
                </span>
                {pendingEmployeesCount > 0 && (
                  <span className="px-2.5 py-0.5 text-[11px] font-bold bg-amber-500 text-white rounded-full animate-pulse">
                    {pendingEmployeesCount} en attente
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Créez directement des comptes utilisateurs (Administrateur, Gérant, Secrétaire,
                Gestionnaire, Employé, Client), modifiez leurs mots de passe ou supprimez-les.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCreateUserForm(!showCreateUserForm)}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>
                {showCreateUserForm ? 'Fermer le formulaire' : '+ Créer un Profil Utilisateur'}
              </span>
            </button>
          </div>
        </div>

        {/* Formulaire de Création Directe d'un Profil Utilisateur */}
        {showCreateUserForm && (
          <form
            onSubmit={handleCreateUserSubmit}
            className="p-5 rounded-2xl bg-slate-50 border border-blue-200 space-y-4 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                  Nouveau Profil Utilisateur (Actif immédiatement sur tous les PC)
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Protégé par mot de passe
              </span>
            </div>

            {userFormError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{userFormError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nom et Prénom *
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Ex: Karim Benali"
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Adresse Email de Connexion *
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="utilisateur@gmail.com"
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mot de passe du compte *
                </label>
                <div className="relative">
                  <input
                    type={showNewUserPwd ? 'text' : 'password'}
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Min. 4 caractères"
                    className="w-full pl-3 pr-9 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPwd(!showNewUserPwd)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showNewUserPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Téléphone / WhatsApp
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={newUserPhoneCode}
                    onChange={(e) => setNewUserPhoneCode(e.target.value)}
                    className="px-2 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-800"
                  >
                    <option value="+213">🇩🇿 +213</option>
                    <option value="+33">🇫🇷 +33</option>
                    <option value="+1">🇨🇦 +1</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+216">🇹🇳 +216</option>
                    <option value="+212">🇲🇦 +212</option>
                  </select>
                  <input
                    type="tel"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    placeholder="0550 12 34 56"
                    className="flex-1 px-3 py-2 text-xs sm:text-sm font-mono border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Type de Profil / Accès *
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) =>
                    setNewUserRole(e.target.value as RegisteredUserRecord['role'])
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="Employé">Collaborateur / Employé</option>
                  <option value="Gestionnaire Dossiers">Gestionnaire de Dossiers</option>
                  <option value="Conseiller Client">Conseiller Client</option>
                  <option value="Administrateur">Administrateur</option>
                  <option value="Client">Profil Client</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Poste / Fonction affichée
                </label>
                <select
                  value={newUserJobTitle}
                  onChange={(e) => setNewUserJobTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="Gestionnaire Dossiers SERVI-DOX">
                    Gestionnaire Dossiers SERVI-DOX
                  </option>
                  <option value="Gérant">Gérant</option>
                  <option value="PDG">PDG</option>
                  <option value="Secrétaire">Secrétaire</option>
                  <option value="Assistante Administrative">Assistante Administrative</option>
                  <option value="Responsable de Dossier">Responsable de Dossier</option>
                  <option value="Client SERVI-DOX">Client SERVI-DOX</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateUserForm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Créer & Valider ce Profil Utilisateur</span>
              </button>
            </div>
          </form>
        )}

        {/* Liste complète des Profils Utilisateurs */}
        {registeredUsers.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
            Aucun profil utilisateur supplémentaire enregistré. Cliquez sur{' '}
            <strong>« + Créer un Profil Utilisateur »</strong> pour en ajouter un directement.
          </div>
        ) : (
          <div className="space-y-2.5">
            {registeredUsers.map((empUser) => {
              const isPending = empUser.accountStatus === 'pending';
              const isApproved = empUser.accountStatus === 'approved';
              const isEditingThis = editingUserId === empUser.id;
              const waUrl = empUser.phone
                ? getEmployeeWhatsAppUrl(empUser.phone, empUser.name, empUser.jobTitle)
                : '#';

              return (
                <div
                  key={empUser.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isPending
                      ? 'bg-amber-50/60 border-amber-300 shadow-xs'
                      : isApproved
                      ? 'bg-slate-50/80 border-slate-200'
                      : 'bg-rose-50/40 border-rose-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 ${
                          empUser.role === 'Administrateur'
                            ? 'bg-slate-900 text-amber-300 border border-slate-700'
                            : isPending
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isApproved
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {empUser.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .substring(0, 2)
                          .toUpperCase()}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{empUser.name}</span>
                          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {empUser.role} · {empUser.jobTitle || 'SERVI-DOX'}
                          </span>
                          {isPending && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3" />
                              En attente
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              Actif
                            </span>
                          )}
                          {empUser.accountStatus === 'rejected' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                              <XCircle className="w-3 h-3" />
                              Suspendu
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                          <span className="flex items-center gap-1 font-medium">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            {empUser.email}
                          </span>
                          {empUser.phone && (
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {empUser.phone}
                            </span>
                          )}
                          {empUser.password && (
                            <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                              MDP: {empUser.password}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {empUser.phone && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}

                      {!isApproved && (
                        <button
                          type="button"
                          onClick={() => {
                            requirePasswordConfirmation(
                              `Valider et activer le compte de ${empUser.name}`,
                              () => {
                                approveUserAccount(empUser.id);
                                showToast(
                                  'Compte validé !',
                                  `${empUser.name} peut maintenant se connecter.`,
                                  'success'
                                );
                              }
                            );
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Valider</span>
                        </button>
                      )}

                      {isApproved && (
                        <button
                          type="button"
                          onClick={() => {
                            requirePasswordConfirmation(
                              `Suspendre l'accès de ${empUser.name}`,
                              () => {
                                rejectUserAccount(empUser.id);
                                showToast(
                                  'Accès suspendu',
                                  `L'accès de ${empUser.name} a été suspendu.`,
                                  'warning'
                                );
                              }
                            );
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Suspendre</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingThis) {
                            setEditingUserId(null);
                          } else {
                            setEditingUserId(empUser.id);
                            setEditUserRole(empUser.role);
                            setEditUserJobTitle(empUser.jobTitle || '');
                            setEditUserPassword(empUser.password || '');
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                        title="Modifier mot de passe ou rôle"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Modifier</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteUserWithPassword(empUser)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                        title="Supprimer ce profil utilisateur"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer</span>
                      </button>
                    </div>
                  </div>

                  {/* Panneau d'édition rapide du profil utilisateur */}
                  {isEditingThis && (
                    <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Rôle du profil
                        </label>
                        <select
                          value={editUserRole}
                          onChange={(e) =>
                            setEditUserRole(e.target.value as RegisteredUserRecord['role'])
                          }
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="Employé">Employé</option>
                          <option value="Gestionnaire Dossiers">Gestionnaire Dossiers</option>
                          <option value="Conseiller Client">Conseiller Client</option>
                          <option value="Administrateur">Administrateur</option>
                          <option value="Client">Client</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Poste / Fonction
                        </label>
                        <input
                          type="text"
                          value={editUserJobTitle}
                          onChange={(e) => setEditUserJobTitle(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Nouveau Mot de Passe
                        </label>
                        <input
                          type="text"
                          value={editUserPassword}
                          onChange={(e) => setEditUserPassword(e.target.value)}
                          placeholder="Nouveau mot de passe..."
                          className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveUserEdit(empUser)}
                          className="flex-1 py-1.5 px-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingUserId(null)}
                          className="py-1.5 px-2.5 text-xs font-semibold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors cursor-pointer"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =====================================================================
          SECTION 3: GESTION DIRECTE DES PROFILS CLIENTS (CRÉER & SUPPRIMER)
          ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Gestion Directe des Profils Clients (Créer & Supprimer avec Mot de Passe)
                </h2>
                <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                  {clients.length} client{clients.length > 1 ? 's' : ''} actif
                  {clients.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Ajoutez ou supprimez rapidement un profil client directement depuis cette page.
                Toutes les modifications sont synchronisées sur tous vos ordinateurs.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCreateClientForm(!showCreateClientForm)}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {showCreateClientForm ? 'Fermer le formulaire' : '+ Créer un Profil Client'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('clients')}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Voir tous les détails ({clients.length})
            </button>
          </div>
        </div>

        {/* Formulaire de Création Directe d'un Profil Client */}
        {showCreateClientForm && (
          <form
            onSubmit={handleCreateClientInsideSite}
            className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-4 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between border-b border-emerald-200/80 pb-3">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                Créer un Nouveau Profil & Dossier Client
              </h3>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Synchronisation Cloud Multi-PC
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nom *</label>
                <input
                  type="text"
                  required
                  value={clientNom}
                  onChange={(e) => setClientNom(e.target.value)}
                  placeholder="Ex: MANSOURI"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prénom *</label>
                <input
                  type="text"
                  required
                  value={clientPrenom}
                  onChange={(e) => setClientPrenom(e.target.value)}
                  placeholder="Ex: Amine"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Téléphone / WhatsApp *
                </label>
                <div className="flex gap-1">
                  <select
                    value={clientPhoneCode}
                    onChange={(e) => setClientPhoneCode(e.target.value)}
                    className="px-2 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="+213">🇩🇿 +213</option>
                    <option value="+33">🇫🇷 +33</option>
                    <option value="+1">🇨🇦 +1</option>
                  </select>
                  <input
                    type="tel"
                    required
                    value={clientContact}
                    onChange={(e) => setClientContact(e.target.value)}
                    placeholder="0550 12 34 56"
                    className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@gmail.com"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Type de Dossier *
                </label>
                <select
                  value={clientTypeDossier}
                  onChange={(e) => {
                    const t = e.target.value as TypeDossier;
                    setClientTypeDossier(t);
                    const tarif = TARIFS_SERVIDOX_DA[t] ?? 40000;
                    setClientMontantTotal(tarif);
                    setClientMontantEncaisse(tarif);
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  <option value="Auto-entrepreneur">Auto-entrepreneur (40 000 DA)</option>
                  <option value="Entreprise">Société SARL / EURL (100 000 DA)</option>
                  <option value="RC">Registre du Commerce RC (50 000 DA)</option>
                  <option value="Inscription & Suivi (Hors Wilaya)">
                    Suivi Hors Wilaya (15 000 DA)
                  </option>
                  <option value="Inscription & Suivi (Bureau)">Suivi Bureau (12 000 DA)</option>
                  <option value="Autre dossier">Autre dossier</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Wilaya / Ville
                </label>
                <input
                  type="text"
                  value={clientVille}
                  onChange={(e) => setClientVille(e.target.value)}
                  placeholder="16 - Alger"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Montant Total (DA)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={clientMontantTotal}
                  onChange={(e) => setClientMontantTotal(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-800 mb-1">
                  Montant Encaissé (DA)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={clientMontantEncaisse}
                  onChange={(e) => setClientMontantEncaisse(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono font-bold text-emerald-800 border border-emerald-300 rounded-xl bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateClientForm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirmer avec Mot de Passe & Enregistrer</span>
              </button>
            </div>
          </form>
        )}

        {/* Barre de recherche et liste rapide des clients pour suppression / contrôle */}
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Rechercher un profil client à contrôler ou supprimer..."
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {filteredClientsPreview.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
              Aucun profil client trouvé.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filteredClientsPreview.map((c) => {
                const waClient = c.contact
                  ? getWhatsAppUrl(c.contact, `${c.prenom} ${c.nom}`, c.motifDossier, c.montantReste)
                  : '#';
                return (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-all flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-900 truncate">
                          {c.nom.toUpperCase()} {c.prenom}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                          {c.typeDossier}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                        <span className="font-mono">{c.contact}</span>
                        <span>·</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {formatDA(c.montantEncaisse)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {c.contact && (
                        <a
                          href={waClient}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteClient(c.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                        title="Supprimer ce profil client (Mot de passe requis)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Real-time Cabinet KPIs in Algerian Dinars (DA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('clients')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-400 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Dossiers Clients</span>
            <FolderKanban className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
              {stats.totalClients}
            </span>
            <span className="text-[11px] font-semibold text-blue-600">
              {stats.dossiersEnCours} en cours
            </span>
          </div>
        </div>

        <div
          onClick={() => isMasterAdmin && onNavigate('revenues')}
          className={`bg-white border border-slate-200 rounded-xl p-4 shadow-xs transition-all ${
            isMasterAdmin ? 'hover:border-emerald-400 cursor-pointer' : 'cursor-default'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold">
            <span>Total Encaissé (DA)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-emerald-700 font-mono tabular-nums">
              {formatDA(stats.totalEncaisse)}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium">C.A. perçu</span>
          </div>
        </div>

        <div
          onClick={() => isMasterAdmin && onNavigate('revenues')}
          className={`bg-white border border-slate-200 rounded-xl p-4 shadow-xs transition-all ${
            isMasterAdmin ? 'hover:border-amber-400 cursor-pointer' : 'cursor-default'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700 text-xs font-semibold">
            <span>Reste à Payer (DA)</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-amber-700 font-mono tabular-nums">
              {formatDA(stats.totalReste)}
            </span>
            <span className="text-[11px] text-amber-600 font-medium">à recouvrer</span>
          </div>
        </div>

        <div
          onClick={() => onNavigate('logs')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-slate-400 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Activités Récentes</span>
            <History className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
              {activityLogs.length}
            </span>
            <span className="text-[11px] text-slate-500">actions journalisées</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left = Edit Profile Form, Right = Quick Navigation & Account Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Edit Administrator Profile */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Informations de Mon Profil ({user?.role || 'Administrateur'})
              </h2>
              <p className="text-xs text-slate-500">
                Modifiez vos coordonnées et vos paramètres de compte en temps réel
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
              {user?.avatarInitials || 'SD'}
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
            {saveMessage && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-800 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{saveMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-800 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom complet *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Votre nom et prénom"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adresse Gmail / Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre.email@gmail.com"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-700"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Téléphone / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: 0550 12 34 56"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-700 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom du Cabinet / Entreprise
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={cabinetName}
                    onChange={(e) => setCabinetName(e.target.value)}
                    placeholder="SERVI-DOX"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-700"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Wilaya / Adresse du Cabinet
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Alger, Algérie"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nouveau mot de passe (optionnel)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Laisser vide pour conserver"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-700"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Membre depuis : {formattedRegDate}</span>
              </div>

              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer mon profil</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: All Pages Directory & Database Controls */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Access to all pages */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Accès Rapide aux Modules SERVI-DOX
            </h3>
            <p className="text-xs text-slate-500">
              Toutes vos pages sont synchronisées en temps réel sur l'ensemble de vos ordinateurs.
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => onNavigate('clients')}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                      Liste des Clients & Dossiers
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Recherche et modification en temps réel + WhatsApp
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              </button>

              <button
                onClick={() => onNavigate('add')}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">
                      Ajouter un Nouveau Client
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Auto-entrepreneur, RC, Entreprise, Autre dossier (en DA)
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
              </button>

              <button
                onClick={() => onNavigate('autoentrepreneur')}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">
                      Offre & Suivi Auto-Entrepreneur
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Suivi Bureau (12 000 DA), Hors Wilaya (15 000 DA), CASNOS, Impôts & Banques
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
              </button>

              <button
                onClick={() => onNavigate('team')}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-amber-500 hover:bg-amber-50/40 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-amber-700">
                      Notre Équipe (Employés & Horaires)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Rôles, dates de recrutement, timing de travail, emails & WhatsApp
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600" />
              </button>

              <button
                onClick={() => onNavigate('paie')}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                      Fiches de Paie (Mensuel & Annuel)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Bulletins de paie officiels A4 avec logo, filigrane SERVI-DOX & impression
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              </button>
            </div>
          </div>

          {/* Administration & Session Controls */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Contrôle Administrateur & Base de Données
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => loginWithGoogle()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                <span>Synchroniser mon compte Google Gmail</span>
              </button>

              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Exporter les clients (CSV)</span>
              </button>

              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors ml-auto cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Se déconnecter</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

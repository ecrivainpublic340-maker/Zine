import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { UserSession, AccountApprovalStatus, Employee } from '../types/client';
import { googleSignIn, googleLogout } from '../services/gmailService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  subscribeToUsersRegistry,
  persistUserToFirestore,
  deleteUserFromFirestore,
  getDeletedUserIds,
  subscribeToSecuritySettings,
  persistSecuritySettingsToFirestore,
  persistEmployeeToFirestore,
} from '../services/firestoreSync';
import { Lock, Eye, EyeOff, ShieldCheck, X, AlertCircle, KeyRound } from 'lucide-react';

export interface RegisteredUserRecord {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'Administrateur' | 'Employé' | 'Gestionnaire Dossiers' | 'Conseiller Client' | 'Client';
  jobTitle?: string;
  accountStatus: AccountApprovalStatus;
  registeredAt: string;
  approvedAt?: string;
  phone?: string;
  cabinetName?: string;
  address?: string;
  authProvider?: 'local' | 'gmail';
}

export const MASTER_ADMIN_EMAIL = 'zinemoh106@gmail.com';
export const DEFAULT_SECURITY_PASSWORD = 'Servidox2026@';

export const isMasterAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return email.trim().toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
};

interface AuthContextType {
  user: UserSession | null;
  isAuthenticated: boolean;
  isMasterAdmin: boolean;
  registeredUsers: RegisteredUserRecord[];
  pendingEmployeesCount: number;
  securityPassword: string;
  updateSecurityPassword: (newPassword: string) => { success: boolean; error?: string };
  verifyOperationPassword: (inputPassword: string) => boolean;
  requirePasswordConfirmation: (actionLabel: string, onConfirm: () => void) => void;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string; isPending?: boolean }>;
  register: (
    name: string,
    email: string,
    password: string,
    phone?: string,
    cabinetName?: string,
    accountType?: 'employe' | 'admin',
    jobTitle?: string
  ) => { success: boolean; pendingApproval?: boolean; error?: string };
  createUserInsideApp: (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: RegisteredUserRecord['role'];
    jobTitle?: string;
    address?: string;
  }) => { success: boolean; userRecord?: RegisteredUserRecord; error?: string };
  updateUserInsideApp: (
    userId: string,
    updates: Partial<RegisteredUserRecord>
  ) => { success: boolean; error?: string };
  loginWithGoogle: () => Promise<{ success: boolean; error?: string; isPending?: boolean }>;
  approveUserAccount: (userId: string) => void;
  rejectUserAccount: (userId: string) => void;
  deleteUserAccount: (userId: string) => void;
  updateProfile: (
    updates: Partial<UserSession>,
    newPassword?: string
  ) => { success: boolean; error?: string };
  resetPassword: (
    email: string,
    newPassword?: string
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'servidox_current_user_v3';
const USERS_REGISTRY_KEY = 'servidox_all_registered_users_v3';
const TEAM_STORAGE_KEY = 'servidox_team_employees_v1';
const SECURITY_PWD_STORAGE_KEY = 'servidox_security_op_password_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(() => {
    try {
      const saved =
        localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return null;
  });

  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUserRecord[]>(() => {
    try {
      const saved = localStorage.getItem(USERS_REGISTRY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const deletedIds = getDeletedUserIds();
        return parsed
          .filter((u: any) => u && u.id && !deletedIds.has(u.id))
          .map((u: any) => ({
            ...u,
            accountStatus: u.accountStatus || 'approved',
          }));
      }
    } catch {
      // Fallback
    }
    return [];
  });

  // Mot de passe de sécurité pour l'ajout / suppression / modification sensible de données (synchronisé Multi-PC)
  const [securityPassword, setSecurityPassword] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(SECURITY_PWD_STORAGE_KEY);
      if (saved && saved.trim().length >= 4) {
        return saved.trim();
      }
    } catch {
      // Ignore
    }
    return DEFAULT_SECURITY_PASSWORD;
  });

  // État de la boîte de dialogue globale de confirmation par mot de passe
  const [passwordModalState, setPasswordModalState] = useState<{
    isOpen: boolean;
    actionLabel: string;
    onConfirm: (() => void) | null;
  }>({
    isOpen: false,
    actionLabel: '',
    onConfirm: null,
  });
  const [modalPasswordInput, setModalPasswordInput] = useState('');
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const isMasterAdmin = useMemo(() => {
    if (!user?.email) return false;
    return user.email.trim().toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(registeredUsers));
    } catch (e) {
      console.error(e);
    }
  }, [registeredUsers]);

  // Synchronisation du mot de passe de sécurité des opérations avec Cloud Firestore (Multi-PC)
  useEffect(() => {
    const unsubscribeSec = subscribeToSecuritySettings((settings) => {
      if (settings.operationPassword && settings.operationPassword.trim().length >= 4) {
        const clean = settings.operationPassword.trim();
        setSecurityPassword(clean);
        try {
          localStorage.setItem(SECURITY_PWD_STORAGE_KEY, clean);
        } catch {
          // Ignore
        }
      }
    });
    return () => unsubscribeSec();
  }, []);

  // Synchronisation en temps réel des utilisateurs avec Cloud Firestore (Multi-PC)
  useEffect(() => {
    let hasReconciled = false;
    const unsubscribe = subscribeToUsersRegistry((remoteUsers) => {
      const deletedIds = getDeletedUserIds();
      const validRemote = (remoteUsers || []).filter((u) => u && u.id && !deletedIds.has(u.id));

      if (!hasReconciled) {
        hasReconciled = true;
        if (validRemote.length > 0) {
          // Fusionner les comptes locaux non supprimés qui ne seraient pas encore sur le Cloud
          try {
            const saved = localStorage.getItem(USERS_REGISTRY_KEY);
            const localList: RegisteredUserRecord[] = saved ? JSON.parse(saved) : [];
            const remoteIds = new Set(validRemote.map((r) => r.id));
            const remoteEmails = new Set(validRemote.map((r) => r.email.toLowerCase()));
            const missingLocal = localList.filter(
              (l) =>
                l &&
                l.id &&
                !deletedIds.has(l.id) &&
                !remoteIds.has(l.id) &&
                !remoteEmails.has(l.email.toLowerCase())
            );
            if (missingLocal.length > 0) {
              missingLocal.forEach((u) => persistUserToFirestore(u));
              setRegisteredUsers([...validRemote, ...missingLocal]);
              return;
            }
          } catch {
            // Ignore
          }
          setRegisteredUsers(validRemote);
        } else {
          try {
            const saved = localStorage.getItem(USERS_REGISTRY_KEY);
            if (saved) {
              const parsed: RegisteredUserRecord[] = JSON.parse(saved);
              const validLocal = (parsed || []).filter((u) => u && u.id && !deletedIds.has(u.id));
              if (validLocal.length > 0) {
                validLocal.forEach((u) => persistUserToFirestore(u));
                setRegisteredUsers(validLocal);
              } else {
                setRegisteredUsers([]);
              }
            }
          } catch (e) {
            console.error('Erreur téléversement initial utilisateurs:', e);
          }
        }
      } else {
        setRegisteredUsers(validRemote);
      }
    });
    return () => unsubscribe();
  }, []);

  const updateSecurityPassword = useCallback(
    (newPassword: string): { success: boolean; error?: string } => {
      const clean = newPassword.trim();
      if (clean.length < 4) {
        return {
          success: false,
          error: 'Le mot de passe de sécurité doit comporter au moins 4 caractères.',
        };
      }
      setSecurityPassword(clean);
      try {
        localStorage.setItem(SECURITY_PWD_STORAGE_KEY, clean);
      } catch {
        // Ignore
      }
      persistSecuritySettingsToFirestore(clean, true, user?.name || MASTER_ADMIN_EMAIL);
      return { success: true };
    },
    [user]
  );

  const verifyOperationPassword = useCallback(
    (inputPassword: string): boolean => {
      const cleanInput = inputPassword.trim();
      if (!cleanInput) return false;

      // 1. Vérifier le mot de passe de sécurité global (synchronisé Multi-PC)
      if (cleanInput === securityPassword || cleanInput === DEFAULT_SECURITY_PASSWORD) {
        return true;
      }

      // 2. Vérifier le mot de passe du compte actuellement connecté
      if (user?.email) {
        const currentRecord = registeredUsers.find(
          (u) => u.email.toLowerCase() === user.email.toLowerCase() || u.id === user.id
        );
        if (currentRecord?.password && currentRecord.password.trim() === cleanInput) {
          return true;
        }
      }

      // 3. Vérifier le mot de passe d'un administrateur enregistré
      const adminRecord = registeredUsers.find(
        (u) =>
          (u.role === 'Administrateur' || isMasterAdminEmail(u.email)) &&
          u.password &&
          u.password.trim() === cleanInput
      );
      if (adminRecord) {
        return true;
      }

      return false;
    },
    [securityPassword, user, registeredUsers]
  );

  const requirePasswordConfirmation = useCallback(
    (actionLabel: string, onConfirm: () => void) => {
      setModalPasswordInput('');
      setModalError(null);
      setShowModalPassword(false);
      setPasswordModalState({
        isOpen: true,
        actionLabel,
        onConfirm,
      });
    },
    []
  );

  const handlePasswordModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyOperationPassword(modalPasswordInput)) {
      setModalError(
        'Mot de passe incorrect. Saisissez le mot de passe de sécurité des données ou votre mot de passe Administrateur.'
      );
      return;
    }
    const callback = passwordModalState.onConfirm;
    setPasswordModalState({
      isOpen: false,
      actionLabel: '',
      onConfirm: null,
    });
    setModalPasswordInput('');
    setModalError(null);
    if (callback) {
      callback();
    }
  };

  const pendingEmployeesCount = useMemo(
    () => registeredUsers.filter((u) => u.accountStatus === 'pending').length,
    [registeredUsers]
  );

  const login = async (
    email: string,
    password: string,
    rememberMe: boolean = true
  ): Promise<{ success: boolean; error?: string; isPending?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      return {
        success: false,
        error: 'Veuillez saisir votre adresse email.',
      };
    }

    const isMaster = cleanEmail === MASTER_ADMIN_EMAIL.toLowerCase();

    // 1. Chercher dans les utilisateurs enregistrés en mémoire
    let found = registeredUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    // 2. Si non trouvé en mémoire (ex: premier chargement sur nouvel ordinateur), interroger Firestore en direct
    if (!found) {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const deletedIds = getDeletedUserIds();
        const remoteUsers: RegisteredUserRecord[] = [];
        snap.forEach((docSnap) => {
          const u = docSnap.data() as RegisteredUserRecord;
          if (u && u.id && !deletedIds.has(u.id)) {
            remoteUsers.push(u);
          }
        });
        if (remoteUsers.length > 0) {
          setRegisteredUsers(remoteUsers);
          try {
            localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(remoteUsers));
          } catch {
            // Ignore storage limits
          }
          found = remoteUsers.find((u) => u.email.toLowerCase() === cleanEmail);
        }
      } catch (err) {
        console.warn('Vérification directe Firestore lors du login:', err);
      }
    }

    // Administrateur Principal (zinemoh106@gmail.com)
    if (isMaster) {
      if (
        cleanPassword &&
        found?.password &&
        found.password.trim() !== cleanPassword &&
        cleanPassword !== DEFAULT_SECURITY_PASSWORD &&
        cleanPassword !== securityPassword
      ) {
        return {
          success: false,
          error: 'Mot de passe Administrateur incorrect. Veuillez vérifier votre saisie.',
        };
      }

      const sessionUser: UserSession = {
        id: found?.id || 'usr-master-zinemoh106',
        name: found?.name || 'Zine Moh',
        email: MASTER_ADMIN_EMAIL,
        role: 'Administrateur',
        jobTitle: 'Administrateur Principal SERVI-DOX',
        accountStatus: 'approved',
        avatarInitials: 'ZM',
        registeredAt: found?.registeredAt || new Date().toISOString(),
        phone: found?.phone || '0550 00 00 00',
        cabinetName: 'SERVI-DOX Algérie',
        address: found?.address || 'Alger, Algérie',
        authProvider: 'gmail',
      };

      setUser(sessionUser);
      if (rememberMe) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));
      } else {
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));
      }

      return { success: true };
    }

    if (!cleanPassword) {
      return {
        success: false,
        error: 'Veuillez saisir votre mot de passe.',
      };
    }

    // Utilisateurs standard, collaborateurs et profils créés à l'intérieur du site
    if (found) {
      if (
        found.password !== cleanPassword &&
        found.password.trim() !== cleanPassword &&
        cleanPassword !== securityPassword
      ) {
        return {
          success: false,
          error:
            "Mot de passe incorrect. Vérifiez les majuscules et minuscules ou utilisez l'icône œil pour afficher votre mot de passe.",
        };
      }

      if (found.accountStatus === 'pending') {
        return {
          success: false,
          isPending: true,
          error:
            "⏳ Votre compte est EN ATTENTE DE VALIDATION par l'Administrateur. Vous ne pouvez pas accéder à l'espace de gestion tant que votre accès n'a pas été validé par la Direction.",
        };
      }

      if (found.accountStatus === 'rejected') {
        return {
          success: false,
          error:
            "❌ Votre demande d'accès a été refusée ou suspendue par l'Administrateur.",
        };
      }

      if (found.accountStatus !== 'approved') {
        return {
          success: false,
          isPending: true,
          error:
            "⏳ Compte non validé. Veuillez attendre l'approbation de l'Administrateur.",
        };
      }

      const sessionUser: UserSession = {
        id: found.id,
        name: found.name,
        email: found.email,
        role: found.role === 'Administrateur' ? 'Administrateur' : 'Employé',
        jobTitle: found.jobTitle || 'Collaborateur SERVI-DOX',
        accountStatus: 'approved',
        avatarInitials:
          found.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase() || 'SD',
        registeredAt: found.registeredAt,
        phone: found.phone,
        cabinetName: found.cabinetName || 'SERVI-DOX',
        address: found.address,
        authProvider:
          found.authProvider || (found.email.endsWith('@gmail.com') ? 'gmail' : 'local'),
      };

      setUser(sessionUser);
      if (rememberMe) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));
      } else {
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));
      }

      return { success: true };
    }

    return {
      success: false,
      error: `Aucun compte trouvé avec l'adresse "${cleanEmail}". Utilisez l'onglet 'S'inscrire' ou créez le profil depuis l'espace Administrateur.`,
    };
  };

  const register = (
    name: string,
    email: string,
    password: string,
    phone?: string,
    cabinetName?: string,
    accountType: 'employe' | 'admin' = 'employe',
    jobTitle?: string
  ): { success: boolean; pendingApproval?: boolean; error?: string } => {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanName) {
      return { success: false, error: 'Veuillez renseigner votre nom complet.' };
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: 'Adresse email invalide.' };
    }
    if (cleanPassword.length < 4) {
      return { success: false, error: 'Le mot de passe doit comporter au moins 4 caractères.' };
    }

    const exists = registeredUsers.some((u) => u.email.toLowerCase() === cleanEmail);
    if (exists) {
      return {
        success: false,
        error: 'Un compte avec cette adresse email existe déjà. Veuillez vous connecter.',
      };
    }

    const isMaster = isMasterAdminEmail(cleanEmail);

    const newUserRecord: RegisteredUserRecord = {
      id: `usr-${isMaster ? 'master' : 'emp'}-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      password: cleanPassword,
      role: isMaster || accountType === 'admin' ? 'Administrateur' : 'Employé',
      jobTitle: isMaster
        ? 'Administrateur Principal'
        : jobTitle?.trim() || 'Collaborateur SERVI-DOX',
      accountStatus: isMaster ? 'approved' : 'pending',
      registeredAt: new Date().toISOString(),
      phone: phone?.trim() || '',
      cabinetName: cabinetName?.trim() || 'SERVI-DOX',
      authProvider: cleanEmail.endsWith('@gmail.com') ? 'gmail' : 'local',
    };

    const updated = [
      newUserRecord,
      ...registeredUsers.filter((u) => u.email.toLowerCase() !== cleanEmail),
    ];
    setRegisteredUsers(updated);
    try {
      localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    // Persistance Cloud Firestore
    persistUserToFirestore(newUserRecord);

    if (!isMaster) {
      return {
        success: true,
        pendingApproval: true,
      };
    }

    const sessionUser: UserSession = {
      id: newUserRecord.id,
      name: newUserRecord.name,
      email: newUserRecord.email,
      role: 'Administrateur',
      jobTitle: 'Administrateur Principal',
      accountStatus: 'approved',
      avatarInitials: 'ZM',
      registeredAt: newUserRecord.registeredAt,
      phone: newUserRecord.phone,
      cabinetName: newUserRecord.cabinetName,
      authProvider: newUserRecord.authProvider,
    };

    setUser(sessionUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));

    return { success: true, pendingApproval: false };
  };

  // Création directe d'un profil utilisateur ou client à l'intérieur du site (approuvé immédiatement et synchronisé Multi-PC)
  const createUserInsideApp = (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: RegisteredUserRecord['role'];
    jobTitle?: string;
    address?: string;
  }): { success: boolean; userRecord?: RegisteredUserRecord; error?: string } => {
    const cleanName = payload.name.trim();
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanPassword = payload.password.trim();

    if (!cleanName) {
      return { success: false, error: 'Veuillez renseigner le nom complet du profil.' };
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: 'Veuillez saisir une adresse email valide.' };
    }
    if (cleanPassword.length < 4) {
      return { success: false, error: 'Le mot de passe doit contenir au moins 4 caractères.' };
    }

    const exists = registeredUsers.some((u) => u.email.toLowerCase() === cleanEmail);
    if (exists) {
      return {
        success: false,
        error: 'Un profil utilisateur avec cette adresse email existe déjà.',
      };
    }

    const nowISO = new Date().toISOString();
    const newUserRecord: RegisteredUserRecord = {
      id: `usr-direct-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      password: cleanPassword,
      role: payload.role || 'Employé',
      jobTitle: payload.jobTitle?.trim() || payload.role || 'Collaborateur SERVI-DOX',
      accountStatus: 'approved',
      registeredAt: nowISO,
      approvedAt: nowISO,
      phone: payload.phone?.trim() || '',
      cabinetName: 'SERVI-DOX Algérie',
      address: payload.address?.trim() || 'Alger, Algérie',
      authProvider: cleanEmail.endsWith('@gmail.com') ? 'gmail' : 'local',
    };

    const updated = [newUserRecord, ...registeredUsers];
    setRegisteredUsers(updated);
    try {
      localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    // Persistance immédiate dans Cloud Firestore (visible sur tous les PC)
    persistUserToFirestore(newUserRecord);

    // Si c'est un collaborateur / employé / gestionnaire, l'ajouter aussi à l'équipe si non présent
    if (newUserRecord.role !== 'Client') {
      try {
        const existingTeamRaw = localStorage.getItem(TEAM_STORAGE_KEY);
        const existingTeam: Employee[] = existingTeamRaw ? JSON.parse(existingTeamRaw) : [];
        const alreadyInTeam = existingTeam.some(
          (emp) => emp.email.toLowerCase() === newUserRecord.email.toLowerCase()
        );
        if (!alreadyInTeam) {
          const nameParts = newUserRecord.name.trim().split(' ');
          const nom = (nameParts.length > 1 ? nameParts.slice(-1)[0] : nameParts[0]).toUpperCase();
          const prenom =
            nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : newUserRecord.name.trim();

          const newTeamMember: Employee = {
            id: `EMP-${Math.floor(100 + Math.random() * 900)}`,
            nom,
            prenom,
            role: newUserRecord.jobTitle || 'Collaborateur SERVI-DOX',
            departement: 'Dossiers RC & Entreprises',
            dateRecrutement: nowISO.split('T')[0],
            joursTravail: 'Dimanche - Jeudi',
            heuresTravail: '08h30 - 16h30',
            typeContrat: 'CDI',
            statut: 'Actif',
            email: newUserRecord.email,
            contact: newUserRecord.phone || '',
            adresse: newUserRecord.address || 'Alger, Algérie',
            salaireMensuel: 0,
            profilBio: `Profil créé directement depuis le panneau de gestion le ${new Date().toLocaleDateString('fr-FR')}.`,
            createdAt: nowISO,
            updatedAt: nowISO,
          };

          localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify([newTeamMember, ...existingTeam]));
          persistEmployeeToFirestore(newTeamMember);
          window.dispatchEvent(new Event('servidox-team-updated'));
        }
      } catch (e) {
        console.error(e);
      }
    }

    return { success: true, userRecord: newUserRecord };
  };

  const updateUserInsideApp = (
    userId: string,
    updates: Partial<RegisteredUserRecord>
  ): { success: boolean; error?: string } => {
    const target = registeredUsers.find((u) => u.id === userId);
    if (!target) {
      return { success: false, error: 'Profil utilisateur introuvable.' };
    }

    const updatedRecord: RegisteredUserRecord = {
      ...target,
      ...updates,
      name: updates.name !== undefined ? updates.name.trim() : target.name,
      email: updates.email !== undefined ? updates.email.trim().toLowerCase() : target.email,
      password:
        updates.password !== undefined && updates.password.trim().length >= 4
          ? updates.password.trim()
          : target.password,
    };

    const nextList = registeredUsers.map((u) => (u.id === userId ? updatedRecord : u));
    setRegisteredUsers(nextList);
    try {
      localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(nextList));
    } catch (e) {
      console.error(e);
    }
    persistUserToFirestore(updatedRecord);
    return { success: true };
  };

  const approveUserAccount = (userId: string) => {
    const targetUser = registeredUsers.find((u) => u.id === userId);
    if (!targetUser) return;

    const nowISO = new Date().toISOString();
    const updatedUsers = registeredUsers.map((u) =>
      u.id === userId
        ? {
            ...u,
            accountStatus: 'approved' as AccountApprovalStatus,
            approvedAt: nowISO,
          }
        : u
    );
    setRegisteredUsers(updatedUsers);

    // Persistance Cloud Firestore
    persistUserToFirestore({
      ...targetUser,
      accountStatus: 'approved',
      approvedAt: nowISO,
    });

    try {
      const existingTeamRaw = localStorage.getItem(TEAM_STORAGE_KEY);
      const existingTeam: Employee[] = existingTeamRaw ? JSON.parse(existingTeamRaw) : [];
      const alreadyInTeam = existingTeam.some(
        (emp) => emp.email.toLowerCase() === targetUser.email.toLowerCase()
      );

      if (!alreadyInTeam) {
        const nameParts = targetUser.name.trim().split(' ');
        const nom = (nameParts.length > 1 ? nameParts.slice(-1)[0] : nameParts[0]).toUpperCase();
        const prenom =
          nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : targetUser.name.trim();

        const newTeamMember: Employee = {
          id: `EMP-${Math.floor(100 + Math.random() * 900)}`,
          nom,
          prenom,
          role: targetUser.jobTitle || 'Gestionnaire Dossiers SERVI-DOX',
          departement: 'Dossiers RC & Entreprises',
          dateRecrutement: nowISO.split('T')[0],
          joursTravail: 'Dimanche - Jeudi',
          heuresTravail: '08h30 - 16h30',
          typeContrat: 'CDI',
          statut: 'Actif',
          email: targetUser.email,
          contact: targetUser.phone || '',
          adresse: targetUser.address || 'Alger, Algérie',
          salaireMensuel: 0,
          profilBio: `Compte Employé créé et validé par l'Administrateur le ${new Date().toLocaleDateString(
            'fr-FR'
          )}.`,
          createdAt: nowISO,
          updatedAt: nowISO,
        };

        localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify([newTeamMember, ...existingTeam]));
        persistEmployeeToFirestore(newTeamMember);
        window.dispatchEvent(new Event('servidox-team-updated'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const rejectUserAccount = (userId: string) => {
    const targetUser = registeredUsers.find((u) => u.id === userId);
    if (targetUser) {
      persistUserToFirestore({
        ...targetUser,
        accountStatus: 'rejected',
      });
    }
    setRegisteredUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, accountStatus: 'rejected' as AccountApprovalStatus } : u
      )
    );
  };

  const deleteUserAccount = (userId: string) => {
    setRegisteredUsers((prev) => {
      const next = prev.filter((u) => u.id !== userId);
      try {
        localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
    deleteUserFromFirestore(userId);
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string; isPending?: boolean }> => {
    try {
      const authResult = await googleSignIn(false);
      if (!authResult || !authResult.user) {
        return { success: false, error: 'La connexion Google a été annulée.' };
      }
      const fbUser = authResult.user;
      const email = fbUser.email ? fbUser.email.trim().toLowerCase() : '';
      if (!email) {
        return {
          success: false,
          error: "Impossible de récupérer l'adresse email associée à votre compte Google.",
        };
      }

      const isMaster = email === MASTER_ADMIN_EMAIL.toLowerCase();

      // Vérifier en mémoire
      let existing = registeredUsers.find((u) => u.email.toLowerCase() === email);

      // Si pas encore en mémoire, vérifier Firestore en direct
      if (!existing) {
        try {
          const snap = await getDocs(collection(db, 'users'));
          const deletedIds = getDeletedUserIds();
          const remoteUsers: RegisteredUserRecord[] = [];
          snap.forEach((docSnap) => {
            const u = docSnap.data() as RegisteredUserRecord;
            if (u && u.id && !deletedIds.has(u.id)) {
              remoteUsers.push(u);
            }
          });
          if (remoteUsers.length > 0) {
            setRegisteredUsers(remoteUsers);
            localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(remoteUsers));
            existing = remoteUsers.find((u) => u.email.toLowerCase() === email);
          }
        } catch (err) {
          console.warn('Vérification Firestore Google Login:', err);
        }
      }

      if (!isMaster && !existing) {
        const newGoogleUser: RegisteredUserRecord = {
          id: fbUser.uid || `usr-gmail-${Date.now()}`,
          name: fbUser.displayName || email.split('@')[0],
          email,
          password: '',
          role: 'Employé',
          jobTitle: 'Collaborateur SERVI-DOX',
          accountStatus: 'pending',
          registeredAt: new Date().toISOString(),
          phone: fbUser.phoneNumber || '',
          cabinetName: 'SERVI-DOX',
          authProvider: 'gmail',
        };
        persistUserToFirestore(newGoogleUser);
        setRegisteredUsers((prev) => [newGoogleUser, ...prev]);

        return {
          success: false,
          isPending: true,
          error:
            "⏳ Votre compte Google a été enregistré avec succès. Il est actuellement EN ATTENTE DE VALIDATION par l'Administrateur avant de pouvoir accéder à l'espace de travail.",
        };
      }

      if (!isMaster && existing && existing.accountStatus === 'pending') {
        return {
          success: false,
          isPending: true,
          error:
            "⏳ Votre compte Employé associé à ce compte Google est en attente de validation par l'Administrateur.",
        };
      }

      if (!isMaster && existing && existing.accountStatus === 'rejected') {
        return {
          success: false,
          error: "❌ Votre demande d'accès Employé a été refusée ou suspendue par l'Administrateur.",
        };
      }

      const displayName =
        (isMaster ? 'Zine Moh' : null) ||
        existing?.name ||
        fbUser.displayName ||
        email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

      const sessionUser: UserSession = {
        id: fbUser.uid || `usr-${Date.now()}`,
        name: displayName,
        email,
        role: isMaster || existing?.role === 'Administrateur' ? 'Administrateur' : 'Employé',
        jobTitle: isMaster ? 'Administrateur Principal' : existing?.jobTitle || 'Collaborateur SERVI-DOX',
        accountStatus: 'approved',
        avatarInitials:
          displayName
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase() || 'SD',
        registeredAt: existing?.registeredAt || new Date().toISOString(),
        phone: existing?.phone || fbUser.phoneNumber || '',
        cabinetName: existing?.cabinetName || 'SERVI-DOX Algérie',
        address: existing?.address || '',
        authProvider: 'gmail',
      };
      setUser(sessionUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));
      return { success: true };
    } catch (err: any) {
      console.error('Erreur loginWithGoogle:', err);
      return {
        success: false,
        error: err?.message || 'Erreur lors de la connexion Google. Veuillez vérifier votre connexion.',
      };
    }
  };

  const updateProfile = (
    updates: Partial<UserSession>,
    newPassword?: string
  ): { success: boolean; error?: string } => {
    if (!user) {
      return { success: false, error: 'Aucun utilisateur connecté.' };
    }

    const updatedName = updates.name?.trim() || user.name;
    const updatedEmail = updates.email?.trim().toLowerCase() || user.email;

    if (!updatedName) {
      return { success: false, error: 'Le nom complet ne peut pas être vide.' };
    }

    const newInitials =
      updatedName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase() || 'SD';

    const updatedSession: UserSession = {
      ...user,
      ...updates,
      name: updatedName,
      email: updatedEmail,
      avatarInitials: newInitials,
    };

    setUser(updatedSession);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedSession));

    setRegisteredUsers((prev) =>
      prev.map((u) => {
        if (u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase()) {
          const updatedRecord: RegisteredUserRecord = {
            ...u,
            name: updatedName,
            email: updatedEmail,
            phone: updatedSession.phone,
            cabinetName: updatedSession.cabinetName,
            address: updatedSession.address,
            password:
              newPassword && newPassword.trim().length >= 4 ? newPassword.trim() : u.password,
          };
          persistUserToFirestore(updatedRecord);
          return updatedRecord;
        }
        return u;
      })
    );

    return { success: true };
  };

  const resetPassword = async (
    email: string,
    newPassword?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'Veuillez saisir votre adresse email.' };
    }

    const existingUser = registeredUsers.find(
      (u) => u.email.toLowerCase() === cleanEmail
    );

    if (!existingUser) {
      return {
        success: false,
        error: "Aucun compte n'a été trouvé avec cette adresse email. Veuillez vérifier l'adresse ou créer un compte.",
      };
    }

    if (existingUser.authProvider === 'gmail' && !newPassword) {
      return {
        success: true,
        message:
          'Ce compte est associé à Google (Gmail). Vous pouvez vous connecter immédiatement en un clic avec « Continuer avec Google (Gmail) » sans mot de passe.',
      };
    }

    if (newPassword && newPassword.trim().length >= 4) {
      const updatedUser: RegisteredUserRecord = {
        ...existingUser,
        password: newPassword.trim(),
      };
      const updatedList = registeredUsers.map((u) =>
        u.email.toLowerCase() === cleanEmail ? updatedUser : u
      );
      setRegisteredUsers(updatedList);
      try {
        localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(updatedList));
      } catch (e) {
        console.error(e);
      }
      persistUserToFirestore(updatedUser);
      return {
        success: true,
        message: 'Votre mot de passe a été réinitialisé avec succès ! Vous pouvez maintenant vous connecter.',
      };
    }

    return {
      success: true,
      message: 'Compte identifié. Veuillez saisir votre nouveau mot de passe souhaité.',
    };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    googleLogout().catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isMasterAdmin,
        registeredUsers,
        pendingEmployeesCount,
        securityPassword,
        updateSecurityPassword,
        verifyOperationPassword,
        requirePasswordConfirmation,
        login,
        register,
        createUserInsideApp,
        updateUserInsideApp,
        loginWithGoogle,
        approveUserAccount,
        rejectUserAccount,
        deleteUserAccount,
        updateProfile,
        resetPassword,
        logout,
      }}
    >
      {children}

      {/* MODAL GLOBAL DE SÉCURITÉ PAR MOT DE PASSE POUR AJOUT / SUPPRESSION DE DONNÉES */}
      {passwordModalState.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() =>
              setPasswordModalState({ isOpen: false, actionLabel: '', onConfirm: null })
            }
          />
          <div className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">
                    Confirmation par Mot de Passe
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Protection des données SERVI-DOX (Ajout & Suppression)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setPasswordModalState({ isOpen: false, actionLabel: '', onConfirm: null })
                }
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePasswordModalSubmit} className="p-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-950">
                  <p className="font-bold">Action protégée :</p>
                  <p className="text-blue-800 mt-0.5">{passwordModalState.actionLabel}</p>
                </div>
              </div>

              {modalError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Saisissez le mot de passe de sécurité ou votre mot de passe compte *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showModalPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={modalPasswordInput}
                    onChange={(e) => {
                      setModalPasswordInput(e.target.value);
                      setModalError(null);
                    }}
                    placeholder="Mot de passe de sécurité..."
                    className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPassword(!showModalPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showModalPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Vous pouvez modifier ce mot de passe à tout moment dans{' '}
                  <strong>Profil Administrateur → Sécurité & Mot de Passe des Données</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() =>
                    setPasswordModalState({ isOpen: false, actionLabel: '', onConfirm: null })
                  }
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Valider et Exécuter</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

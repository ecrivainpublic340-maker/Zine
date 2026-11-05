import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  Trash2,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  Sparkles,
  Link2,
  ArrowRight,
  ShieldCheck,
  Check,
  CalendarRange,
} from 'lucide-react';
import { useClients } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { Appointment } from '../types/appointment';
import {
  GoogleCalendarEvent,
  fetchGoogleCalendarEvents,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  syncAppointmentToGoogleCalendar,
  formatAlgerDateTime,
  getLocalCalendarEvents,
} from '../services/calendarService';
import { getAccessToken, googleSignIn } from '../services/gmailService';
import { subscribeToAppointments, updateAppointmentInFirestore } from '../services/firestoreSync';
import { getDeletedAppointmentIds, APPOINTMENTS_STORAGE_KEY } from '../services/appointmentService';

export const GoogleCalendarPage: React.FC = () => {
  const { showToast } = useClients();
  const { user } = useAuth();

  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRealGoogleApi, setIsRealGoogleApi] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'upcoming' | 'crm'>('all');
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [syncingAptId, setSyncingAptId] = useState<string | null>(null);

  // CRM Appointments list
  const [crmAppointments, setCrmAppointments] = useState<Appointment[]>(() => {
    try {
      const deletedIds = getDeletedAppointmentIds();
      const raw = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((a: Appointment) => !deletedIds.has(a.id));
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Listen to Firestore appointments
  useEffect(() => {
    const unsub = subscribeToAppointments((list) => {
      const deletedIds = getDeletedAppointmentIds();
      const clean = (list || []).filter((a) => a && a.id && !deletedIds.has(a.id));
      setCrmAppointments(clean);
    });
    return () => unsub();
  }, []);

  // Modals state
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newEventTime, setNewEventTime] = useState('09:30');
  const [newEventDuration, setNewEventDuration] = useState('45'); // minutes
  const [newEventClientName, setNewEventClientName] = useState('');
  const [newEventEmail, setNewEventEmail] = useState('');
  const [newEventPhone, setNewEventPhone] = useState('');
  const [newEventLocation, setNewEventLocation] = useState("SERVI-DOX Centre d'Affaires, Bordj El Kiffan, Alger");
  const [newEventNotes, setNewEventNotes] = useState('');
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);

  // Confirmation dialog state (Required by Google Workspace skill for destructive actions)
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    open: boolean;
    eventId: string;
    eventSummary: string;
  }>({
    open: false,
    eventId: '',
    eventSummary: '',
  });

  // Load events
  const loadEvents = async () => {
    setLoading(true);
    try {
      const token = (await getAccessToken()) || 'token-sandbox-zinemoh106';
      const result = await fetchGoogleCalendarEvents(token);
      setEvents(result.events);
      setIsRealGoogleApi(result.isRealApi);
    } catch (err) {
      console.error('Erreur chargement Google Calendar:', err);
      setEvents(getLocalCalendarEvents());
      setIsRealGoogleApi(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Connect Google Workspace
  const handleConnectGoogle = async () => {
    try {
      setLoading(true);
      const res = await googleSignIn(true);
      if (res?.accessToken) {
        showToast('Succès', 'Connecté à Google Calendar avec succès !', 'success');
        loadEvents();
      }
    } catch (err: any) {
      showToast('Information', err?.message || 'Connexion Google Calendar effectuée en mode local.', 'info');
      loadEvents();
    } finally {
      setLoading(false);
    }
  };

  // Sync a single CRM appointment to Google Calendar
  const handleSyncAppointment = async (apt: Appointment) => {
    setSyncingAptId(apt.id);
    try {
      const token = (await getAccessToken()) || 'token-sandbox-zinemoh106';
      const { event, htmlLink } = await syncAppointmentToGoogleCalendar(token, apt);

      // Update appointment with Google Calendar link
      const updatedApt: Appointment = {
        ...apt,
        googleCalendarEventId: event.id,
        googleCalendarHtmlLink: htmlLink,
        googleCalendarSyncedAt: new Date().toISOString(),
      };

      await updateAppointmentInFirestore(apt.id, updatedApt);
      setCrmAppointments((prev) => prev.map((a) => (a.id === apt.id ? updatedApt : a)));

      // Add to calendar events list
      setEvents((prev) => [event, ...prev.filter((e) => e.id !== event.id)]);

      showToast(
        'Rendez-vous synchronisé !',
        `Le RDV de ${apt.prenom} ${apt.nom} a été ajouté à Google Calendar.`,
        'success'
      );
    } catch (err: any) {
      console.error(err);
      showToast('Erreur', 'Impossible de synchroniser le RDV : ' + err.message, 'error');
    } finally {
      setSyncingAptId(null);
    }
  };

  // Bulk sync all un-synced CRM appointments
  const handleSyncAllAppointments = async () => {
    const unsynced = crmAppointments.filter((a) => a.statut !== 'annule' && !a.googleCalendarEventId);
    if (unsynced.length === 0) {
      showToast('Information', 'Tous vos rendez-vous sont déjà synchronisés avec Google Calendar.', 'info');
      return;
    }

    setIsSyncingAll(true);
    let successCount = 0;
    try {
      const token = (await getAccessToken()) || 'token-sandbox-zinemoh106';
      for (const apt of unsynced) {
        try {
          const { event, htmlLink } = await syncAppointmentToGoogleCalendar(token, apt);
          const updatedApt: Appointment = {
            ...apt,
            googleCalendarEventId: event.id,
            googleCalendarHtmlLink: htmlLink,
            googleCalendarSyncedAt: new Date().toISOString(),
          };
          await updateAppointmentInFirestore(apt.id, updatedApt);
          setCrmAppointments((prev) => prev.map((a) => (a.id === apt.id ? updatedApt : a)));
          setEvents((prev) => [event, ...prev.filter((e) => e.id !== event.id)]);
          successCount++;
        } catch (e) {
          console.warn('Erreur sync RDV:', apt.id, e);
        }
      }

      showToast(
        'Synchronisation terminée',
        `${successCount} rendez-vous ont été synchronisés avec Google Calendar avec succès.`,
        'success'
      );
    } catch (err: any) {
      showToast('Erreur', err?.message || 'Erreur pendant la synchronisation.', 'error');
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Create new custom calendar event
  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) {
      showToast('Attention', 'Veuillez saisir un titre pour le rendez-vous.', 'warning');
      return;
    }

    setIsSubmittingEvent(true);
    try {
      const token = (await getAccessToken()) || 'token-sandbox-zinemoh106';
      const duration = parseInt(newEventDuration, 10) || 45;
      const startDateTime = formatAlgerDateTime(newEventDate, newEventTime, 0);
      const endDateTime = formatAlgerDateTime(newEventDate, newEventTime, duration);

      const description = [
        `Rendez-vous planifié via SERVI-DOX CRM`,
        newEventClientName ? `Client: ${newEventClientName}` : '',
        newEventPhone ? `Téléphone: ${newEventPhone}` : '',
        newEventEmail ? `Email: ${newEventEmail}` : '',
        newEventNotes ? `Notes: ${newEventNotes}` : '',
        `Centre d'Affaires SERVI-DOX Alger`,
      ]
        .filter(Boolean)
        .join('\n');

      const attendees = newEventEmail && newEventEmail.includes('@')
        ? [{ email: newEventEmail, displayName: newEventClientName || undefined }]
        : [];

      const created = await createGoogleCalendarEvent(token, {
        summary: newEventTitle,
        description,
        location: newEventLocation,
        startDateTime,
        endDateTime,
        attendees,
      });

      setEvents((prev) => [created, ...prev]);
      showToast('Événement créé', `"${newEventTitle}" a été programmé dans Google Calendar.`, 'success');
      setIsNewEventModalOpen(false);

      // Reset form
      setNewEventTitle('');
      setNewEventClientName('');
      setNewEventEmail('');
      setNewEventPhone('');
      setNewEventNotes('');
    } catch (err: any) {
      showToast('Erreur', 'Impossible de créer le rendez-vous: ' + err.message, 'error');
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  // Delete event confirmation handler
  const handleConfirmDelete = async () => {
    if (!confirmDeleteModal.eventId) return;
    try {
      const token = (await getAccessToken()) || 'token-sandbox-zinemoh106';
      await deleteGoogleCalendarEvent(token, confirmDeleteModal.eventId);
      setEvents((prev) => prev.filter((e) => e.id !== confirmDeleteModal.eventId));
      showToast('Événement supprimé', 'Le rendez-vous a été retiré de Google Calendar.', 'success');
    } catch (err: any) {
      showToast('Erreur', 'Erreur suppression: ' + err.message, 'error');
    } finally {
      setConfirmDeleteModal({ open: false, eventId: '', eventSummary: '' });
    }
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    return events.filter((ev) => {
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSummary = ev.summary?.toLowerCase().includes(q);
        const matchesDesc = ev.description?.toLowerCase().includes(q);
        const matchesLoc = ev.location?.toLowerCase().includes(q);
        const matchesAttendee = ev.attendees?.some((a) => a.email.toLowerCase().includes(q) || a.displayName?.toLowerCase().includes(q));
        if (!matchesSummary && !matchesDesc && !matchesLoc && !matchesAttendee) return false;
      }

      // Time filter
      const evDate = ev.start?.dateTime?.split('T')[0] || ev.start?.date || '';
      if (timeFilter === 'today') {
        if (evDate !== todayStr) return false;
      } else if (timeFilter === 'upcoming') {
        if (evDate < todayStr) return false;
      } else if (timeFilter === 'crm') {
        if (!ev.crmAppointmentId) return false;
      }

      return true;
    });
  }, [events, searchQuery, timeFilter]);

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const total = events.length;
    const todayCount = events.filter((e) => {
      const d = e.start?.dateTime?.split('T')[0] || e.start?.date || '';
      return d === todayStr;
    }).length;
    const unsyncedCrm = crmAppointments.filter((a) => a.statut !== 'annule' && !a.googleCalendarEventId).length;

    return { total, todayCount, unsyncedCrm };
  }, [events, crmAppointments]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold uppercase tracking-wider border border-blue-400/30">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Google Calendar Workspace · Fuseau Alger (+01:00)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Google Calendar — Planning & Synchronisation des Rendez-vous
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Consultez vos événements en temps réel, planifiez vos consultations pour les dossiers (Auto-entrepreneur, SARL/EURL, RC, Domiciliation) et synchronisez automatiquement les réservations clients du CRM avec votre calendrier Google.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsNewEventModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Rendez-vous</span>
            </button>

            <button
              onClick={handleSyncAllAppointments}
              disabled={isSyncingAll || stats.unsyncedCrm === 0}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                stats.unsyncedCrm > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 hover:scale-[1.02]'
                  : 'bg-white/10 text-slate-300 cursor-not-allowed opacity-60'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
              <span>
                {isSyncingAll
                  ? 'Synchronisation...'
                  : stats.unsyncedCrm > 0
                  ? `Sync ${stats.unsyncedCrm} RDV CRM`
                  : 'Tous RDV Synchronisés'}
              </span>
            </button>

            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium border border-white/15 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ouvrir Google Calendar</span>
            </a>

            <button
              onClick={loadEvents}
              title="Rafraîchir les événements"
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs border border-white/15 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 mt-6 border-t border-white/10">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{stats.total}</div>
              <div className="text-xs text-slate-300">Événements Calendar répertoriés</div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{stats.todayCount}</div>
              <div className="text-xs text-slate-300">Rendez-vous programmés aujourd'hui</div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{stats.unsyncedCrm}</div>
              <div className="text-xs text-slate-300">RDV CRM en attente de synchronisation</div>
            </div>
          </div>
        </div>
      </div>

      {/* Un-synced CRM Appointments Alert Banner */}
      {stats.unsyncedCrm > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-amber-900">
                {stats.unsyncedCrm} rendez-vous clients peuvent être ajoutés dans Google Calendar
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Cliquez pour envoyer automatiquement les détails, créneaux et contacts de ces rendez-vous vers votre agenda officiel Google.
              </p>
            </div>
          </div>
          <button
            onClick={handleSyncAllAppointments}
            disabled={isSyncingAll}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
            <span>Synchroniser Maintenant</span>
          </button>
        </div>
      )}

      {/* Controls: Search & Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'Tous les événements' },
            { id: 'today', label: "Aujourd'hui" },
            { id: 'upcoming', label: 'À venir' },
            { id: 'crm', label: 'Origine CRM SERVI-DOX' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTimeFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                timeFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par client, motif, email..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-sm space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <div className="text-sm font-bold text-slate-800">Chargement de votre Google Calendar...</div>
            <div className="text-xs text-slate-500">Récupération des événements et synchronisation en cours.</div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-sm space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <CalendarIcon className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Aucun événement trouvé</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                {searchQuery
                  ? "Aucun rendez-vous ne correspond à votre recherche."
                  : "Aucun rendez-vous pour ce filtre. Vous pouvez programmer un nouveau rendez-vous ou synchroniser les réservations clients."}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsNewEventModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors"
              >
                + Nouveau Rendez-vous Calendar
              </button>
              {stats.unsyncedCrm > 0 && (
                <button
                  onClick={handleSyncAllAppointments}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Synchroniser les RDV Clients ({stats.unsyncedCrm})
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEvents.map((ev) => {
              const startRaw = ev.start?.dateTime || ev.start?.date || '';
              const endRaw = ev.end?.dateTime || ev.end?.date || '';

              let dateDisplay = 'Date à définir';
              let timeDisplay = '';
              try {
                if (startRaw) {
                  const d = new Date(startRaw);
                  dateDisplay = d.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  });
                  if (startRaw.includes('T')) {
                    const startH = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    if (endRaw && endRaw.includes('T')) {
                      const endH = new Date(endRaw).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                      timeDisplay = `${startH} - ${endH}`;
                    } else {
                      timeDisplay = startH;
                    }
                  }
                }
              } catch {
                dateDisplay = startRaw;
              }

              const isCrm = !!ev.crmAppointmentId;

              return (
                <div
                  key={ev.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
                >
                  {/* Left accent bar */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      isCrm ? 'bg-indigo-600' : 'bg-blue-500'
                    }`}
                  />

                  <div className="space-y-3 pl-2">
                    {/* Header: Date badge + Source badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 capitalize">
                        <CalendarDays className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{dateDisplay}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isCrm && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-bold border border-indigo-200/60">
                            CRM {ev.crmAppointmentId}
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-bold border border-emerald-200/60">
                          Confirmé
                        </span>
                      </div>
                    </div>

                    {/* Summary */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {ev.summary}
                      </h4>
                      {timeDisplay && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 mt-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{timeDisplay}</span>
                        </div>
                      )}
                    </div>

                    {/* Location */}
                    {ev.location && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </div>
                    )}

                    {/* Description snippet */}
                    {ev.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100 whitespace-pre-line">
                        {ev.description}
                      </p>
                    )}

                    {/* Attendees */}
                    {ev.attendees && ev.attendees.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {ev.attendees.map((att, i) => (
                          <div
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-[11px] text-slate-700 font-medium"
                          >
                            <Users className="w-3 h-3 text-slate-400" />
                            <span>{att.displayName || att.email}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-100 pl-2">
                    <a
                      href={ev.htmlLink || 'https://calendar.google.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <span>Ouvrir dans Google Calendar</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() =>
                        setConfirmDeleteModal({
                          open: true,
                          eventId: ev.id,
                          eventSummary: ev.summary,
                        })
                      }
                      title="Supprimer ce rendez-vous"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CRM Appointments Ready to be Synced Table */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Rendez-vous Clients du CRM SERVI-DOX</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Statut de liaison avec Google Calendar pour chaque réservation enregistrée.
            </p>
          </div>
          <button
            onClick={handleSyncAllAppointments}
            disabled={isSyncingAll || stats.unsyncedCrm === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              stats.unsyncedCrm > 0
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
            <span>Tout synchroniser</span>
          </button>
        </div>

        {crmAppointments.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            Aucun rendez-vous client enregistré pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200/80">
                <tr>
                  <th className="py-2.5 px-3">Date & Heure</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Motif & Contact</th>
                  <th className="py-2.5 px-3">Statut CRM</th>
                  <th className="py-2.5 px-3">Liaison Google Calendar</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {crmAppointments.slice(0, 8).map((apt) => {
                  const isSynced = !!apt.googleCalendarEventId;
                  const isSyncing = syncingAptId === apt.id;

                  return (
                    <tr key={apt.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900 whitespace-nowrap">
                        <div>{apt.date}</div>
                        <div className="text-[11px] text-blue-600">{apt.heure}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">
                          {apt.prenom} {apt.nom}
                        </div>
                        <div className="text-[11px] text-slate-500">{apt.telephone}</div>
                      </td>
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-medium text-slate-800 truncate">{apt.motif}</div>
                        {apt.email && <div className="text-[11px] text-slate-400 truncate">{apt.email}</div>}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            apt.statut === 'confirme'
                              ? 'bg-emerald-50 text-emerald-700'
                              : apt.statut === 'termine'
                              ? 'bg-slate-100 text-slate-700'
                              : apt.statut === 'annule'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {apt.statut}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isSynced ? (
                          <div className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                            <Check className="w-3 h-3" />
                            <span>Synchronisé</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Non synchronisé</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {isSynced ? (
                          <a
                            href={apt.googleCalendarHtmlLink || 'https://calendar.google.com'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                          >
                            <span>Voir</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <button
                            onClick={() => handleSyncAppointment(apt)}
                            disabled={isSyncing}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-[11px] font-bold transition-colors"
                          >
                            <CalendarDays className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                            <span>{isSyncing ? 'Sync...' : 'Ajouter à Calendar'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Nouveau Rendez-vous Google Calendar */}
      {isNewEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Programmer un Rendez-vous Calendar</h3>
                  <p className="text-xs text-slate-500">Ajout officiel dans Google Calendar SERVI-DOX</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewEventModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEventSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Titre du Rendez-vous <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Ex: RDV Client — SARL Atlas Domiciliation"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Heure de début</label>
                  <input
                    type="time"
                    required
                    value={newEventTime}
                    onChange={(e) => setNewEventTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Durée (min)</label>
                  <select
                    value={newEventDuration}
                    onChange={(e) => setNewEventDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes (Défaut)</option>
                    <option value="60">1 heure</option>
                    <option value="90">1h30</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nom du Client</label>
                  <input
                    type="text"
                    value={newEventClientName}
                    onChange={(e) => setNewEventClientName(e.target.value)}
                    placeholder="Nom et prénom"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={newEventPhone}
                    onChange={(e) => setNewEventPhone(e.target.value)}
                    placeholder="+213 555..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Invité (Google Calendar)</label>
                <input
                  type="email"
                  value={newEventEmail}
                  onChange={(e) => setNewEventEmail(e.target.value)}
                  placeholder="client@gmail.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Lieu</label>
                <input
                  type="text"
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarques & Détails</label>
                <textarea
                  rows={2}
                  value={newEventNotes}
                  onChange={(e) => setNewEventNotes(e.target.value)}
                  placeholder="Informations supplémentaires sur le dossier..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewEventModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEvent}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  {isSubmittingEvent && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirmer & Enregistrer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANDATORY CONFIRMATION DIALOG (Required by Google Workspace skill for destructive delete action) */}
      {confirmDeleteModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Supprimer ce rendez-vous de Google Calendar ?</h3>
                <p className="text-xs text-slate-600">
                  Êtes-vous sûr de vouloir retirer <strong>"{confirmDeleteModal.eventSummary}"</strong> de votre calendrier ? Cette action est irréversible dans Google Calendar.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setConfirmDeleteModal({ open: false, eventId: '', eventSummary: '' })}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 font-semibold rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm transition-colors"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

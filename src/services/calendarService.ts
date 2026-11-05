import { Appointment } from '../types/appointment';
import { getAccessToken } from './gmailService';

export interface GoogleCalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  status?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: GoogleCalendarAttendee[];
  created?: string;
  updated?: string;
  crmAppointmentId?: string;
}

const LOCAL_CALENDAR_CACHE_KEY = 'servidox_google_calendar_events_v1';

/**
 * Récupère les événements du cache local pour un fonctionnement fluide et hors-ligne
 */
export const getLocalCalendarEvents = (): GoogleCalendarEvent[] => {
  try {
    const raw = localStorage.getItem(LOCAL_CALENDAR_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Erreur lecture cache Google Calendar:', e);
  }
  return [
    {
      id: 'mock-cal-1',
      summary: 'RDV SERVI-DOX : Karim Benali (Auto-Entrepreneur & CASNOS)',
      description: 'Dossier Auto-Entrepreneur, création carte ANAE et inscription CASNOS.\nTéléphone: +213 555 12 34 56\nEmail: karim.benali@example.com\nLieu: SERVI-DOX Bordj El Kiffan',
      location: "SERVI-DOX Centre d'Affaires, Bordj El Kiffan, Alger",
      htmlLink: 'https://calendar.google.com/calendar/u/0/r/eventedit/mock-cal-1',
      status: 'confirmed',
      start: {
        dateTime: new Date(Date.now() + 86400000).toISOString().split('T')[0] + 'T09:30:00+01:00',
        timeZone: 'Africa/Algiers',
      },
      end: {
        dateTime: new Date(Date.now() + 86400000).toISOString().split('T')[0] + 'T10:15:00+01:00',
        timeZone: 'Africa/Algiers',
      },
      attendees: [{ email: 'karim.benali@example.com', displayName: 'Karim Benali', responseStatus: 'accepted' }],
      created: new Date().toISOString(),
      crmAppointmentId: 'RDV-DEMO-01',
    },
    {
      id: 'mock-cal-2',
      summary: 'RDV SERVI-DOX : SARL Atlas Tech (Domiciliation 1 an)',
      description: 'Signature contrat de domiciliation commerciale formule 1 an (98 000 DA) et procuration notariée.\nTéléphone: +213 661 78 90 12\nEmail: contact@atlastech.dz',
      location: "SERVI-DOX Centre d'Affaires, Bordj El Kiffan, Alger",
      htmlLink: 'https://calendar.google.com/calendar/u/0/r/eventedit/mock-cal-2',
      status: 'confirmed',
      start: {
        dateTime: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0] + 'T14:00:00+01:00',
        timeZone: 'Africa/Algiers',
      },
      end: {
        dateTime: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0] + 'T14:45:00+01:00',
        timeZone: 'Africa/Algiers',
      },
      attendees: [{ email: 'contact@atlastech.dz', displayName: 'Atlas Tech DZ', responseStatus: 'needsAction' }],
      created: new Date().toISOString(),
      crmAppointmentId: 'RDV-DEMO-02',
    },
  ];
};

/**
 * Sauvegarde un événement dans le cache local
 */
export const saveLocalCalendarEvent = (event: GoogleCalendarEvent) => {
  try {
    const list = getLocalCalendarEvents().filter((e) => e.id !== event.id);
    const updated = [event, ...list];
    localStorage.setItem(LOCAL_CALENDAR_CACHE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Erreur sauvegarde cache Google Calendar:', e);
  }
};

/**
 * Supprime un événement du cache local
 */
export const removeLocalCalendarEvent = (eventId: string) => {
  try {
    const list = getLocalCalendarEvents().filter((e) => e.id !== eventId);
    localStorage.setItem(LOCAL_CALENDAR_CACHE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Erreur suppression cache Google Calendar:', e);
  }
};

/**
 * Convertit date ('YYYY-MM-DD') et créneau ('09:30') en ISO RFC3339 pour Google Calendar (fuseau Alger +01:00)
 */
export const formatAlgerDateTime = (dateStr: string, timeStr: string, addMinutes: number = 0): string => {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);

    const d = new Date(year, month - 1, day, hours, minutes + addMinutes, 0);

    const pad = (n: number) => String(n).padStart(2, '0');
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const dt = pad(d.getDate());
    const h = pad(d.getHours());
    const min = pad(d.getMinutes());
    const s = pad(d.getSeconds());

    return `${y}-${m}-${dt}T${h}:${min}:${s}+01:00`;
  } catch {
    return `${dateStr}T${timeStr}:00+01:00`;
  }
};

/**
 * Récupère les événements depuis l'API officielle Google Calendar v3
 */
export const fetchGoogleCalendarEvents = async (
  accessToken: string,
  options?: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    query?: string;
  }
): Promise<{ events: GoogleCalendarEvent[]; isRealApi: boolean }> => {
  const isReal = !!(accessToken && !accessToken.startsWith('token-sandbox'));

  if (!isReal) {
    const local = getLocalCalendarEvents();
    let filtered = local;
    if (options?.query) {
      const q = options.query.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.summary.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.location?.toLowerCase().includes(q)
      );
    }
    return { events: filtered, isRealApi: false };
  }

  try {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', String(options?.maxResults || 50));

    if (options?.timeMin) {
      url.searchParams.set('timeMin', options.timeMin);
    } else {
      // Par défaut à partir d'il y a 30 jours
      const past = new Date(Date.now() - 30 * 86400000).toISOString();
      url.searchParams.set('timeMin', past);
    }

    if (options?.timeMax) {
      url.searchParams.set('timeMax', options.timeMax);
    }

    if (options?.query && options.query.trim()) {
      url.searchParams.set('q', options.query.trim());
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('Google Calendar API response error:', res.status, errText);
      return { events: getLocalCalendarEvents(), isRealApi: false };
    }

    const data = await res.json();
    const rawItems: any[] = data.items || [];

    const parsedEvents: GoogleCalendarEvent[] = rawItems.map((item) => ({
      id: item.id,
      summary: item.summary || 'Sans titre',
      description: item.description,
      location: item.location,
      htmlLink: item.htmlLink,
      status: item.status,
      start: item.start || {},
      end: item.end || {},
      attendees: item.attendees,
      created: item.created,
      updated: item.updated,
      crmAppointmentId: item.extendedProperties?.shared?.crmAppointmentId,
    }));

    // Synchroniser avec le cache local pour offline
    parsedEvents.forEach((ev) => saveLocalCalendarEvent(ev));

    return { events: parsedEvents, isRealApi: true };
  } catch (err) {
    console.warn('Erreur chargement Google Calendar API:', err);
    return { events: getLocalCalendarEvents(), isRealApi: false };
  }
};

/**
 * Crée un événement dans Google Calendar
 */
export const createGoogleCalendarEvent = async (
  accessToken: string,
  event: {
    summary: string;
    description: string;
    location?: string;
    startDateTime: string;
    endDateTime: string;
    attendees?: { email: string; displayName?: string }[];
    crmAppointmentId?: string;
  }
): Promise<GoogleCalendarEvent> => {
  const isReal = !!(accessToken && !accessToken.startsWith('token-sandbox'));

  const payload: any = {
    summary: event.summary,
    description: event.description,
    location: event.location || "SERVI-DOX Centre d'Affaires, Bordj El Kiffan, Alger",
    start: {
      dateTime: event.startDateTime,
      timeZone: 'Africa/Algiers',
    },
    end: {
      dateTime: event.endDateTime,
      timeZone: 'Africa/Algiers',
    },
    attendees: (event.attendees || []).filter((a) => a.email && a.email.includes('@')),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 30 },
        { method: 'email', minutes: 1440 }, // 24 heures avant
      ],
    },
  };

  if (event.crmAppointmentId) {
    payload.extendedProperties = {
      shared: {
        crmAppointmentId: event.crmAppointmentId,
        source: 'SERVI-DOX CRM',
      },
    };
  }

  if (isReal) {
    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Google Calendar API Error (${res.status}): ${errorText}`);
      }

      const createdItem = await res.json();
      const resultEvent: GoogleCalendarEvent = {
        id: createdItem.id,
        summary: createdItem.summary,
        description: createdItem.description,
        location: createdItem.location,
        htmlLink: createdItem.htmlLink,
        status: createdItem.status,
        start: createdItem.start,
        end: createdItem.end,
        attendees: createdItem.attendees,
        created: createdItem.created,
        crmAppointmentId: event.crmAppointmentId,
      };

      saveLocalCalendarEvent(resultEvent);
      return resultEvent;
    } catch (apiError) {
      console.warn('Erreur API Google Calendar, bascule sur enregistrement local:', apiError);
    }
  }

  // Fallback / Cache local
  const mockId = `cal-event-${Date.now()}`;
  const mockCreated: GoogleCalendarEvent = {
    id: mockId,
    summary: event.summary,
    description: event.description,
    location: event.location || "SERVI-DOX Centre d'Affaires, Bordj El Kiffan, Alger",
    htmlLink: `https://calendar.google.com/calendar/u/0/r/eventedit/${mockId}`,
    status: 'confirmed',
    start: {
      dateTime: event.startDateTime,
      timeZone: 'Africa/Algiers',
    },
    end: {
      dateTime: event.endDateTime,
      timeZone: 'Africa/Algiers',
    },
    attendees: event.attendees?.map((a) => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: 'needsAction',
    })),
    created: new Date().toISOString(),
    crmAppointmentId: event.crmAppointmentId,
  };

  saveLocalCalendarEvent(mockCreated);
  return mockCreated;
};

/**
 * Supprime un événement de Google Calendar
 */
export const deleteGoogleCalendarEvent = async (
  accessToken: string,
  eventId: string
): Promise<boolean> => {
  const isReal = !!(accessToken && !accessToken.startsWith('token-sandbox'));

  if (isReal && !eventId.startsWith('mock-') && !eventId.startsWith('cal-event-')) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (res.status === 204 || res.status === 200) {
        removeLocalCalendarEvent(eventId);
        return true;
      }
    } catch (e) {
      console.error('Erreur API suppression Google Calendar:', e);
    }
  }

  removeLocalCalendarEvent(eventId);
  return true;
};

/**
 * Synchronise un rendez-vous du CRM vers Google Calendar
 */
export const syncAppointmentToGoogleCalendar = async (
  accessToken: string,
  appointment: Appointment
): Promise<{ event: GoogleCalendarEvent; htmlLink: string }> => {
  const clientFullName = `${appointment.prenom || ''} ${appointment.nom || ''}`.trim() || 'Client SERVI-DOX';
  const startDateTime = formatAlgerDateTime(appointment.date, appointment.heure, 0);
  const endDateTime = formatAlgerDateTime(appointment.date, appointment.heure, 45); // 45 min de consultation

  const description = [
    `Rendez-vous Client SERVI-DOX`,
    `ID: ${appointment.id}`,
    `Client: ${clientFullName}`,
    `Téléphone: ${appointment.telephone || 'Non renseigné'}`,
    `Email: ${appointment.email || 'Non renseigné'}`,
    `Motif: ${appointment.motif}`,
    appointment.remarque ? `Remarque: ${appointment.remarque}` : '',
    `Statut: ${appointment.statut}`,
    `Lieu: Centre d'Affaires SERVI-DOX, Bordj El Kiffan, Alger`,
  ]
    .filter(Boolean)
    .join('\n');

  const attendees: { email: string; displayName?: string }[] = [];
  if (appointment.email && appointment.email.includes('@')) {
    attendees.push({
      email: appointment.email,
      displayName: clientFullName,
    });
  }

  const created = await createGoogleCalendarEvent(accessToken, {
    summary: `RDV SERVI-DOX : ${clientFullName} — ${appointment.motif}`,
    description,
    location: "SERVI-DOX Centre d'Affaires, Bordj El Kiffan, Alger",
    startDateTime,
    endDateTime,
    attendees,
    crmAppointmentId: appointment.id,
  });

  return {
    event: created,
    htmlLink: created.htmlLink || `https://calendar.google.com/calendar/u/0/r`,
  };
};

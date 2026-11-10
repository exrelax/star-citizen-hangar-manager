import { EVENTS } from '@/config';
import { eventNote } from '@/events/event-notes';
import type { StarCitizenEvent } from '@/events/events';
import type { Locale } from '@/i18n';
import type { AppNotification } from '@/notifications/notifications';

/*
 * The events of the demo (#210) instead of the website's file, with dates relative to now: a
 * running one with description, image and phases, and an upcoming one without description and
 * image – and the sidebar notification of each (kind "Events").
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** On the full hour, `days` days from now. */
const hourAt = (now: number, days: number) => Math.floor((now + days * DAY) / HOUR) * HOUR;

export function demoEvents(now: number): StarCitizenEvent[] {
  const start = hourAt(now, -1);
  return [
    {
      id: 'demo-expo',
      name: { en: 'Demo Aerospace Expo', de: 'Demo Aerospace Expo' },
      eventStart: start,
      eventEnd: hourAt(now, 6),
      displayStart: hourAt(now, -4),
      displayEnd: hourAt(now, 6),
      description: {
        en: 'Every day another manufacturer takes the stage, with new warbond offers in the Pledge Store.',
        de: 'Jeden Tag stellt ein anderer Hersteller aus, mit neuen Warbond-Angeboten im Pledge Store.',
      },
      // The website's image of an event: images come from the project website only.
      image: `${EVENTS.imageBase}images/events/iae-2956.jpg`,
      phases: [0, 1, 2, 3, 4, 5, 6].map((index) => ({
        start: start + index * DAY,
        name: { en: `Manufacturer day ${index + 1}`, de: `Herstellertag ${index + 1}` },
        shortName: { en: `Day ${index + 1}`, de: `Tag ${index + 1}` },
      })),
    },
    {
      id: 'demo-free-fly',
      name: { en: 'Demo Free Fly', de: 'Demo Free Fly' },
      eventStart: hourAt(now, 2),
      eventEnd: hourAt(now, 4),
      displayStart: hourAt(now, -1),
      displayEnd: hourAt(now, 4),
    },
  ];
}

/** The sidebar notifications of the demo's events. */
export const demoEventNotes = (now: number, locale: Locale): AppNotification[] =>
  demoEvents(now).map((event) => eventNote(event, locale, now));

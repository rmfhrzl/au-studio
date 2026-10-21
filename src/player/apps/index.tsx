import type { AppId } from '../PhoneContext';
import { MessagesApp, PhoneApp } from './core';
import { XApp } from './social';
import { MapsApp, MusicApp, PhotosApp } from './media';
import { CalendarApp, ClockApp, MailApp, NotesApp, SafariApp } from './info';
import { JournalApp, SearchApp, SettingsApp } from './system';

export function renderApp(app: AppId) {
  switch (app) {
    case 'messages':
      return <MessagesApp />;
    case 'phone':
      return <PhoneApp />;
    case 'x':
      return <XApp />;
    case 'photos':
      return <PhotosApp />;
    case 'mail':
      return <MailApp />;
    case 'notes':
      return <NotesApp />;
    case 'safari':
      return <SafariApp />;
    case 'calendar':
      return <CalendarApp />;
    case 'clock':
      return <ClockApp />;
    case 'settings':
      return <SettingsApp />;
    case 'music':
      return <MusicApp />;
    case 'maps':
      return <MapsApp />;
    case 'journal':
      return <JournalApp />;
    case 'search':
      return <SearchApp />;
    default:
      return null;
  }
}

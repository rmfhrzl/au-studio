import type { StoryProject, LocaleCode } from './schema';

/**
 * Story-content localisation.
 *
 * The engine always works on a *localised project*: a deep clone where every
 * translatable string has been replaced by its translation for the requested
 * locale (falling back to the source locale and finally to the original text).
 *
 * This keeps a single implementation of the story logic for the player and
 * for the editor preview, and avoids sprinkling `t()` calls over the engine.
 */

export interface TranslatableEntry {
  key: string;
  label: string;
  kind: string;
  source: string;
}

function fallbackText(project: StoryProject, locale: LocaleCode, key: string): string | undefined {
  const target = project.locales?.[locale]?.[key];
  if (typeof target === 'string' && target.length > 0) return target;
  const source = project.locales?.[project.project.defaultLocale]?.[key];
  if (typeof source === 'string' && source.length > 0) return source;
  return undefined;
}

function pick(
  project: StoryProject,
  locale: LocaleCode,
  key: string,
  original: string,
): string {
  if (locale === project.project.defaultLocale) return original;
  return fallbackText(project, locale, key) ?? original;
}

/** Lists every translatable string of the project, for the translation editor. */
export function collectTranslatableKeys(project: StoryProject): TranslatableEntry[] {
  const out: TranslatableEntry[] = [];
  const push = (key: string, label: string, kind: string, source: string) => {
    out.push({ key, label, kind, source });
  };

  push('project.title', 'Judul proyek', 'project', project.project.title);
  push('project.description', 'Deskripsi proyek', 'project', project.project.description);

  for (const character of project.characters) {
    push(`character.${character.id}.name`, `Karakter: ${character.name}`, 'character', character.name);
    if (character.bio) {
      push(`character.${character.id}.bio`, `Bio: ${character.name}`, 'character', character.bio);
    }
  }
  for (const contact of project.contacts) {
    push(`contact.${contact.id}.name`, `Kontak: ${contact.name}`, 'contact', contact.name);
    if (contact.status) {
      push(`contact.${contact.id}.status`, `Status: ${contact.name}`, 'contact', contact.status);
    }
  }
  for (const node of project.nodes) {
    push(`node.${node.id}.title`, `Node: ${node.title || node.id}`, 'node', node.title);
    if (node.type === 'choice') {
      if (node.prompt) {
        push(`node.${node.id}.prompt`, `Prompt: ${node.title || node.id}`, 'node', node.prompt);
      }
      for (const option of node.options) {
        push(`node.${node.id}.option.${option.id}.text`, `Pilihan @ ${node.title || node.id}`, 'option', option.text);
      }
    }
    if (node.type === 'dialogue') {
      for (const line of node.lines) {
        push(`node.${node.id}.line.${line.id}.text`, `Kalimat @ ${node.title || node.id}`, 'line', line.text);
      }
    }
    if (node.type === 'message' || node.type === 'timedEvent') {
      if (node.text) {
        push(`node.${node.id}.text`, `Pesan @ ${node.title || node.id}`, 'message', node.text);
      }
    }
  }
  for (const chat of project.chats) {
    for (const message of chat.messages) {
      push(`chat.${chat.id}.message.${message.id}.text`, `Pesan ${message.id}`, 'chat', message.text);
    }
  }
  for (const item of project.scheduledMessages) {
    push(`scheduled.${item.id}.text`, `Pesan terjadwal ${item.id}`, 'scheduled', item.text);
  }
  for (const call of project.calls) {
    for (const line of call.script) {
      push(`call.${call.id}.line.${line.id}.text`, `Kalimat telepon ${line.id}`, 'call', line.text);
    }
  }
  for (const post of project.socialPosts) {
    push(`post.${post.id}.text`, `Postingan ${post.id}`, 'post', post.text);
  }
  for (const email of project.emails) {
    push(`email.${email.id}.subject`, `Email: ${email.subject}`, 'email', email.subject);
    push(`email.${email.id}.body`, `Isi email ${email.id}`, 'email', email.body);
  }
  for (const note of project.notes) {
    push(`note.${note.id}.title`, `Catatan: ${note.title}`, 'note', note.title);
    push(`note.${note.id}.body`, `Isi catatan ${note.id}`, 'note', note.body);
  }
  for (const article of project.articles) {
    push(`article.${article.id}.title`, `Artikel: ${article.title}`, 'article', article.title);
    push(`article.${article.id}.body`, `Isi artikel ${article.id}`, 'article', article.body);
  }
  for (const ending of project.endings) {
    push(`ending.${ending.id}.title`, `Ending: ${ending.title}`, 'ending', ending.title);
    push(`ending.${ending.id}.summary`, `Ringkasan ending ${ending.id}`, 'ending', ending.summary);
    push(`ending.${ending.id}.epilogue`, `Epilog ending ${ending.id}`, 'ending', ending.epilogue);
  }
  for (const event of project.calendarEvents) {
    push(`calendar.${event.id}.title`, `Agenda: ${event.title}`, 'calendar', event.title);
  }
  for (const place of project.locations) {
    push(`location.${place.id}.name`, `Lokasi: ${place.name}`, 'location', place.name);
    push(`location.${place.id}.description`, `Deskripsi ${place.id}`, 'location', place.description);
  }
  for (const playlist of project.playlists) {
    push(`playlist.${playlist.id}.title`, `Playlist: ${playlist.title}`, 'playlist', playlist.title);
    for (const track of playlist.tracks) {
      push(`playlist.${playlist.id}.track.${track.id}.title`, `Lagu: ${track.title}`, 'playlist', track.title);
    }
  }
  return out;
}

/**
 * Returns a copy of the project with every translatable string replaced by
 * the translation for `locale` when one exists.
 */
export function localizeProject(project: StoryProject, locale: LocaleCode): StoryProject {
  if (locale === project.project.defaultLocale) return project;
  const clone = structuredClone(project) as StoryProject;

  clone.project.title = pick(project, locale, 'project.title', project.project.title);
  clone.project.description = pick(
    project,
    locale,
    'project.description',
    project.project.description,
  );

  for (const character of clone.characters) {
    character.name = pick(project, locale, `character.${character.id}.name`, character.name);
    if (character.bio) {
      character.bio = pick(project, locale, `character.${character.id}.bio`, character.bio);
    }
  }
  for (const contact of clone.contacts) {
    contact.name = pick(project, locale, `contact.${contact.id}.name`, contact.name);
    if (contact.status) {
      contact.status = pick(project, locale, `contact.${contact.id}.status`, contact.status);
    }
  }
  for (const node of clone.nodes) {
    node.title = pick(project, locale, `node.${node.id}.title`, node.title);
    if (node.type === 'choice') {
      if (node.prompt) {
        node.prompt = pick(project, locale, `node.${node.id}.prompt`, node.prompt);
      }
      node.options = node.options.map((option) => ({
        ...option,
        text: pick(project, locale, `node.${node.id}.option.${option.id}.text`, option.text),
      }));
    }
    if (node.type === 'dialogue') {
      node.lines = node.lines.map((line) => ({
        ...line,
        text: pick(project, locale, `node.${node.id}.line.${line.id}.text`, line.text),
      }));
    }
    if ((node.type === 'message' || node.type === 'timedEvent') && node.text) {
      node.text = pick(project, locale, `node.${node.id}.text`, node.text);
    }
  }
  for (const chat of clone.chats) {
    chat.messages = chat.messages.map((message) => ({
      ...message,
      text: pick(project, locale, `chat.${chat.id}.message.${message.id}.text`, message.text),
    }));
  }
  for (const item of clone.scheduledMessages) {
    item.text = pick(project, locale, `scheduled.${item.id}.text`, item.text);
  }
  for (const call of clone.calls) {
    call.script = call.script.map((line) => ({
      ...line,
      text: pick(project, locale, `call.${call.id}.line.${line.id}.text`, line.text),
    }));
  }
  for (const post of clone.socialPosts) {
    post.text = pick(project, locale, `post.${post.id}.text`, post.text);
  }
  for (const email of clone.emails) {
    email.subject = pick(project, locale, `email.${email.id}.subject`, email.subject);
    email.body = pick(project, locale, `email.${email.id}.body`, email.body);
  }
  for (const note of clone.notes) {
    note.title = pick(project, locale, `note.${note.id}.title`, note.title);
    note.body = pick(project, locale, `note.${note.id}.body`, note.body);
  }
  for (const article of clone.articles) {
    article.title = pick(project, locale, `article.${article.id}.title`, article.title);
    article.body = pick(project, locale, `article.${article.id}.body`, article.body);
  }
  for (const ending of clone.endings) {
    ending.title = pick(project, locale, `ending.${ending.id}.title`, ending.title);
    ending.summary = pick(project, locale, `ending.${ending.id}.summary`, ending.summary);
    ending.epilogue = pick(project, locale, `ending.${ending.id}.epilogue`, ending.epilogue);
  }
  for (const event of clone.calendarEvents) {
    event.title = pick(project, locale, `calendar.${event.id}.title`, event.title);
  }
  for (const place of clone.locations) {
    place.name = pick(project, locale, `location.${place.id}.name`, place.name);
    place.description = pick(project, locale, `location.${place.id}.description`, place.description);
  }
  for (const playlist of clone.playlists) {
    playlist.title = pick(project, locale, `playlist.${playlist.id}.title`, playlist.title);
    playlist.tracks = playlist.tracks.map((track) => ({
      ...track,
      title: pick(project, locale, `playlist.${playlist.id}.track.${track.id}.title`, track.title),
    }));
  }

  return clone;
}

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { LocaleCode } from '@/engine/schema';

/**
 * UI localisation.
 *
 * The dictionary is flat: key -> { id, en }. Missing translations fall back to
 * Indonesian (the source language) and, if that is missing too, to the key
 * itself, so the UI never renders a blank label.
 */

const dictionary = {
  'app.title': { id: 'AU Studio', en: 'AU Studio' },
  'app.tagline': {
    id: 'Buat dan mainkan cerita interaktif di dalam smartphone.',
    en: 'Create and play interactive stories inside a smartphone.',
  },
  'nav.studio': { id: 'Studio', en: 'Studio' },
  'nav.library': { id: 'Pustaka', en: 'Library' },
  'nav.back': { id: 'Kembali', en: 'Back' },
  'nav.close': { id: 'Tutup', en: 'Close' },
  'nav.home': { id: 'Beranda', en: 'Home' },
  'nav.language': { id: 'Bahasa', en: 'Language' },
  'nav.openStudio': { id: 'Buka Studio', en: 'Open Studio' },
  'nav.exitPreview': { id: 'Kembali ke editor', en: 'Back to editor' },

  'dashboard.title': { id: 'Studio AU', en: 'AU Studio' },
  'dashboard.subtitle': {
    id: 'Kelola cerita interaktif Anda.',
    en: 'Manage your interactive stories.',
  },
  'dashboard.new': { id: 'Buat cerita baru', en: 'New story' },
  'dashboard.empty.title': { id: 'Belum ada cerita', en: 'No stories yet' },
  'dashboard.empty.body': {
    id: 'Buat proyek pertama Anda, atau muat contoh cerita demo untuk mencoba seluruh sistem.',
    en: 'Create your first project, or load the demo story to try the whole system.',
  },
  'dashboard.loadDemo': { id: 'Muat cerita demo', en: 'Load demo story' },
  'dashboard.import': { id: 'Impor JSON', en: 'Import JSON' },
  'dashboard.exportAll': { id: 'Ekspor semua', en: 'Export all' },
  'dashboard.duplicate': { id: 'Duplikasi', en: 'Duplicate' },
  'dashboard.delete': { id: 'Hapus', en: 'Delete' },
  'dashboard.play': { id: 'Mainkan', en: 'Play' },
  'dashboard.edit': { id: 'Edit', en: 'Edit' },
  'dashboard.draft': { id: 'Draf', en: 'Draft' },
  'dashboard.published': { id: 'Terbit', en: 'Published' },
  'dashboard.updated': { id: 'Diperbarui', en: 'Updated' },
  'dashboard.confirmDelete': {
    id: 'Hapus cerita ini? Progres pemain juga akan terhapus.',
    en: 'Delete this story? Player progress will be removed too.',
  },
  'dashboard.storage': { id: 'Penyimpanan', en: 'Storage' },

  'editor.title': { id: 'Editor cerita', en: 'Story editor' },
  'editor.panel.assets': { id: 'Aset & node', en: 'Assets & nodes' },
  'editor.panel.graph': { id: 'Alur cerita', en: 'Story graph' },
  'editor.panel.properties': { id: 'Properti', en: 'Properties' },
  'editor.preview': { id: 'Preview', en: 'Preview' },
  'editor.addNode': { id: 'Tambah node', en: 'Add node' },
  'editor.autolayout': { id: 'Auto-layout', en: 'Auto layout' },
  'editor.validate': { id: 'Validasi', en: 'Validate' },
  'editor.coverage': { id: 'Cakupan ending', en: 'Ending coverage' },
  'editor.translations': { id: 'Terjemahan', en: 'Translations' },
  'editor.save': { id: 'Simpan', en: 'Save' },
  'editor.saved': { id: 'Tersimpan', en: 'Saved' },
  'editor.unsaved': { id: 'Belum tersimpan', en: 'Unsaved changes' },
  'editor.play': { id: 'Uji cerita', en: 'Test story' },
  'editor.restart': { id: 'Mulai ulang', en: 'Restart' },
  'editor.resetProgress': { id: 'Reset progres preview', en: 'Reset preview progress' },
  'editor.noSelection': {
    id: 'Pilih node di grafik untuk mengubah propertinya.',
    en: 'Select a node in the graph to edit its properties.',
  },
  'editor.activeNode': { id: 'Node aktif', en: 'Active node' },
  'editor.issues': { id: 'Masalah ditemukan', en: 'Issues found' },
  'editor.noIssues': { id: 'Tidak ada masalah.', en: 'No issues found.' },
  'editor.errors': { id: 'error', en: 'error' },
  'editor.warnings': { id: 'peringatan', en: 'warnings' },
  'editor.reachNode': { id: 'Lompat ke node', en: 'Jump to node' },
  'editor.findInEditor': { id: 'Cari di editor', en: 'Find in editor' },

  'node.type.start': { id: 'Mulai', en: 'Start' },
  'node.type.dialogue': { id: 'Percakapan', en: 'Dialogue' },
  'node.type.message': { id: 'Pesan', en: 'Message' },
  'node.type.choice': { id: 'Pilihan', en: 'Choice' },
  'node.type.timedEvent': { id: 'Event terjadwal', en: 'Timed event' },
  'node.type.incomingCall': { id: 'Panggilan masuk', en: 'Incoming call' },
  'node.type.outgoingCall': { id: 'Panggilan keluar', en: 'Outgoing call' },
  'node.type.socialPost': { id: 'Postingan sosial', en: 'Social post' },
  'node.type.conditional': { id: 'Percabangan bersyarat', en: 'Conditional' },
  'node.type.variableUpdate': { id: 'Ubah variabel', en: 'Variable update' },
  'node.type.ending': { id: 'Ending', en: 'Ending' },
  'node.type.failureEnding': { id: 'Ending gagal', en: 'Failure ending' },

  'field.title': { id: 'Judul internal', en: 'Internal title' },
  'field.text': { id: 'Teks', en: 'Text' },
  'field.character': { id: 'Karakter', en: 'Character' },
  'field.chat': { id: 'Percakapan', en: 'Chat' },
  'field.delay': { id: 'Jeda (ms)', en: 'Delay (ms)' },
  'field.typing': { id: 'Indikator mengetik (ms)', en: 'Typing indicator (ms)' },
  'field.nextNode': { id: 'Node tujuan', en: 'Target node' },
  'field.options': { id: 'Pilihan', en: 'Options' },
  'field.effects': { id: 'Dampak variabel', en: 'Variable effects' },
  'field.condition': { id: 'Kondisi', en: 'Condition' },
  'field.variable': { id: 'Variabel', en: 'Variable' },
  'field.value': { id: 'Nilai', en: 'Value' },
  'field.operator': { id: 'Operasi', en: 'Operation' },
  'field.ending': { id: 'Ending', en: 'Ending' },
  'field.call': { id: 'Skenario telepon', en: 'Call script' },
  'field.post': { id: 'Postingan', en: 'Post' },
  'field.wait': { id: 'Tunggu (detik)', en: 'Wait (seconds)' },
  'field.prompt': { id: 'Prompt', en: 'Prompt' },
  'field.addOption': { id: 'Tambah pilihan', en: 'Add option' },
  'field.addLine': { id: 'Tambah baris', en: 'Add line' },
  'field.addEffect': { id: 'Tambah dampak', en: 'Add effect' },
  'field.addBranch': { id: 'Tambah cabang', en: 'Add branch' },
  'field.keywords': { id: 'Kata kunci (untuk mengetik bebas)', en: 'Keywords (free text matching)' },
  'field.tapToConnect': { id: 'Ketuk node lalu tarik ke node lain.', en: 'Drag from a node handle to another node.' },

  'phone.lock': { id: 'Geser ke atas untuk membuka', en: 'Swipe up to open' },
  'phone.passcode': { id: 'Masukkan sandi', en: 'Enter passcode' },
  'phone.passcodeWrong': { id: 'Sandi salah', en: 'Wrong passcode' },
  'phone.locked': { id: 'Terkunci', en: 'Locked' },
  'phone.unlock': { id: 'Buka kunci', en: 'Unlock' },
  'phone.search': { id: 'Cari', en: 'Search' },
  'phone.app.messages': { id: 'Pesan', en: 'Messages' },
  'phone.app.phone': { id: 'Telepon', en: 'Phone' },
  'phone.app.x': { id: 'X', en: 'X' },
  'phone.app.photos': { id: 'Foto', en: 'Photos' },
  'phone.app.mail': { id: 'Mail', en: 'Mail' },
  'phone.app.notes': { id: 'Catatan', en: 'Notes' },
  'phone.app.safari': { id: 'Safari', en: 'Safari' },
  'phone.app.calendar': { id: 'Kalender', en: 'Calendar' },
  'phone.app.clock': { id: 'Jam', en: 'Clock' },
  'phone.app.settings': { id: 'Pengaturan', en: 'Settings' },
  'phone.app.music': { id: 'Musik', en: 'Music' },
  'phone.app.maps': { id: 'Peta', en: 'Maps' },
  'phone.app.journal': { id: 'Jurnal', en: 'Journal' },
  'phone.app.search': { id: 'Pencarian', en: 'Search' },

  'chat.you': { id: 'Kamu', en: 'You' },
  'chat.typing': { id: 'sedang mengetik', en: 'is typing' },
  'chat.write': { id: 'Tulis pesan', en: 'Write a message' },
  'chat.send': { id: 'Kirim', en: 'Send' },
  'chat.replyOptions': { id: 'Balasan', en: 'Replies' },
  'chat.chooseReply': { id: 'Pilih balasan', en: 'Choose a reply' },
  'chat.freeReply': {
    id: 'Balasan bebas tidak memengaruhi alur cerita.',
    en: 'Free replies do not affect the story path.',
  },
  'chat.freeMatched': { id: 'Balasan dicocokkan ke pilihan.', en: 'Reply matched to an option.' },
  'chat.freeIgnored': { id: 'Balasan tidak dikenali.', en: 'Reply not recognised.' },
  'chat.draft': { id: 'Draf', en: 'Draft' },
  'chat.today': { id: 'Hari ini', en: 'Today' },
  'chat.earlier': { id: 'Sebelumnya', en: 'Earlier' },

  'call.incoming': { id: 'Panggilan masuk', en: 'Incoming call' },
  'call.outgoing': { id: 'Panggilan keluar', en: 'Outgoing call' },
  'call.answer': { id: 'Jawab', en: 'Answer' },
  'call.decline': { id: 'Tolak', en: 'Decline' },
  'call.end': { id: 'Akhiri', en: 'End' },
  'call.mute': { id: 'Bisukan', en: 'Mute' },
  'call.speaker': { id: 'Speaker', en: 'Speaker' },
  'call.missed': { id: 'Panggilan terlewat', en: 'Missed call' },
  'call.declined': { id: 'Panggilan ditolak', en: 'Call declined' },
  'call.active': { id: 'Sedang berlangsung', en: 'In progress' },

  'journal.title': { id: 'Jurnal cerita', en: 'Story journal' },
  'journal.summary': { id: 'Ringkasan', en: 'Summary' },
  'journal.choices': { id: 'Pilihanmu', en: 'Your choices' },
  'journal.endings': { id: 'Ending', en: 'Endings' },
  'journal.transcript': { id: 'Transkrip panggilan', en: 'Call transcript' },
  'journal.none': { id: 'Belum ada ending.', en: 'No ending yet.' },
  'journal.replay': { id: 'Mainkan ulang', en: 'Play again' },
  'journal.inProgress': { id: 'Cerita masih berjalan.', en: 'The story is still running.' },
  'journal.variables': { id: 'Variabel cerita', en: 'Story variables' },

  'player.start': { id: 'Mulai cerita', en: 'Start story' },
  'player.continue': { id: 'Lanjutkan', en: 'Continue' },
  'player.restart': { id: 'Mulai dari awal', en: 'Start over' },
  'player.exit': { id: 'Keluar dari cerita', en: 'Leave story' },
  'player.endingReached': { id: 'Ending tercapai', en: 'Ending reached' },
  'player.freePlay': { id: 'Mode bebas', en: 'Free play' },

  'coverage.title': { id: 'Analisis jalur cerita', en: 'Story path analysis' },
  'coverage.reachable': { id: 'Node terjangkau', en: 'Reachable nodes' },
  'coverage.unreachable': { id: 'Node tak terjangkau', en: 'Unreachable nodes' },
  'coverage.endingsReachable': { id: 'Ending terjangkau', en: 'Reachable endings' },
  'coverage.endingsUnreachable': { id: 'Ending tak terjangkau', en: 'Unreachable endings' },
  'coverage.deadEnds': { id: 'Jalur buntu', en: 'Dead ends' },
  'coverage.paths': { id: 'Jalur', en: 'Paths' },
  'coverage.truncated': {
    id: 'Analisis dibatasi — hasilnya belum lengkap.',
    en: 'Analysis was bounded — results may be incomplete.',
  },
  'coverage.noEnding': { id: 'tidak berakhir di ending', en: 'does not reach an ending' },

  'common.cancel': { id: 'Batal', en: 'Cancel' },
  'common.confirm': { id: 'Konfirmasi', en: 'Confirm' },
  'common.delete': { id: 'Hapus', en: 'Delete' },
  'common.save': { id: 'Simpan', en: 'Save' },
  'common.close': { id: 'Tutup', en: 'Close' },
  'common.add': { id: 'Tambah', en: 'Add' },
  'common.remove': { id: 'Hapus', en: 'Remove' },
  'common.search': { id: 'Cari', en: 'Search' },
  'common.empty': { id: 'Kosong', en: 'Empty' },
  'common.none': { id: 'Tidak ada', en: 'None' },
  'common.loading': { id: 'Memuat…', en: 'Loading…' },
  'common.unavailable': { id: 'Belum tersedia', en: 'Not available yet' },
  'common.error': { id: 'Terjadi kesalahan', en: 'Something went wrong' },
  'common.done': { id: 'Selesai', en: 'Done' },
} as const;

export type TranslationKey = keyof typeof dictionary;

export interface I18nValue {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: TranslationKey | string, ...args: (string | number)[]) => string;
}

const I18nContext = createContext<I18nValue>({
  locale: 'id',
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({
  children,
  locale,
  setLocale,
}: {
  children: ReactNode;
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
}) {
  const t = useCallback(
    (key: TranslationKey | string, ...args: (string | number)[]) => {
      const entry = (dictionary as Record<string, { id: string; en: string }>)[key];
      const raw = entry ? entry[locale] ?? entry.id : undefined;
      const text = raw ?? String(key);
      return text.replace(/\{(\d+)\}/g, (_, index) => {
        const value = args[Number(index)];
        return value === undefined ? `{${index}}` : String(value);
      });
    },
    [locale],
  );

  const value = useMemo<I18nValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

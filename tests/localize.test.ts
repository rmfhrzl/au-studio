import { describe, expect, it } from 'vitest';
import { collectTranslatableKeys, localizeProject } from '@/engine/localize';
import { demoProject } from '@/data/demoStory';

describe('story localisation', () => {
  it('lists the translatable strings of the project', () => {
    const keys = collectTranslatableKeys(demoProject);
    expect(keys.length).toBeGreaterThan(20);
    expect(keys.some((k) => k.key === 'project.title')).toBe(true);
    expect(keys.some((k) => k.key.startsWith('node.'))).toBe(true);
  });

  it('uses the original text for the source locale', () => {
    const localized = localizeProject(demoProject, 'id');
    expect(localized.project.title).toBe(demoProject.project.title);
    expect(localized).toBe(demoProject);
  });

  it('applies the english translation when it exists', () => {
    const localized = localizeProject(demoProject, 'en');
    expect(localized.project.title).toBe('Last Signal');
    expect(localized.endings.find((e) => e.id === 'ending-rahasia')?.title).toBe('The Key on the Table');
  });

  it('falls back to the original text when a translation is missing', () => {
    const localized = localizeProject(demoProject, 'en');
    const source = demoProject.nodes.find((n) => n.id === 'b1-sore');
    const translated = localized.nodes.find((n) => n.id === 'b1-sore');
    expect(source?.type).toBe('dialogue');
    expect(translated?.type).toBe('dialogue');
    if (source?.type === 'dialogue' && translated?.type === 'dialogue') {
      expect(translated.lines[0].text).toBe(source.lines[0].text);
    }
  });

  it('does not modify the original project', () => {
    localizeProject(demoProject, 'en');
    expect(demoProject.project.title).toBe('Sinyal Terakhir');
  });
});

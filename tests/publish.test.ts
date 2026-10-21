// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { demoProject } from '@/data/demoStory';
import {
  buildPublishedHtml,
  publishKey,
  publishedKeyFromLocation,
  publishedStorageKey,
  readPublishedStory,
} from '@/studio/publish';

describe('static publishing', () => {
  it('builds an HTML package that embeds the story', () => {
    const key = publishKey(demoProject);
    const html = buildPublishedHtml(demoProject, key);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain(demoProject.project.title);
    expect(html).toContain(publishedStorageKey(key));
    expect(html).toContain('#story=');
  });

  it('escapes angle brackets so the payload cannot break out of the script tag', () => {
    const hostile = structuredClone(demoProject);
    hostile.project.description = '</script><script>alert(1)</script>';
    const html = buildPublishedHtml(hostile, 'kunci');
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('\\u003c/script>');
  });

  it('reads a published story back from local storage', () => {
    const key = 'story-key';
    window.localStorage.setItem(publishedStorageKey(key), JSON.stringify(demoProject));
    const project = readPublishedStory(key);
    expect(project?.project.title).toBe(demoProject.project.title);
  });

  it('returns null for a missing or corrupted published story', () => {
    expect(readPublishedStory('tidak-ada')).toBeNull();
    window.localStorage.setItem(publishedStorageKey('rusak'), '{bukan json');
    expect(readPublishedStory('rusak')).toBeNull();
  });

  it('extracts the story key from the location hash', () => {
    window.location.hash = '#story=abc123';
    expect(publishedKeyFromLocation()).toBe('abc123');
    window.location.hash = '';
    expect(publishedKeyFromLocation()).toBeNull();
  });
});

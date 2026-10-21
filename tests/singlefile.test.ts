// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { demoProject } from '@/data/demoStory';
import { injectStoryIntoShell } from '@/studio/singlefile';
import { resolveStandaloneStory } from '@/player/standalone';

const SHELL = `<!doctype html>
<html><head><title>AU</title>
<script id="au-story" type="application/json">null</script>
<script type="module" crossorigin>console.log('x')</script>
</head><body><div id="root"></div></body></html>`;

describe('ekspor satu file HTML', () => {
  it('menanamkan cerita ke dalam shell', () => {
    const html = injectStoryIntoShell(SHELL, demoProject);
    const match = /<script id="au-story" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
    expect(match).toBeTruthy();
    const parsed = JSON.parse(match![1]);
    expect(parsed.project.title).toBe(demoProject.project.title);
  });

  it('mengganti judul halaman dengan judul cerita', () => {
    const html = injectStoryIntoShell(SHELL, demoProject);
    expect(html).toContain(`<title>${demoProject.project.title}</title>`);
  });

  it('menutup tag script agar payload tidak bisa keluar', () => {
    const hostile = structuredClone(demoProject);
    hostile.project.description = '</script><script>alert(1)</script>';
    const html = injectStoryIntoShell(SHELL, hostile);
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('\\u003c/script>');
  });

  it('tidak mengubah bagian lain dari shell', () => {
    const html = injectStoryIntoShell(SHELL, demoProject);
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain("console.log('x')");
  });
});

describe('player mandiri', () => {
  it('memakai cerita demo saat tidak ada slot cerita', () => {
    document.body.innerHTML = '<script id="au-story" type="application/json">null</script>';
    const project = resolveStandaloneStory();
    expect(project?.project.id).toBe(demoProject.project.id);
  });

  it('memakai cerita yang ditanam di halaman', () => {
    const script = document.createElement('script');
    script.id = 'au-story';
    script.type = 'application/json';
    script.textContent = JSON.stringify(demoProject);
    document.body.appendChild(script);
    const project = resolveStandaloneStory();
    expect(project?.project.title).toBe(demoProject.project.title);
  });

  it('menolak payload rusak dan jatuh ke cerita demo', () => {
    const script = document.createElement('script');
    script.id = 'au-story';
    script.type = 'application/json';
    script.textContent = '{bukan json';
    document.body.appendChild(script);
    const project = resolveStandaloneStory();
    expect(project?.project.id).toBe(demoProject.project.id);
  });
});

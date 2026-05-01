import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

describe('package entrypoints', () => {
  it('exports only plugin functions from the package root', async () => {
    const mod = await import('../src/index.ts');

    expect(Object.keys(mod).sort()).toEqual(['CrofAIPlugin', 'default']);
    expect(mod.default).toBe(mod.CrofAIPlugin);
  });

  it('exports reusable helpers from the factory subpath', async () => {
    const mod = await import('../src/factory.ts');

    expect(Object.keys(mod).sort()).toEqual([
      'buildVariantDisplayName',
      'createOpenAICompatiblePlugin',
      'createReasoningVariants',
    ]);
  });

  it('does not publish broken or self-referential package metadata', () => {
    const testDir = dirname(fileURLToPath(import.meta.url));
    const packageJson = JSON.parse(readFileSync(join(testDir, '..', 'package.json'), 'utf8'));

    expect(packageJson.exports['./plugin']).toBeUndefined();
    expect(packageJson.exports['./factory'].import).toBe('./dist/factory.js');
    expect(packageJson.dependencies).toBeUndefined();
  });
});

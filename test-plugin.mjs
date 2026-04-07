import { CrofAIPlugin } from './dist/index.js';

async function testPlugin() {
  console.log('Testing CrofAI Plugin...');

  // Simulate OpenCode's plugin context
  const mockClient = {
    app: {
      log: console.log,
    },
    fs: {
      readJson: async () => ({}),
      writeJson: async () => {},
    },
  };

  const plugin = await CrofAIPlugin({
    client: mockClient,
    directory: '/tmp/opencode',
    project: { name: 'test-project' },
    $: {},
    worktree: '/tmp/worktree',
  });

  console.log('Plugin loaded successfully');

  // Test config hook
  const cfg = {};
  await plugin.config?.(cfg);
  console.log('Config hook result:', JSON.stringify(cfg, null, 2));

  // Verify provider was injected
  if (cfg.provider?.crofai) {
    console.log('✓ CrofAI provider registered in config');
    console.log('  - Provider ID:', cfg.provider.crofai);
    console.log('  - Base URL:', cfg.provider.crofai.options?.baseURL);
  } else {
    console.error('✗ CrofAI provider NOT registered in config');
    process.exit(1);
  }

  // Test auth hook
  if (plugin.auth) {
    console.log('✓ Auth hook registered');
    console.log('  - Provider ID:', plugin.auth.provider);
  } else {
    console.error('✗ Auth hook NOT registered');
    process.exit(1);
  }

  console.log('\nAll checks passed! Plugin should work with OpenCode.');
}

testPlugin().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

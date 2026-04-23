// Test script to verify CrofAI API model retrieval
const apiKey = process.env.CROFAI_API_KEY || '';

if (!apiKey) {
  console.error('Please set CROFAI_API_KEY environment variable');
  process.exit(1);
}

console.log('Fetching CrofAI models...');

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch('https://crof.ai/v1/models', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error response:', errorText);
    process.exit(1);
  }

  const data = await response.json();
  console.log('Response structure:', {
    hasData: !!data.data,
    isArray: Array.isArray(data.data),
    count: data.data?.length,
  });

  if (data.data && Array.isArray(data.data)) {
    console.log(`\nRetrieved ${data.data.length} available CrofAI models:`);
    data.data.forEach((model: any) => {
      const variantMatch = model.id.match(
        /-(lightning|precision|flash|turbo|extended|plus|pro|max|ultra)$/i
      );
      const variantLabel = variantMatch ? variantMatch[1].toLowerCase() : '';
      const nameAlreadyHasVariant =
        variantLabel !== '' && new RegExp(`(?:\\s|\\()${variantLabel}\\)?$`, 'i').test(model.name);
      const displayName =
        variantMatch && !nameAlreadyHasVariant
          ? `${model.name} ${variantMatch[1].charAt(0).toUpperCase() + variantMatch[1].slice(1)}`
          : model.name;
      console.log(`  - ${model.id}: ${displayName}`);
    });
  } else {
    console.error('Invalid response format:', JSON.stringify(data, null, 2));
  }
} catch (error) {
  clearTimeout(timeoutId);
  if (error instanceof Error && error.name === 'AbortError') {
    console.error('Request timed out after 30 seconds');
  } else {
    console.error('Error:', error);
  }
  process.exit(1);
}

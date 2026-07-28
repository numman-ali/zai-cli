import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ZaiMcpClient } from '../dist/lib/mcp-client.js';

test('webSearch calls the discovered snake-case search tool', async () => {
  const client = new ZaiMcpClient({ enableVision: false });
  let called;
  client.callTool = async (toolName, args) => {
    called = { toolName, args };
    return [];
  };

  const result = await client.webSearch({
    query: 'hello world',
    recencyFilter: 'oneWeek',
    location: 'us',
  });

  assert.deepEqual(result, []);
  assert.deepEqual(called, {
    toolName: 'zai.search.web_search_prime',
    args: {
      search_query: 'hello world',
      search_recency_filter: 'oneWeek',
      location: 'us',
    },
  });
});

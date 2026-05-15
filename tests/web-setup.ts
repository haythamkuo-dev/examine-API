import { afterAll, afterEach, expect } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { cleanup } from '@testing-library/react';
import * as domMatchers from '@testing-library/jest-dom/matchers';

GlobalRegistrator.register();
expect.extend(domMatchers);

const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

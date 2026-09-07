import { rmSync } from 'node:fs';
rmSync(new URL('../.domain-build/', import.meta.url), { recursive: true, force: true });

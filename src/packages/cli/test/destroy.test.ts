import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { it, describe, beforeEach, afterEach, expect, vi } from 'vitest';

import { destroy } from '../commands/destroy';
import { resource } from '../generator/utils/generate-type';

const ROUTES = `export default function routes() {
}
`;

// `destroy resource` undoes `generate resource`, in a scratch app.
describe('module "cli" #destroy()', () => {
  let cwd: string;
  let output: string;

  const generate = (name: string) =>
    resource({
      cwd,
      type: 'resource',
      name,
      attrs: ['name:string'],
      onConflict: async () => false
    });

  const files = async (dir: string) =>
    (await readdir(join(cwd, dir), { recursive: true })).sort();

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'lumen-destroy-'));
    await mkdir(join(cwd, 'app'), { recursive: true });
    await mkdir(join(cwd, 'db', 'migrate'), { recursive: true });
    await writeFile(join(cwd, 'app', 'routes.js'), ROUTES);

    output = '';
    vi.spyOn(process.stdout, 'write').mockImplementation(text => {
      output += String(text);
      return true;
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(cwd, { recursive: true, force: true });
  });

  it('removes everything a namespaced resource generated', async () => {
    await generate('admin/tags');
    output = '';

    await destroy({ type: 'resource', name: 'admin/tags', cwd });

    expect(await files('app/models')).to.deep.equal([]);
    expect(await files('db/migrate')).to.deep.equal([]);
    expect(await files('app/controllers')).to.deep.equal([
      'admin',
      'admin/application.js'
    ]);
    expect(output).to.include('remove app/models/tag.js');
    expect(output).not.to.include('app/routes.js');
  });

  it('removes a root resource and its route', async () => {
    await generate('tags');
    output = '';

    await destroy({ type: 'resource', name: 'tags', cwd });

    expect(await files('app/models')).to.deep.equal([]);
    expect(await files('db/migrate')).to.deep.equal([]);
    expect(await files('app/controllers')).to.deep.equal([]);
    expect(
      (await readFile(join(cwd, 'app', 'routes.js'), 'utf8')).trim()
    ).to.equal(ROUTES.trim());
    expect(output).to.include('update app/routes.js');
  });

  it("keeps a model another namespace's resource still uses", async () => {
    await generate('tags');
    await generate('admin/tags');
    output = '';

    await destroy({ type: 'resource', name: 'admin/tags', cwd });

    expect(await files('app/models')).to.deep.equal(['tag.js']);
    expect(await files('db/migrate')).to.have.length(1);
    expect(await files('app/controllers')).to.include('tags.js');
    expect(output).to.include(
      'keep app/models/tag.js and its migration (used by app/controllers/tags.js)'
    );
  });
});

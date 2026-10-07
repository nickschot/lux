// Boots the app and checks a handful of representative requests end to end.
// Run after `pnpm run db:setup`: `pnpm run smoke`.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = process.env.PORT || '4321';
const BASE = `http://localhost:${PORT}`;
const TYPE = 'application/vnd.api+json';

const server = spawn('node_modules/.bin/lumen', ['serve', '-p', PORT], {
  stdio: ['ignore', 'inherit', 'inherit']
});

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': TYPE } : {},
    body: body && JSON.stringify(body)
  });
  const text = await res.text();

  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      await fetch(BASE);
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`server did not start on ${BASE}`);
}

const checks = {
  async 'visibility: private posts exist only under /admin'() {
    const admin = await request('/admin/posts?page[size]=50&sort=createdAt');
    const priv = admin.json.data.find(post => !post.attributes['is-public']);
    assert.ok(priv, 'the seed should contain a private post');

    assert.equal((await request(`/posts/${priv.id}`)).status, 404);
    assert.equal((await request(`/admin/posts/${priv.id}`)).status, 200);

    const listed = await request('/posts?page[size]=50');
    assert.ok(listed.json.data.every(post => post.id !== priv.id));
  },

  async 'compound document with a sparse fieldset'() {
    const { status, json } = await request(
      '/posts?include=user&fields[posts]=title&page[size]=5'
    );
    assert.equal(status, 200);
    assert.deepEqual(Object.keys(json.data[0].attributes), ['title']);
    assert.ok(json.included.some(resource => resource.type === 'users'));
  },

  async 'related endpoint pages like an index'() {
    const { json: posts } = await request('/posts?page[size]=1');
    const { status, json } = await request(
      `/posts/${posts.data[0].id}/comments?page[size]=2`
    );
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.data));
    assert.ok('first' in json.links);
  },

  async 'linksOnly: members get comments as a link'() {
    const { json: posts } = await request('/members/posts?page[size]=1');
    const { comments } = posts.data[0].relationships;
    assert.equal(comments.data, undefined);
    assert.match(comments.links.related, /\/members\/posts\/\d+\/comments$/);
  },

  async 'a serializer per namespace'() {
    const { json: pub } = await request('/users/1');
    const { json: admin } = await request('/admin/users/1');
    assert.equal(pub.data.attributes.email, undefined);
    assert.equal(typeof admin.data.attributes.email, 'string');
  },

  async 'allow-lists: an unlisted sort is a 400'() {
    const { status, json } = await request('/posts?sort=body');
    assert.equal(status, 400);
    assert.equal(json.errors[0].source.parameter, 'sort');
  },

  async 'create, update and delete'() {
    const created = await request('/posts', {
      method: 'POST',
      body: {
        data: {
          type: 'posts',
          attributes: { title: 'Hello', body: 'First post', 'is-public': true },
          relationships: { user: { data: { type: 'users', id: '1' } } }
        }
      }
    });
    assert.equal(created.status, 201);
    const { id } = created.json.data;

    const updated = await request(`/posts/${id}`, {
      method: 'PATCH',
      body: { data: { id, type: 'posts', attributes: { title: 'Hi' } } }
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.data.attributes.title, 'Hi');

    assert.equal((await request(`/posts/${id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await request(`/posts/${id}`)).status, 404);
  }
};

let failed = 0;

try {
  await waitForServer();

  for (const [name, check] of Object.entries(checks)) {
    try {
      await check();
      console.log(`ok   ${name}`);
    } catch (error) {
      failed++;
      console.log(`FAIL ${name}\n     ${error.message}`);
    }
  }
} finally {
  server.kill();
}

process.exit(failed ? 1 : 0);

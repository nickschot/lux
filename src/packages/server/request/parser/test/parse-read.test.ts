import { parse as parseURL } from 'url';

import { it, describe, expect } from 'vitest';

import parseRead from '../utils/parse-read';
import type { Request } from '../../interfaces';

const paramsFor = (search: string) =>
  parseRead({
    method: 'GET',
    url: parseURL(`/posts?${search}`, true)
  } as unknown as Request);

describe('module "server/request/parser" #parseRead()', () => {
  it('parses consecutive bracketed parameters', () => {
    expect(paramsFor('page[size]=2&page[number]=3')).to.deep.equal({
      page: { size: 2, number: 3 }
    });
  });

  describe('fields', () => {
    it('parses every fieldset', () => {
      expect(
        paramsFor('fields[posts]=title,user&fields[users]=name').fields
      ).to.deep.equal({
        posts: ['title', 'user'],
        users: ['name']
      });
    });

    it('camelizes member names', () => {
      expect(paramsFor('fields[posts]=created-at').fields).to.deep.equal({
        posts: ['createdAt']
      });
    });

    it('keeps resource types as written', () => {
      expect(paramsFor('fields[blog-posts]=title').fields).to.deep.equal({
        'blog-posts': ['title']
      });
    });

    it('parses an empty fieldset as an empty list', () => {
      expect(paramsFor('fields[posts]=').fields).to.deep.equal({
        posts: []
      });
    });
  });

  describe('values', () => {
    it('keeps the case of comma-separated values', () => {
      expect(paramsFor('filter[title]=Mixed Case,Other').filter).to.deep.equal({
        title: ['Mixed Case', 'Other']
      });
    });

    it('coerces each value of a list', () => {
      expect(paramsFor('filter[user-id]=1,2,null').filter).to.deep.equal({
        userId: [1, 2, null]
      });
    });
  });

  describe('include', () => {
    it('camelizes every member name of a path', () => {
      expect(
        paramsFor('include=user,comments.blog-author').include
      ).to.deep.equal(['user', 'comments.blogAuthor']);
    });
  });
});

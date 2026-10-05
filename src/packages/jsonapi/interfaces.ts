type JSONAPI$value =
  | string
  | number
  | boolean
  | JSONAPI$BaseObject
  | Array<JSONAPI$BaseObject>
  | null
  | undefined;

interface JSONAPI$BaseObject {
  [key: string]: JSONAPI$value;
  meta?: JSONAPI$BaseObject;
}

interface JSONAPI$LinkObject {
  href: string;
  meta?: JSONAPI$BaseObject;
}

type JSONAPI$Link = string | JSONAPI$LinkObject | null;

interface JSONAPI$ResourceLinksObject {
  self?: JSONAPI$Link;
  related?: JSONAPI$Link;
}

export type JSONAPI$versions = '1.0';

export interface JSONAPI$IdentifierObject {
  id: string;
  type: string;
  meta?: JSONAPI$BaseObject;
}

export interface JSONAPI$ResourceObject {
  id: string;
  type: string;
  links?: JSONAPI$ResourceLinksObject;
  attributes?: JSONAPI$BaseObject;

  relationships?: {
    [key: string]: JSONAPI$RelationshipObject | null | undefined;
  };
}

export interface JSONAPI$RelationshipObject {
  // Resource linkage: `null`/one identifier for to-one relationships, an array
  // for to-many ones.
  data: JSONAPI$IdentifierObject | Array<JSONAPI$IdentifierObject> | null;
  meta?: JSONAPI$BaseObject;
  links?: JSONAPI$ResourceLinksObject;
}

export interface JSONAPI$DocumentLinks extends JSONAPI$ResourceLinksObject {
  first?: JSONAPI$Link;
  last?: JSONAPI$Link;
  prev?: JSONAPI$Link | null;
  next?: JSONAPI$Link | null;
}

export interface JSONAPI$ErrorObject {
  id?: string;
  code?: string;
  meta?: JSONAPI$BaseObject;
  title?: string;
  status?: string;
  detail?: string;

  links?: {
    about: JSONAPI$Link;
  };

  source?: {
    pointer?: string;
    parameter?: string;
  };
}

export interface JSONAPI$Document {
  data?: Array<JSONAPI$ResourceObject> | JSONAPI$ResourceObject;
  meta?: JSONAPI$BaseObject;
  links?: JSONAPI$DocumentLinks;
  errors?: Array<JSONAPI$ErrorObject>;
  included?: Array<JSONAPI$ResourceObject>;

  jsonapi?: {
    version: JSONAPI$versions;
    meta?: JSONAPI$BaseObject;
  };
}

/**
 * The document a relationship endpoint responds with: the relationship's
 * resource linkage as primary data.
 */
export interface JSONAPI$RelationshipDocument extends Omit<
  JSONAPI$RelationshipObject,
  'links'
> {
  links: JSONAPI$ResourceLinksObject;

  jsonapi: {
    version: JSONAPI$versions;
  };
}

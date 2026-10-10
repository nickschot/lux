type JsonApiValue =
  | string
  | number
  | boolean
  | JsonApiBaseObject
  | Array<JsonApiBaseObject>
  | null
  | undefined;

interface JsonApiBaseObject {
  [key: string]: JsonApiValue;
  meta?: JsonApiBaseObject;
}

interface JsonApiLinkObject {
  href: string;
  meta?: JsonApiBaseObject;
}

type JsonApiLink = string | JsonApiLinkObject | null;

interface JsonApiResourceLinksObject {
  self?: JsonApiLink;
  related?: JsonApiLink;
}

export type JsonApiVersion = '1.0';

export interface JsonApiIdentifierObject {
  id: string;
  type: string;
  meta?: JsonApiBaseObject;
}

export interface JsonApiResourceObject {
  id: string;
  type: string;
  links?: JsonApiResourceLinksObject;
  attributes?: JsonApiBaseObject;

  relationships?: {
    [key: string]: JsonApiRelationshipObject | null | undefined;
  };
}

export interface JsonApiRelationshipObject {
  // Resource linkage: `null`/one identifier for to-one relationships, an array
  // for to-many ones. Left out of a relationship serialized as links only.
  data?: JsonApiIdentifierObject | Array<JsonApiIdentifierObject> | null;
  meta?: JsonApiBaseObject;
  links?: JsonApiResourceLinksObject;
}

export interface JsonApiDocumentLinks extends JsonApiResourceLinksObject {
  first?: JsonApiLink;
  last?: JsonApiLink;
  prev?: JsonApiLink | null;
  next?: JsonApiLink | null;
}

export interface JsonApiErrorObject {
  id?: string;
  code?: string;
  meta?: JsonApiBaseObject;
  title?: string;
  status?: string;
  detail?: string;

  links?: {
    about: JsonApiLink;
  };

  source?: {
    pointer?: string;
    parameter?: string;
  };
}

export interface JsonApiDocument {
  data?: Array<JsonApiResourceObject> | JsonApiResourceObject;
  meta?: JsonApiBaseObject;
  links?: JsonApiDocumentLinks;
  errors?: Array<JsonApiErrorObject>;
  included?: Array<JsonApiResourceObject>;

  jsonapi?: {
    version: JsonApiVersion;
    meta?: JsonApiBaseObject;
  };
}

/**
 * The document a relationship endpoint responds with: the relationship's
 * resource linkage as primary data.
 */
export interface JsonApiRelationshipDocument extends Omit<
  JsonApiRelationshipObject,
  'links'
> {
  links: JsonApiResourceLinksObject;

  jsonapi: {
    version: JsonApiVersion;
  };
}

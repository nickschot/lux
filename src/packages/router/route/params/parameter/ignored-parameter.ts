import Parameter from './index';

/**
 * A member the resource has but the controller does not accept (e.g. a
 * read-only `createdAt`). It is dropped from the validated params instead of
 * being rejected, so clients that send whole resources back — ember-data
 * serializes every attribute — keep working. A member the resource does not
 * have at all is still a 400. See nickschot/lux#47.
 *
 * @private
 */
class IgnoredParameter extends Parameter {
  constructor(path: string) {
    super({ path });
  }
}

export default IgnoredParameter;

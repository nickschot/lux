export default {
  logging: {
    level: 'INFO',
    format: 'json',
    enabled: true,
    requestBody: false,

    // `password`, `secret` and `token` are always filtered; this adds to them.
    filter: {
      params: ['email']
    }
  }
};

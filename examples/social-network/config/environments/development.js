export default {
  server: {
    // Lets a front-end dev server on another port call the API.
    cors: {
      enabled: true,
      origin: '*',
      headers: ['Accept', 'Content-Type'],
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
    }
  },

  logging: {
    level: 'DEBUG',
    format: 'text',
    enabled: true,
    requestBody: true,

    filter: {
      params: []
    }
  }
};

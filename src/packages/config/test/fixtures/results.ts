import { NODE_ENV } from '../../../../constants';

const isTestENV = NODE_ENV === 'test';
const isProdENV = NODE_ENV === 'production';

export const CREATE_DEFAULT_CONFIG_RESULT = {
  server: {
    cors: {
      enabled: false
    },
    trustProxy: false
  },
  logging: {
    level: isProdENV ? 'INFO' : 'DEBUG',
    format: isProdENV ? 'json' : 'text',
    enabled: !isTestENV,
    requestBody: !isProdENV,

    filter: {
      params: []
    }
  }
};

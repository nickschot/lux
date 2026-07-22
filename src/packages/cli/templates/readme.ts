import template from '../../template';

/**
 * @private
 */
export default (name: string): string => template`
  # ${name}

  ## Installation

  *   \`git clone https://github.com/<this-repository>\`
  *   \`cd ${name}\`
  *   \`npm install\`

  ## Running / Development

  *   \`lumen serve\`

  ## Testing

  *   \`lumen test\`

  ## Further Reading / Useful Links
  *   [Lumen](https://github.com/nickschot/lux/)
  *   [Chai](http://chaijs.com/) / [Mocha](http://mochajs.org/)
`;

const path = require('path');
const { toMatchFile } = require('jest-file-snapshot');
const { create } = require('../index');

expect.extend({ toMatchFile });

const config = {
  plugins: [require.resolve('../__fixtures__/plugin')],
};

describe('basic usage', () => {
  const { test, fixtures } = create(config);

  fixtures('reverses identifiers', path.join(__dirname, '..', '__fixtures__'));

  test('throws error', async ({ transform }) => {
    expect.assertions(1);

    try {
      await transform('const error = 42');
    } catch (e) {
      expect(e.message).toMatch('The identifier "error" is not supported');
    }
  });
});

describe('custom transform', () => {
  const { test, fixtures } = create(config, {
    transform: code =>
      require('babel-core').transform(code, { babelrc: false, ...config }),
  });

  fixtures('reverses identifiers', path.join(__dirname, '..', '__fixtures__'));

  test('throws error', async ({ transform }) => {
    expect.assertions(1);

    try {
      await transform('const error = 42');
    } catch (e) {
      expect(e.message).toMatch('The identifier "error" is not supported');
    }
  });
});

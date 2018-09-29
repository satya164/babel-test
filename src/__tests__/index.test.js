const path = require('path');
const { toMatchFile } = require('jest-file-snapshot');
const { create } = require('../index');

expect.extend({ toMatchFile });

const config = {
  plugins: [require.resolve('../__fixtures__/plugin')],
  babelrc: false,
};

const { test, fixtures } = create([
  {
    title: 'babel 6',
    transform: code => require('babel-core').transform(code, config),
  },
  {
    title: 'babel 7',
    transform: code => require('@babel/core').transformAsync(code, config),
  },
]);

fixtures('reverses identifiers', path.join(__dirname, '..', '__fixtures__'));

test('throws error', async ({ transform }) => {
  expect.assertions(1);

  try {
    await transform('const error = 42');
  } catch (e) {
    expect(e.message).toMatch('The identifier "error" is not supported');
  }
});

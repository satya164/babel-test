# babel-tester

An opinionated library to make testing Babel plugins easier with Jest.

<img alt="Demo" src="demo/demo.gif" width="626">

## Why

I like to use fixture files instead of snapshots for testing my Babel plugins because it's easier to read with proper syntax highlighting. But I missed the features of snapshots, i.e. creating and updating snapshots with press of a key. It was too annoying to copy paste transformed code from the terminal every time. So I wanted to make something which integrates with Jest's snapshot feature.

In addition, I felt that the current solutions add too much abstraction and I wanted to make something simpler.

## Installation

```sh
npm install --save-dev babel-tester
```

or

```sh
yarn add --dev babel-tester
```

## Usage

The library exports a `create` function, which you can use to create helpers for your test using a babel config. The `fixtures` function from the returned object can be used to run tests against a directory containing fixtures:

```js
import { create } from 'babel-tester';

const { fixtures } = create({
  plugins: [require.resolve('./my-plugin')],
});

fixtures('my plugin', path.join(__dirname, '__fixtures__'));
```

## API

Calling the `create` function with a babel config returns an object with `test` and `fixtures` functions:

```js
import { create } from 'babel-tester';

const { test, fixtures } = create({
  plugins: [require.resolve('./my-plugin')],
});
```

You can pass anything that babel supports to the `create` function. It'll additionally set `babelrc` and `configFile` options to `false` by default if you haven't explicitly passed it. This avoids your tests being affected by external babel configuration.

Sometimes it's useful to test a plugin against a different babel instance. The `create` function accepts a `transform` option which you can use to test against a custom babel instance:

```js
const { test, fixtures } = create(config, {
  // transform function for babel 6
  transform: code => require('babel-core').transform(code, config),
});
```

To run the tests against a directory with fixtures, you can use the `fixtures` function returned from `create`:

```js
fixtures('my plugin', path.join(__dirname, '__fixtures__'));
```

It accepts a title for the `describe` block and the path to the directory containing the fixtures, and optionally a custom callback to configure the output file. The default callback looks like this:

```js
async ({ input, transform }) => {
  try {
    const { code } = await transform(input.content);

    return {
      filename: path.dirname(input.filename, 'output.js'),
      content: code,
    };
  } catch (e) {
    return {
      filename: path.dirname(input.filename, 'error.txt'),
      content: e.stack,
    };
  }
})
```

The fixtures directory should contain subdirectories with test files. Every test should contain a `code.js` file, which will be used as the input. If the transform should throw, it should have an `error.js` file. If the transform should pass, it should have an `output.js` file with the transformed code. The title for each test will be based the name of the directory. The first argument is used as the title for the describe block.

You can use `fixtures.skip` and `fixtures.only`, similar to Jest's `describe.skip` and `describe.only`. To skip an individual fixture, you can rename the fixture's directory to `skip.name-of-the-fixture`, and to run a specific fixture, you can rename the fixture's directory to `only.name-of-the-fixture`.

This also optionally integrates with Jest's snapshot feature using `jest-file-snapshot` (see below).

To run a test with some custom logic, you can use the `test` function returned from `create`:

```js
test('transpiles const to var', ({ transform }) => {
  const { code } = await transform('const foo = 42');

  expect(code).toBe('var foo = 42');
});
```

It accepts a title for the test and a callback containing the test. The callback will receive a `transform` function, and should return a promise if it's asynchronous.

You can use `test.skip` and `test.only`, similar to Jest's `it.skip` and `it.only`.

## Integration with Jest snapshot

Integrating with Jest snapshots allows you to automatically create and update output files. To integrate with Jest snapshots, you need to:

Install and add the [jest-file-snapshot](https://github.com/satya164/jest-file-snapshot) matcher:

```js
import { toMatchFile } from 'jest-file-snapshot';

expect.extend({ toMatchFile });
```

Then configure the Jest watcher to ignore output files by adding the following under the `jest` key in `package.json`:

```js
"watchPathIgnorePatterns": [
  "__fixtures__\\/[^/]+\\/(output|error)\\.js"
]
```

Now you can create and update the output files like you would do with snapshots.

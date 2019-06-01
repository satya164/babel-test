# babel-test

[![Build Status][build-badge]][build]
[![Code Coverage][coverage-badge]][coverage]
[![MIT License][license-badge]][license]
[![Version][version-badge]][package]

An opinionated library to make testing babel plugins easier.

<img alt="Demo" src="demo/demo.gif" width="626">

## Why

I like to use fixture files instead of snapshots for testing my babel plugins because it's easier to read with proper syntax highlighting. But I missed the features of snapshots, i.e. creating and updating snapshots with press of a key. It was too annoying to copy paste transformed code from the terminal every time. So I wanted to make something which integrates with Jest's snapshot feature.

I also felt that the current solutions add too much abstraction and I wanted to make something simpler. I built this instead of contributing to existing tools because it's not addressing lack of features in existing tools, but exploring a different API.

The tool works with [Jest](https://jestjs.io/) (recommended) or any testing framework which provides the `describe` and `it` global functions, such as [Mocha](https://mochajs.org/).

## Installation

```sh
npm install --save-dev babel-test
```

or

```sh
yarn add --dev babel-test
```

## Usage

The library exports a `create` function, which you can use to create helpers for your test using a babel config. The `fixtures` function from the returned object can be used to run tests against a directory containing fixtures:

```js
import path from 'path';
import { create } from 'babel-test';

const { fixtures } = create({
  plugins: [require.resolve('./my-plugin')],
});

fixtures('my plugin', path.join(__dirname, '__fixtures__'));
```

## API

Calling the `create` function with a babel config returns an object with `test` and `fixtures` functions:

```js
import { create } from 'babel-test';

const { test, fixtures } = create({
  plugins: [require.resolve('./my-plugin')],
});
```

The `create` function accepts the same [`options` object as Babel](https://babeljs.io/docs/en/options). It'll additionally set `babelrc` and `configFile` options to `false` by default if you haven't explicitly passed them. This avoids your tests being affected by external babel configuration.

### Testing fixtures

To run the tests against a directory with fixtures, you can use the `fixtures` function returned from `create`:

```js
fixtures('my plugin', path.join(__dirname, '__fixtures__'));
```

It accepts a title for the `describe` block and the absolute path to the directory containing the fixtures.

The fixtures directory should contain subdirectories with test files. Every test should contain a `code.js` file, which will be used as the input. If the transform should throw, it should have an `error.js` file. If the transform should pass, it should have an `output.js` file with the transformed code. The title for each test will be based the name of the directory. The first argument is used as the title for the describe block.

```sh
.
├── function-expression
│   ├── code.js
│   └── output.js
├── invalid-syntax
│   ├── code.js
│   └── error.js
└── simple-variable
    ├── code.js
    └── output.js
```

You can use `fixtures.skip` and `fixtures.only`, similar to Jest's `describe.skip` and `describe.only`. To skip an individual fixture, you can rename the fixture's directory to `skip.name-of-the-fixture`, and to run a specific fixture only, you can rename the fixture's directory to `only.name-of-the-fixture`.

To use hooks such as `beforeEach`, `afterEach`, `beforeAll` and `afterAll`, you can pass an object with these properties as the third argument:

```js
fixtures('my plugin', path.join(__dirname, '__fixtures__'), {
  beforeEach() {
    // Do some setup here
  },
});
```

By default, it will compare the outputs with the files on the filesystem and you have to manually update the files in case of a mismatch. If you're using Jest, you can use the snapshot feature to automatically update the files with a keypress. ([See below](#integration-with-jest-snapshot)) on how to set it up.

### Standalone test

To run a standalone test with some custom logic, you can use the `test` function returned from `create`:

```js
test('transpiles const to var', ({ transform }) => {
  const { code } = await transform('const foo = 42', { filename: 'foo.js' });

  expect(code).toBe('var foo = 42');
});
```

It accepts a title for the test and a callback containing the test. The callback will receive a `transform` function, and should return a promise if it's asynchronous. The `transform` function takes an optional second parameter containing additional options for Babel, useful for passing additional information such as `filename` required by some plugins.

You can use `test.skip` and `test.only`, similar to Jest's `it.skip` and `it.only`.

### Custom transform

Sometimes it's useful to test a plugin against a different babel instance. You can pass a `transform` function to `create` instead of a `config` object to test against a custom babel instance:

```js
const { test, fixtures } = create((code, options) =>
  // transform function for babel 6
  require('babel-core').transform(
    code,
    Object.assign(
      {
        babelrc: false,
        plugins: [require.resolve('./my-plugin')],
      },
      options
    )
  )
);
```

The custom `transform` function will receive the `code` and additional `options` for babel (such as `filename`) and should return an object with `code` property containing the transformed code.

If you're using the same fixtures directory with a different transform function, keep in mind that the same plugins can produce slightly different code in a different Babel version, and it's likely that error stack traces will be different. In these cases, there will be conflicts when updating the snapshots. It'll be better to separately test those fixtures for the different transforms to avoid conflicts.

## Integration with Jest snapshot

Integrating with Jest snapshots allows you to automatically create and update output files. To integrate with Jest snapshots, you need to:

Install and add the [jest-file-snapshot](https://github.com/satya164/jest-file-snapshot) matcher:

```js
import { toMatchFile } from 'jest-file-snapshot';

expect.extend({ toMatchFile });
```

Then configure the Jest watcher to ignore output files by adding the following under the `jest` key in `package.json`:

```json
"watchPathIgnorePatterns": [
  "__fixtures__\\/[^/]+\\/(output|error)\\.js"
]
```

Now you can create and update the output files like you would do with snapshots.

## Alternatives

- [`babel-plugin-tester`](https://github.com/babel-utils/babel-plugin-tester)
- [`@babel/helper-plugin-test-runner`](https://github.com/babel/babel/tree/master/packages/babel-helper-plugin-test-runner)

## Contributing

Make sure your code passes the unit tests, ESLint and TypeScript. Run the following to verify:

```sh
yarn test
yarn lint
yarn typescript
```

To fix formatting errors, run the following:

```sh
yarn lint -- --fix
```

<!-- badges -->

[build-badge]: https://img.shields.io/circleci/project/github/satya164/babel-test/master.svg?style=flat-square
[build]: https://circleci.com/gh/satya164/babel-test
[coverage-badge]: https://img.shields.io/codecov/c/github/satya164/babel-test.svg?style=flat-square
[coverage]: https://codecov.io/github/satya164/babel-test
[license-badge]: https://img.shields.io/npm/l/babel-test.svg?style=flat-square
[license]: https://opensource.org/licenses/MIT
[version-badge]: https://img.shields.io/npm/v/babel-test.svg?style=flat-square
[package]: https://www.npmjs.com/package/babel-test

/* istanbul ignore file */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const stripAnsi = require('strip-ansi');
const escapeRegexp = require('escape-string-regexp');
const ErrorStackParser = require('error-stack-parser');

const SUPPORTED_RUNNERS_TEXT =
  'Are you using a supported test runner such as Jest (https://jestjs.io) or Mocha (https://mochajs.org)?';

exports.create = function create(config) {
  // Check if `describe` and `it` globals are available and throw if not
  // This avoids confusion with unsupported test runners and incorect usage
  if (!('describe' in global && 'it' in global)) {
    throw new Error(
      `Couldn't find ${chalk.blue('describe')} and ${chalk.blue(
        'it'
      )} in the global scope. ${SUPPORTED_RUNNERS_TEXT}\n`
    );
  }

  const transform =
    typeof config === 'function'
      ? config
      : (code, options) =>
          // Lazily require babel so we don't throw for users who don't need it
          require('@babel/core').transformAsync(
            code,
            Object.assign(
              {
                caller: { name: 'babel-test' },
                // By default, disable reading babel config
                // This makes sure that the tests are self contained
                babelrc: false,
                configFile: false,
              },
              config,
              options
            )
          );

  const runner = (directory, options, callback) => () => {
    if (options) {
      const hooks = [
        'before',
        'after',
        'beforeEach',
        'afterEach',
        'beforeAll',
        'afterAll',
      ];

      for (const hook of hooks) {
        if (options[hook] !== undefined) {
          if (global[hook] !== undefined) {
            global[hook](options[hook]);
          } else {
            throw new Error(
              `Couldn't find ${chalk.blue(
                hook
              )} in the global scope. ${SUPPORTED_RUNNERS_TEXT}\n`
            );
          }
        }
      }
    }

    fs.readdirSync(directory)
      .filter((f) => fs.lstatSync(path.join(directory, f)).isDirectory())
      .forEach((f) => {
        // Respect skip. and only. prefixes in folder names
        const t = f.startsWith('skip.')
          ? it.skip
          : f.startsWith('only.')
          ? it.only
          : it;

        t(f.replace(/^(skip|only)\./, '').replace(/(-|_)/g, ' '), () => {
          const filename = path.join(path.join(directory, f), 'code.js');
          const content = fs.readFileSync(filename, 'utf8');

          return Promise.resolve(callback(content, { filename })).then(
            (output) => {
              try {
                if ('expect' in global) {
                  // Use `expect` for assertions if available, for example when using Jest
                  const expected = expect(output.content);

                  if (typeof expected.toMatchFile === 'function') {
                    expected.toMatchFile(output.filename);
                  } else {
                    expected.toBe(fs.readFileSync(output.filename, 'utf8'));
                  }
                } else {
                  // If `expect` is not available, use `assert`, for example when using Mocha
                  const assert = require('assert');
                  const actual = fs.readFileSync(output.filename, 'utf8');

                  assert.strictEqual(
                    actual,
                    output.content,
                    `Expected output doesn't match ${path.basename(
                      output.filename
                    )}`
                  );
                }
              } catch (e) {
                e.stack = `${e.message}\n${output.stack}`;

                throw e;
              }
            }
          );
        });
      });
  };

  const helper = (e) => (code, { filename }) => {
    // We should filter out stack traces from the library
    const stack = ErrorStackParser.parse(e)
      .filter((s) => s.fileName !== __filename)
      .map((s) => s.source)
      .join('\n');

    class TestError extends Error {
      constructor(message) {
        super(message);

        this.message = message;
        this.stack = `\n${stack}`;
      }
    }

    const output = path.join(path.dirname(filename), 'output.js');
    const error = path.join(path.dirname(filename), 'error.js');

    if (fs.existsSync(output) && fs.existsSync(error)) {
      // The test should either pass, or throw
      // If the fixture has files for output and error, one needs to be removed
      throw new TestError(
        // By default, Jest will grey out the text and highlight the stack trace
        // We force it to be white for more emphasis on the message
        chalk.white(
          `Both ${chalk.blue(path.basename(output))} and ${chalk.blue(
            path.basename(error)
          )} exist for ${chalk.blue(
            path.basename(path.dirname(filename))
          )}.\n\nRemove one of them to continue.`
        )
      );
    }

    return new Promise((resolve, reject) => {
      try {
        resolve(transform(code, { filename }));
      } catch (e) {
        reject(e);
      }
    }).then(
      ({ code }) => {
        if (fs.existsSync(error)) {
          throw new TestError(
            chalk.white(
              `The test previously failed with an error, but passed for this run.\n\nIf this is expected, remove the file ${chalk.blue(
                path.basename(error)
              )} to continue.`
            )
          );
        }

        return {
          filename: output,
          content: code + '\n',
          stack,
        };
      },
      (e) => {
        if (fs.existsSync(output)) {
          throw new TestError(
            chalk.white(
              `The test previously passed, but failed with an error for this run.\n\nIf this is expected, remove the file ${chalk.blue(
                path.basename(output)
              )} to continue.`
            )
          );
        }

        return {
          filename: error,
          // Errors might have ansi colors, for example babel codeframe error
          // Strip them so the error is more readable
          // Also replace the current working directory with a placeholder
          // This makes sure that the stacktraces are same across machines
          content:
            stripAnsi(e.stack).replace(
              new RegExp(escapeRegexp(process.cwd()), 'g'),
              '<cwd>'
            ) + '\n',
          stack,
        };
      }
    );
  };

  function test(title, callback) {
    it(title, () => callback({ transform }));
  }

  test.skip = (title, callback) =>
    it.skip(title, () => callback({ transform }));

  test.only = (title, callback) =>
    it.only(title, () => callback({ transform }));

  // We create a new error here so we can point to user's file in stack trace
  // Otherwise stack traces will point to the library code
  function fixtures(title, directory, options, callback = helper(new Error())) {
    describe(title, runner(directory, options, callback));
  }

  fixtures.skip = (title, directory, options, callback = helper(new Error())) =>
    describe.skip(title, runner(directory, options, callback));

  fixtures.only = (title, directory, options, callback = helper(new Error())) =>
    describe.only(title, runner(directory, options, callback));

  return { test, fixtures };
};

/* eslint-disable jest/no-disabled-tests, jest/no-focused-tests */
/* istanbul ignore file */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const stripAnsi = require('strip-ansi');
const escapeRegexp = require('escape-string-regexp');
const ErrorStackParser = require('error-stack-parser');

exports.create = function create(config) {
  // User can pass an array of objects with transform methods or a babel config
  const transformers = Array.isArray(config)
    ? config
    : // If we have a babel config, create a transform method for use
      [
        {
          transform: code =>
            // Lazily require babel so we don't throw for users who don't need it
            require('@babel/core').transformAsync(
              code,
              // By default, disable reading babel config
              // This makes sure that the tests are self contained
              Object.assign({ babelrc: false }, config)
            ),
        },
      ];

  const prefix = (t, title) => (t.title ? `${t.title} › ${title}` : title);

  const tester = (callback, transform) => () => callback({ transform });
  const runner = (directory, callback, transform) => () => {
    fs.readdirSync(directory)
      .filter(f => fs.lstatSync(path.join(directory, f)).isDirectory())
      .forEach(f => {
        const t = f.startsWith('skip.')
          ? it.skip
          : f.startsWith('only.')
            ? it.only
            : it;

        t(f.replace(/^(skip|only)\./, '').replace(/(-|_)/g, ' '), () => {
          const filename = path.join(path.join(directory, f), 'code.js');
          const content = fs.readFileSync(filename, 'utf8');

          return Promise.resolve(
            callback({
              input: { filename, content },
              transform,
            })
          ).then(output => {
            const expected = expect(output.content);

            if (typeof expected.toMatchFile === 'function') {
              expected.toMatchFile(output.filename);
            } else {
              expected.toBe(fs.readFileSync(output.filename, 'utf8'));
            }
          });
        });
      });
  };

  const helper = e => ({ input, transform }) => {
    const stack = ErrorStackParser.parse(e);

    const output = path.join(path.dirname(input.filename), 'output.js');
    const error = path.join(path.dirname(input.filename), 'error.js');

    if (fs.existsSync(output) && fs.existsSync(error)) {
      // The test should either pass, or throw
      // If the fixture has files for output and error, one needs to be removed
      const e = new Error(
        // By default, Jest will grey out the text and highlight the stack trace
        // We force it to be white for more emphasis on the message
        chalk.white(
          `Both ${chalk.blue(path.basename(output))} and ${chalk.blue(
            path.basename(error)
          )} exist for ${chalk.blue(
            path.basename(path.dirname(input.filename))
          )}.\n\nRemove one of them to continue.`
        )
      );

      // We should point to the user's file which started the test
      e.stack = `${e.message}\n${stack[1].source}`;

      throw e;
    }

    return new Promise((resolve, reject) => {
      try {
        resolve(transform(input.content));
      } catch (e) {
        reject(e);
      }
    }).then(
      ({ code }) => ({
        filename: output,
        content: code,
      }),
      e => ({
        filename: error,
        // Errors might have ansi colors, for example babel codeframe error
        // Strip them so the error is more readable
        // Also replace the current working directory with a placeholder
        // This makes sure that the stacktraces are same across machines
        content: stripAnsi(e.stack).replace(
          new RegExp(escapeRegexp(process.cwd()), 'g'),
          '<cwd>'
        ),
      })
    );
  };

  function test(title, callback) {
    transformers.forEach(t =>
      it(prefix(t, title), () => callback({ transform: t.transform }))
    );
  }

  test.skip = (title, callback) =>
    transformers.forEach(t =>
      it.skip(prefix(t, title), tester(callback, t.transform))
    );

  test.only = (title, callback) =>
    transformers.forEach(t =>
      it.only(prefix(t, title), tester(callback, t.transform))
    );

  // We create a new error here so we can point to user's file in stack trace
  // Otherwise stack traces will point to the library code
  function fixtures(title, directory, callback = helper(new Error())) {
    transformers.forEach(t =>
      describe(prefix(t, title), runner(directory, callback, t.transform))
    );
  }

  fixtures.skip = (title, directory, callback = helper(new Error())) =>
    transformers.forEach(t =>
      describe.skip(prefix(t, title), runner(directory, callback, t.transform))
    );

  fixtures.only = (title, directory, callback = helper(new Error())) =>
    transformers.forEach(t =>
      describe.only(prefix(t, title), runner(directory, callback, t.transform))
    );

  return { test, fixtures };
};

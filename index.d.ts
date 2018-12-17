declare module 'babel-test' {
  import { TransformOptions } from '@babel/core';

  type TransformCallback<T> = (code: string, options?: T) => { code: string };

  type FixturesCallback = (
    code: string,
    options: { filename: string }
  ) => Promise<{ code: string }>;

  type TestRunner<T> = (
    title: string,
    callback: (options: { transform: TransformCallback<T> }) => void
  ) => void;

  type FixturesRunner = (
    title: string,
    directory: string,
    callback?: FixturesCallback
  ) => void;

  type Helpers<T> = {
    test: TestRunner<T> & {
      skip: TestRunner<T>;
      only: TestRunner<T>;
    };
    fixtures: FixturesRunner & {
      skip: FixturesRunner;
      only: FixturesRunner;
    };
  };

  export function create<T = TransformOptions>(
    options: TransformOptions | TransformCallback<T>
  ): Helpers<T>;
}

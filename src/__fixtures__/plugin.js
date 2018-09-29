module.exports = function() {
  return {
    visitor: {
      Identifier(path) {
        if (path.node.name === 'error') {
          throw new Error('The identifier "error" is not supported');
        } else {
          path.node.name = path.node.name
            .split('')
            .reverse()
            .join('');
        }
      },
    },
  };
};

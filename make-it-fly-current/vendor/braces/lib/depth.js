'use strict';

// Local DEP-03 guard; callers cannot raise this limit through parser options.
module.exports = depth => {
  if (depth > 128) {
    const error = new SyntaxError('Brace pattern exceeds the maximum nesting depth of 128');
    error.code = 'BRACES_DEPTH_LIMIT';
    throw error;
  }
};

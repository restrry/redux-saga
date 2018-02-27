import { invariant } from './utils'
import invokeGuardedCallback from './invokeGuardedCallback'
// Used by Fiber to simulate a try-catch.
const ReactErrorUtils = {
  _caughtError: null,
  _hasCaughtError: false,

  // Used by event system to capture/rethrow the first error.
  _rethrowError: null,
  _hasRethrowError: false,

  /**
   * Call a function while guarding against errors that happens within it.
   * Returns an error if it throws, otherwise null.
   *
   * In production, this is implemented using a try-catch. The reason we don't
   * use a try-catch directly is so that we can swap out a different
   * implementation in DEV mode.
   *
   * @param {String} name of the guard to use for logging or debugging
   * @param {Function} func The function to invoke
   * @param {*} context The context to use when calling the function
   * @param {...*} args Arguments for function
   */
  invokeGuardedCallback: function(/* name, func, context, a, b, c, d, e, f */) {
    invokeGuardedCallback.apply(ReactErrorUtils, arguments)
  },

  /**
   * Same as invokeGuardedCallback, but instead of returning an error, it stores
   * it in a global so it can be rethrown by `rethrowCaughtError` later.
   * TODO: See if _caughtError and _rethrowError can be unified.
   *
   * @param {String} name of the guard to use for logging or debugging
   * @param {Function} func The function to invoke
   * @param {*} context The context to use when calling the function
   * @param {...*} args Arguments for function
   */
  invokeGuardedCallbackAndCatchFirstError: function(/* name, func, context, a, b, c, d, e, f */) {
    ReactErrorUtils.invokeGuardedCallback.apply(this, arguments)
    if (ReactErrorUtils.hasCaughtError()) {
      const error = ReactErrorUtils.clearCaughtError()
      if (!ReactErrorUtils._hasRethrowError) {
        ReactErrorUtils._hasRethrowError = true
        ReactErrorUtils._rethrowError = error
      }
    }
  },

  /**
   * During execution of guarded functions we will capture the first error which
   * we will rethrow to be handled by the top level error handler.
   */
  rethrowCaughtError: function() {
    return rethrowCaughtError.apply(ReactErrorUtils, arguments)
  },

  hasCaughtError: function() {
    return ReactErrorUtils._hasCaughtError
  },

  clearCaughtError: function() {
    if (ReactErrorUtils._hasCaughtError) {
      const error = ReactErrorUtils._caughtError
      ReactErrorUtils._caughtError = null
      ReactErrorUtils._hasCaughtError = false
      return error
    } else {
      invariant(
        false,
        'clearCaughtError was called but no error was captured. This error ' +
          'is likely caused by a bug in React. Please file an issue.',
      )
    }
  },
}

let rethrowCaughtError = function() {
  if (ReactErrorUtils._hasRethrowError) {
    const error = ReactErrorUtils._rethrowError
    ReactErrorUtils._rethrowError = null
    ReactErrorUtils._hasRethrowError = false
    throw error
  }
}

export default ReactErrorUtils

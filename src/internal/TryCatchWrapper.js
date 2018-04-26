/**
 * Copyright (c) 2013-present, Redux-saga
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * based on implementation from:
 * https://github.com/facebook/react/blob/46b3c3e4ae0d52565f7ed2344036a22016781ca0/packages/shared/ReactErrorUtils.js
 * https://github.com/facebook/react/blob/46b3c3e4ae0d52565f7ed2344036a22016781ca0/packages/shared/invokeGuardedCallback.js
 */
let invokeGuardedCallback = function(name, func, context, ...funcArgs) {
  this._hasCaughtError = false
  this._caughtError = null
  try {
    func.apply(context, funcArgs)
  } catch (error) {
    this._caughtError = error
    this._hasCaughtError = true
  }
}

if (process.env.NODE_ENV === 'development') {
  // In DEV mode, we swap out invokeGuardedCallback for a special version
  // that plays more nicely with the browser's DevTools. The idea is to preserve
  // "Pause on exceptions" behavior. Because we wrap all user-provided
  // functions in invokeGuardedCallback, and the production version of
  // invokeGuardedCallback uses a try-catch, all user exceptions are treated
  // like caught exceptions, and the DevTools won't pause unless the developer
  // takes the extra step of enabling pause on caught exceptions. This is
  // untintuitive, though, because even though the library has caught the error, from
  // the developer's perspective, the error is uncaught.
  //
  // To preserve the expected "Pause on exceptions" behavior, we don't use a
  // try-catch in DEV. Instead, we synchronously dispatch a fake event to a fake
  // DOM node, and call the user-provided callback from inside an event handler
  // for that fake event. If the callback throws, the error is "captured" using
  // a global event handler. But because the error happens in a different
  // event loop context, it does not interrupt the normal program flow.
  // Effectively, this gives us try-catch behavior without actually using
  // try-catch. Neat!

  // Check that the browser supports the APIs we need to implement our special
  // DEV version of invokeGuardedCallback
  if (
    typeof window !== 'undefined' &&
    typeof window.dispatchEvent === 'function' &&
    typeof document !== 'undefined' &&
    typeof document.createEvent === 'function'
  ) {
    const fakeNode = document.createElement('fake')

    const invokeGuardedCallbackDev = function(name, func, context, ...funcArgs) {
      const evt = document.createEvent('Event')

      // Keeps track of whether the user-provided callback threw an error. We
      // set this to true at the beginning, then set it to false right after
      // calling the function. If the function errors, `didError` will never be
      // set to false. This strategy works even if the browser is flaky and
      // fails to call our global error handler, because it doesn't rely on
      // the error event at all.
      let didError = true

      // Create an event handler for our fake event. We will synchronously
      // dispatch our fake event using `dispatchEvent`. Inside the handler, we
      // call the user-provided callback.
      function callCallback() {
        // We immediately remove the callback from event listeners so that
        // nested `invokeGuardedCallback` calls do not clash. Otherwise, a
        // nested call would trigger the fake event handlers of any call higher
        // in the stack.
        fakeNode.removeEventListener(evtType, callCallback, false)
        func.apply(context, funcArgs)
        didError = false
      }

      // Create a global error event handler. We use this to capture the value
      // that was thrown. It's possible that this error handler will fire more
      // than once; for example, if 3rd party code also calls `dispatchEvent`
      // and a handler for that event throws. We should be resilient to most of
      // those cases. Even if our error event handler fires more than once, the
      // last error event is always used. If the callback actually does error,
      // we know that the last error event is the correct one, because it's not
      // possible for anything else to have happened in between our callback
      // erroring and the code that follows the `dispatchEvent` call below. If
      // the callback doesn't error, but the error event was fired, we know to
      // ignore it because `didError` will be false, as described above.
      let error
      // Use this to track whether the error event is ever called.
      let didSetError = false

      function onError(event) {
        error = event.error
        didSetError = true
      }

      // Create a fake event type.
      const evtType = `redux-saga-${name ? name : 'invokeguardedcallback'}`

      // Attach our event handlers
      window.addEventListener('error', onError)
      fakeNode.addEventListener(evtType, callCallback, false)

      // Synchronously dispatch our fake event. If the user-provided function
      // errors, it will trigger our global error handler.
      evt.initEvent(evtType, false, false)
      fakeNode.dispatchEvent(evt)

      if (didError) {
        if (!didSetError) {
          // The callback errored, but the error event never fired.
          error = new Error(
            'An error was thrown inside one of your sagas, but we ' +
              "don't know what it was. This is likely due to browser " +
              'flakiness. We do our best to preserve the "Pause on ' +
              'exceptions" behavior of the DevTools, which requires some ' +
              "DEV-mode only tricks. It's possible that these don't work in " +
              'your browser. Try triggering the error in production mode, ' +
              'or switching to a modern browser. If you suspect that this is ' +
              'actually an issue with Redux-saga, please file an issue.',
          )
        }
        this._hasCaughtError = true
        this._caughtError = error
      } else {
        this._hasCaughtError = false
        this._caughtError = null
      }

      // Remove our event listeners
      window.removeEventListener('error', onError)
    }

    invokeGuardedCallback = invokeGuardedCallbackDev
  }
}

// Utilized to simulate a try-catch.
const TryCatchWrapper = {
  _caughtError: null,
  _hasCaughtError: false,

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
  invokeGuardedCallback: function(...args) {
    invokeGuardedCallback.apply(TryCatchWrapper, args)
  },

  hasCaughtError: function() {
    return TryCatchWrapper._hasCaughtError
  },

  clearCaughtError: function() {
    if (TryCatchWrapper._hasCaughtError) {
      const error = TryCatchWrapper._caughtError
      TryCatchWrapper._caughtError = null
      TryCatchWrapper._hasCaughtError = false
      return error
    } else {
      throw new Error(
        'clearCaughtError was called but no error was captured. This error ' +
          'is likely caused by a bug in Redux-saga. Please file an issue.',
      )
    }
  },
}

export default TryCatchWrapper

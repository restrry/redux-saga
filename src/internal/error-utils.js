import { SAGA_LOCATION } from './symbols'
import TryCatchWrapper from './TryCatchWrapper'

function formatLocation(fileName, lineNumber) {
  return `${fileName}?${lineNumber}`
}

export function getLocation(instrumented) {
  return instrumented[SAGA_LOCATION]
}

function effectLocationAsString(effect) {
  const location = getLocation(effect)
  if (location) {
    const { code, fileName, lineNumber } = location
    const source = `${code}  ${formatLocation(fileName, lineNumber)}`
    return source
  }
  return ''
}

function sagaLocationAsString(sagaMeta) {
  const { name, location } = sagaMeta
  if (location) {
    return `${name}  ${formatLocation(location.fileName, location.lineNumber)}`
  }
  return name
}

const flatMap = (arr, getter = f => f) => arr.reduce((acc, i) => [...acc, ...getter(i)], [])

function cancelledTasksAsString(sagaStack) {
  const cancelledTasks = flatMap(sagaStack, i => i.cancelledTasks)
  if (!cancelledTasks.length) {
    return ''
  }
  return ['Tasks cancelled due to error:', ...cancelledTasks].join('\n')
}
/**
    @param {saga, effect}[] sagaStack
    @returns {string}

    @example
    The above error occurred in task errorInPutSaga {pathToFile}
    when executing effect put({type: 'REDUCER_ACTION_ERROR_IN_PUT'}) {pathToFile}
        created by fetchSaga {pathToFile}
        created by rootSaga {pathToFile}
*/
export function sagaStackToString(sagaStack) {
  const [firstSaga, ...otherSagas] = sagaStack
  const crashedEffectLocation = firstSaga.effect ? effectLocationAsString(firstSaga.effect) : null
  const errorMessage = `The above error occurred in task ${sagaLocationAsString(firstSaga.meta)}${
    crashedEffectLocation ? ` \n when executing effect ${crashedEffectLocation}` : ''
  }`

  return [
    errorMessage,
    ...otherSagas.map(s => `    created by ${sagaLocationAsString(s.meta)}`),
    cancelledTasksAsString(sagaStack),
  ].join('\n')
}

export function addSagaStack(errorObject, errorStack) {
  if (typeof errorObject === 'object') {
    if (typeof errorObject.sagaStack === 'undefined') {
      // property is used as a stack of descriptors for failed sagas
      // after formatting to string it will be re-written
      // to pass sagaStack as a string in user land
      Object.defineProperty(errorObject, 'sagaStack', {
        value: [],
        writable: true,
        enumerable: false,
      })
    }

    errorObject.sagaStack.push(errorStack)
  }
}

function tryCatchNative(fn) {
  try {
    const result = fn()
    return { result, error: null }
  } catch (error) {
    return { result: null, error }
  }
}

function tryCatchWrapped(fn) {
  let result
  TryCatchWrapper.invokeGuardedCallback(
    null,
    function tryCatchCallCaller() {
      result = fn()
    },
    null,
  )

  if (TryCatchWrapper.hasCaughtError()) {
    const error = TryCatchWrapper.clearCaughtError()
    return {
      result: null,
      error,
    }
  }
  return {
    result,
    error: null,
  }
}

export function createTryCatchCall(shouldWrap = false) {
  // we try to catch errors only in native generators. because if user uses renegerator,
  // for example, it catches errors and re-throw them inside, we want to avoid pausing
  // in that case
  if (shouldWrap) {
    return tryCatchWrapped
  } else {
    return tryCatchNative
  }
}

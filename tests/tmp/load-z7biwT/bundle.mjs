var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../hermes-overlay-core/node_modules/react/cjs/react.development.js
var require_react_development = __commonJS({
  "../hermes-overlay-core/node_modules/react/cjs/react.development.js"(exports, module) {
    "use strict";
    (function() {
      function defineDeprecationWarning(methodName, info) {
        Object.defineProperty(Component.prototype, methodName, {
          get: function() {
            console.warn(
              "%s(...) is deprecated in plain JavaScript React classes. %s",
              info[0],
              info[1]
            );
          }
        });
      }
      function getIteratorFn(maybeIterable) {
        if (null === maybeIterable || "object" !== typeof maybeIterable)
          return null;
        maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
        return "function" === typeof maybeIterable ? maybeIterable : null;
      }
      function warnNoop(publicInstance, callerName) {
        publicInstance = (publicInstance = publicInstance.constructor) && (publicInstance.displayName || publicInstance.name) || "ReactClass";
        var warningKey = publicInstance + "." + callerName;
        didWarnStateUpdateForUnmountedComponent[warningKey] || (console.error(
          "Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.",
          callerName,
          publicInstance
        ), didWarnStateUpdateForUnmountedComponent[warningKey] = true);
      }
      function Component(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      function ComponentDummy() {
      }
      function PureComponent(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      function noop() {
      }
      function testStringCoercion(value) {
        return "" + value;
      }
      function checkKeyStringCoercion(value) {
        try {
          testStringCoercion(value);
          var JSCompiler_inline_result = false;
        } catch (e) {
          JSCompiler_inline_result = true;
        }
        if (JSCompiler_inline_result) {
          JSCompiler_inline_result = console;
          var JSCompiler_temp_const = JSCompiler_inline_result.error;
          var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
          JSCompiler_temp_const.call(
            JSCompiler_inline_result,
            "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
            JSCompiler_inline_result$jscomp$0
          );
          return testStringCoercion(value);
        }
      }
      function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type)
          return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch (type) {
          case REACT_FRAGMENT_TYPE:
            return "Fragment";
          case REACT_PROFILER_TYPE:
            return "Profiler";
          case REACT_STRICT_MODE_TYPE:
            return "StrictMode";
          case REACT_SUSPENSE_TYPE:
            return "Suspense";
          case REACT_SUSPENSE_LIST_TYPE:
            return "SuspenseList";
          case REACT_ACTIVITY_TYPE:
            return "Activity";
          case REACT_VIEW_TRANSITION_TYPE:
            return "ViewTransition";
        }
        if ("object" === typeof type)
          switch ("number" === typeof type.tag && console.error(
            "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
          ), type.$$typeof) {
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_CONTEXT_TYPE:
              return type.displayName || "Context";
            case REACT_CONSUMER_TYPE:
              return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
              var innerType = type.render;
              type = type.displayName;
              type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
              return type;
            case REACT_MEMO_TYPE:
              return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
              innerType = type._payload;
              type = type._init;
              try {
                return getComponentNameFromType(type(innerType));
              } catch (x) {
              }
          }
        return null;
      }
      function getTaskName(type) {
        if (type === REACT_FRAGMENT_TYPE) return "<>";
        if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE)
          return "<...>";
        try {
          var name = getComponentNameFromType(type);
          return name ? "<" + name + ">" : "<...>";
        } catch (x) {
          return "<...>";
        }
      }
      function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
      }
      function UnknownOwner() {
        return Error("react-stack-top-frame");
      }
      function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
          var getter = Object.getOwnPropertyDescriptor(config, "key").get;
          if (getter && getter.isReactWarning) return false;
        }
        return void 0 !== config.key;
      }
      function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
          specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error(
            "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
            displayName
          ));
        }
        warnAboutAccessingKey.isReactWarning = true;
        Object.defineProperty(props, "key", {
          get: warnAboutAccessingKey,
          configurable: true
        });
      }
      function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error(
          "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
        ));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
      }
      function ReactElement(type, key, props, owner, debugStack, debugTask) {
        var refProp = props.ref;
        type = {
          $$typeof: REACT_ELEMENT_TYPE,
          type,
          key,
          props,
          _owner: owner
        };
        null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
          enumerable: false,
          get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: null
        });
        Object.defineProperty(type, "_debugStack", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugStack
        });
        Object.defineProperty(type, "_debugTask", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugTask
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
      }
      function cloneAndReplaceKey(oldElement, newKey) {
        newKey = ReactElement(
          oldElement.type,
          newKey,
          oldElement.props,
          oldElement._owner,
          oldElement._debugStack,
          oldElement._debugTask
        );
        oldElement._store && (newKey._store.validated = oldElement._store.validated);
        return newKey;
      }
      function validateChildKeys(node) {
        isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
      }
      function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
      }
      function escape(key) {
        var escaperLookup = { "=": "=0", ":": "=2" };
        return "$" + key.replace(/[=:]/g, function(match) {
          return escaperLookup[match];
        });
      }
      function getElementKey(element, index) {
        return "object" === typeof element && null !== element && null != element.key ? (checkKeyStringCoercion(element.key), escape("" + element.key)) : index.toString(36);
      }
      function resolveThenable(thenable) {
        switch (thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            throw thenable.reason;
          default:
            switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(
              function(fulfilledValue) {
                "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
              },
              function(error) {
                "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            )), thenable.status) {
              case "fulfilled":
                return thenable.value;
              case "rejected":
                throw thenable.reason;
            }
        }
        throw thenable;
      }
      function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
        var type = typeof children;
        if ("undefined" === type || "boolean" === type) children = null;
        var invokeCallback = false;
        if (null === children) invokeCallback = true;
        else
          switch (type) {
            case "bigint":
            case "string":
            case "number":
              invokeCallback = true;
              break;
            case "object":
              switch (children.$$typeof) {
                case REACT_ELEMENT_TYPE:
                case REACT_PORTAL_TYPE:
                  invokeCallback = true;
                  break;
                case REACT_LAZY_TYPE:
                  return invokeCallback = children._init, mapIntoArray(
                    invokeCallback(children._payload),
                    array,
                    escapedPrefix,
                    nameSoFar,
                    callback
                  );
              }
          }
        if (invokeCallback) {
          invokeCallback = children;
          callback = callback(invokeCallback);
          var childKey = "" === nameSoFar ? "." + getElementKey(invokeCallback, 0) : nameSoFar;
          isArrayImpl(callback) ? (escapedPrefix = "", null != childKey && (escapedPrefix = childKey.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
            return c;
          })) : null != callback && (isValidElement(callback) && (null != callback.key && (invokeCallback && invokeCallback.key === callback.key || checkKeyStringCoercion(callback.key)), escapedPrefix = cloneAndReplaceKey(
            callback,
            escapedPrefix + (null == callback.key || invokeCallback && invokeCallback.key === callback.key ? "" : ("" + callback.key).replace(
              userProvidedKeyEscapeRegex,
              "$&/"
            ) + "/") + childKey
          ), "" !== nameSoFar && null != invokeCallback && isValidElement(invokeCallback) && null == invokeCallback.key && invokeCallback._store && !invokeCallback._store.validated && (escapedPrefix._store.validated = 2), callback = escapedPrefix), array.push(callback));
          return 1;
        }
        invokeCallback = 0;
        childKey = "" === nameSoFar ? "." : nameSoFar + ":";
        if (isArrayImpl(children))
          for (var i = 0; i < children.length; i++)
            nameSoFar = children[i], type = childKey + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if (i = getIteratorFn(children), "function" === typeof i)
          for (i === children.entries && (didWarnAboutMaps || console.warn(
            "Using Maps as children is not supported. Use an array of keyed ReactElements instead."
          ), didWarnAboutMaps = true), children = i.call(children), i = 0; !(nameSoFar = children.next()).done; )
            nameSoFar = nameSoFar.value, type = childKey + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if ("object" === type) {
          if ("function" === typeof children.then)
            return mapIntoArray(
              resolveThenable(children),
              array,
              escapedPrefix,
              nameSoFar,
              callback
            );
          array = String(children);
          throw Error(
            "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
          );
        }
        return invokeCallback;
      }
      function mapChildren(children, func, context) {
        if (null == children) return children;
        var result = [], count = 0;
        mapIntoArray(children, result, "", "", function(child) {
          return func.call(context, child, count++);
        });
        return result;
      }
      function lazyInitializer(payload) {
        if (-1 === payload._status) {
          var resolveDebugValue = null, rejectDebugValue = null, ioInfo = payload._ioInfo;
          null != ioInfo && (ioInfo.start = ioInfo.end = performance.now(), ioInfo.value = new Promise(function(resolve, reject) {
            resolveDebugValue = resolve;
            rejectDebugValue = reject;
          }));
          ioInfo = payload._result;
          var thenable = ioInfo();
          thenable.then(
            function(moduleObject) {
              if (0 === payload._status || -1 === payload._status) {
                payload._status = 1;
                payload._result = moduleObject;
                var _ioInfo = payload._ioInfo;
                if (null != _ioInfo) {
                  _ioInfo.end = performance.now();
                  var debugValue = null == moduleObject ? void 0 : moduleObject.default;
                  resolveDebugValue(debugValue);
                  _ioInfo.value.status = "fulfilled";
                  _ioInfo.value.value = debugValue;
                }
                void 0 === thenable.status && (thenable.status = "fulfilled", thenable.value = moduleObject);
              }
            },
            function(error) {
              if (0 === payload._status || -1 === payload._status) {
                payload._status = 2;
                payload._result = error;
                var _ioInfo2 = payload._ioInfo;
                null != _ioInfo2 && (_ioInfo2.end = performance.now(), _ioInfo2.value.then(noop, noop), rejectDebugValue(error), _ioInfo2.value.status = "rejected", _ioInfo2.value.reason = error);
                void 0 === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            }
          );
          ioInfo = payload._ioInfo;
          if (null != ioInfo) {
            var displayName = thenable.displayName;
            "string" === typeof displayName && (ioInfo.name = displayName);
          }
          -1 === payload._status && (payload._status = 0, payload._result = thenable);
        }
        if (1 === payload._status)
          return ioInfo = payload._result, void 0 === ioInfo && console.error(
            "lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?",
            ioInfo
          ), "default" in ioInfo || console.error(
            "lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))",
            ioInfo
          ), ioInfo.default;
        throw payload._result;
      }
      function resolveDispatcher() {
        var dispatcher = ReactSharedInternals.H;
        null === dispatcher && console.error(
          "Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem."
        );
        return dispatcher;
      }
      function releaseAsyncTransition() {
        ReactSharedInternals.asyncTransitions--;
      }
      function startTransition(scope) {
        var prevTransition = ReactSharedInternals.T, currentTransition = {};
        currentTransition.types = null !== prevTransition ? prevTransition.types : null;
        currentTransition._updatedFibers = /* @__PURE__ */ new Set();
        ReactSharedInternals.T = currentTransition;
        try {
          var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
          null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
          "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && (ReactSharedInternals.asyncTransitions++, returnValue.then(releaseAsyncTransition, releaseAsyncTransition), returnValue.then(noop, reportGlobalError));
        } catch (error) {
          reportGlobalError(error);
        } finally {
          null === prevTransition && currentTransition._updatedFibers && (scope = currentTransition._updatedFibers.size, currentTransition._updatedFibers.clear(), 10 < scope && console.warn(
            "Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table."
          )), null !== prevTransition && null !== currentTransition.types && (null !== prevTransition.types && prevTransition.types !== currentTransition.types && console.error(
            "We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."
          ), prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
        }
      }
      function addTransitionType(type) {
        var transition = ReactSharedInternals.T;
        if (null !== transition) {
          var transitionTypes = transition.types;
          null === transitionTypes ? transition.types = [type] : -1 === transitionTypes.indexOf(type) && transitionTypes.push(type);
        } else
          0 === ReactSharedInternals.asyncTransitions && console.error(
            "addTransitionType can only be called inside a `startTransition()` callback. It must be associated with a specific Transition."
          ), startTransition(addTransitionType.bind(null, type));
      }
      function enqueueTask(task) {
        if (null === enqueueTaskImpl)
          try {
            var requireString = ("require" + Math.random()).slice(0, 7);
            enqueueTaskImpl = (module && module[requireString]).call(
              module,
              "timers"
            ).setImmediate;
          } catch (_err) {
            enqueueTaskImpl = function(callback) {
              false === didWarnAboutMessageChannel && (didWarnAboutMessageChannel = true, "undefined" === typeof MessageChannel && console.error(
                "This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."
              ));
              var channel = new MessageChannel();
              channel.port1.onmessage = callback;
              channel.port2.postMessage(void 0);
            };
          }
        return enqueueTaskImpl(task);
      }
      function aggregateErrors(errors) {
        return 1 < errors.length && "function" === typeof AggregateError ? new AggregateError(errors) : errors[0];
      }
      function popActScope(prevActQueue, prevActScopeDepth) {
        prevActScopeDepth !== actScopeDepth - 1 && console.error(
          "You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. "
        );
        actScopeDepth = prevActScopeDepth;
      }
      function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
        var queue = ReactSharedInternals.actQueue;
        if (null !== queue)
          if (0 !== queue.length)
            try {
              flushActQueue(queue);
              enqueueTask(function() {
                return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
              });
              return;
            } catch (error) {
              ReactSharedInternals.thrownErrors.push(error);
            }
          else ReactSharedInternals.actQueue = null;
        0 < ReactSharedInternals.thrownErrors.length ? (queue = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(queue)) : resolve(returnValue);
      }
      function flushActQueue(queue) {
        if (!isFlushing) {
          isFlushing = true;
          var i = 0;
          try {
            for (; i < queue.length; i++) {
              var callback = queue[i];
              do {
                ReactSharedInternals.didUsePromise = false;
                var continuation = callback(false);
                if (null !== continuation) {
                  if (ReactSharedInternals.didUsePromise) {
                    queue[i] = callback;
                    queue.splice(0, i);
                    return;
                  }
                  callback = continuation;
                } else break;
              } while (1);
            }
            queue.length = 0;
          } catch (error) {
            queue.splice(0, i + 1), ReactSharedInternals.thrownErrors.push(error);
          } finally {
            isFlushing = false;
          }
        }
      }
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
      var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo"), REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = /* @__PURE__ */ Symbol.for("react.activity"), REACT_VIEW_TRANSITION_TYPE = /* @__PURE__ */ Symbol.for("react.view_transition"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, didWarnStateUpdateForUnmountedComponent = {}, ReactNoopUpdateQueue = {
        isMounted: function() {
          return false;
        },
        enqueueForceUpdate: function(publicInstance) {
          warnNoop(publicInstance, "forceUpdate");
        },
        enqueueReplaceState: function(publicInstance) {
          warnNoop(publicInstance, "replaceState");
        },
        enqueueSetState: function(publicInstance) {
          warnNoop(publicInstance, "setState");
        }
      }, assign = Object.assign, emptyObject = {};
      Object.freeze(emptyObject);
      Component.prototype.isReactComponent = {};
      Component.prototype.setState = function(partialState, callback) {
        if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
          throw Error(
            "takes an object of state variables to update or a function which returns an object of state variables."
          );
        this.updater.enqueueSetState(this, partialState, callback, "setState");
      };
      Component.prototype.forceUpdate = function(callback) {
        this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
      };
      var deprecatedAPIs = {
        isMounted: [
          "isMounted",
          "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."
        ],
        replaceState: [
          "replaceState",
          "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."
        ]
      };
      for (fnName in deprecatedAPIs)
        deprecatedAPIs.hasOwnProperty(fnName) && defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
      ComponentDummy.prototype = Component.prototype;
      deprecatedAPIs = PureComponent.prototype = new ComponentDummy();
      deprecatedAPIs.constructor = PureComponent;
      assign(deprecatedAPIs, Component.prototype);
      deprecatedAPIs.isPureReactComponent = true;
      var isArrayImpl = Array.isArray, REACT_CLIENT_REFERENCE = /* @__PURE__ */ Symbol.for("react.client.reference"), ReactSharedInternals = {
        H: null,
        A: null,
        T: null,
        S: null,
        actQueue: null,
        asyncTransitions: 0,
        isBatchingLegacy: false,
        didScheduleLegacyUpdate: false,
        didUsePromise: false,
        thrownErrors: [],
        getCurrentStack: null,
        recentlyCreatedOwnerStacks: 0
      }, hasOwnProperty = Object.prototype.hasOwnProperty, createTask = console.createTask ? console.createTask : function() {
        return null;
      };
      deprecatedAPIs = {
        react_stack_bottom_frame: function(callStackForError) {
          return callStackForError();
        }
      };
      var specialPropKeyWarningShown, didWarnAboutOldJSXRuntime;
      var didWarnAboutElementRef = {};
      var unknownOwnerDebugStack = deprecatedAPIs.react_stack_bottom_frame.bind(
        deprecatedAPIs,
        UnknownOwner
      )();
      var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
      var didWarnAboutMaps = false, userProvidedKeyEscapeRegex = /\/+/g, reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
        if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
          var event = new window.ErrorEvent("error", {
            bubbles: true,
            cancelable: true,
            message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
            error
          });
          if (!window.dispatchEvent(event)) return;
        } else if ("object" === typeof process && "function" === typeof process.emit) {
          process.emit("uncaughtException", error);
          return;
        }
        console.error(error);
      }, didWarnAboutMessageChannel = false, enqueueTaskImpl = null, actScopeDepth = 0, didWarnNoAwaitAct = false, isFlushing = false, queueSeveralMicrotasks = "function" === typeof queueMicrotask ? function(callback) {
        queueMicrotask(function() {
          return queueMicrotask(callback);
        });
      } : enqueueTask;
      deprecatedAPIs = Object.freeze({
        __proto__: null,
        c: function(size) {
          return resolveDispatcher().useMemoCache(size);
        }
      });
      var fnName = {
        map: mapChildren,
        forEach: function(children, forEachFunc, forEachContext) {
          mapChildren(
            children,
            function() {
              forEachFunc.apply(this, arguments);
            },
            forEachContext
          );
        },
        count: function(children) {
          var n = 0;
          mapChildren(children, function() {
            n++;
          });
          return n;
        },
        toArray: function(children) {
          return mapChildren(children, function(child) {
            return child;
          }) || [];
        },
        only: function(children) {
          if (!isValidElement(children))
            throw Error(
              "React.Children.only expected to receive a single React element child."
            );
          return children;
        }
      };
      exports.Activity = REACT_ACTIVITY_TYPE;
      exports.Children = fnName;
      exports.Component = Component;
      exports.Fragment = REACT_FRAGMENT_TYPE;
      exports.Profiler = REACT_PROFILER_TYPE;
      exports.PureComponent = PureComponent;
      exports.StrictMode = REACT_STRICT_MODE_TYPE;
      exports.Suspense = REACT_SUSPENSE_TYPE;
      exports.ViewTransition = REACT_VIEW_TRANSITION_TYPE;
      exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
      exports.__COMPILER_RUNTIME = deprecatedAPIs;
      exports.act = function(callback) {
        var prevActQueue = ReactSharedInternals.actQueue, prevActScopeDepth = actScopeDepth;
        actScopeDepth++;
        var queue = ReactSharedInternals.actQueue = null !== prevActQueue ? prevActQueue : [], didAwaitActCall = false;
        try {
          var result = callback();
        } catch (error) {
          ReactSharedInternals.thrownErrors.push(error);
        }
        if (0 < ReactSharedInternals.thrownErrors.length)
          throw popActScope(prevActQueue, prevActScopeDepth), callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
        if (null !== result && "object" === typeof result && "function" === typeof result.then) {
          var thenable = result;
          queueSeveralMicrotasks(function() {
            didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error(
              "You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"
            ));
          });
          return {
            then: function(resolve, reject) {
              didAwaitActCall = true;
              thenable.then(
                function(returnValue) {
                  popActScope(prevActQueue, prevActScopeDepth);
                  if (0 === prevActScopeDepth) {
                    try {
                      flushActQueue(queue), enqueueTask(function() {
                        return recursivelyFlushAsyncActWork(
                          returnValue,
                          resolve,
                          reject
                        );
                      });
                    } catch (error$0) {
                      ReactSharedInternals.thrownErrors.push(error$0);
                    }
                    if (0 < ReactSharedInternals.thrownErrors.length) {
                      var _thrownError = aggregateErrors(
                        ReactSharedInternals.thrownErrors
                      );
                      ReactSharedInternals.thrownErrors.length = 0;
                      reject(_thrownError);
                    }
                  } else resolve(returnValue);
                },
                function(error) {
                  popActScope(prevActQueue, prevActScopeDepth);
                  0 < ReactSharedInternals.thrownErrors.length ? (error = aggregateErrors(
                    ReactSharedInternals.thrownErrors
                  ), ReactSharedInternals.thrownErrors.length = 0, reject(error)) : reject(error);
                }
              );
            }
          };
        }
        var returnValue$jscomp$0 = result;
        popActScope(prevActQueue, prevActScopeDepth);
        0 === prevActScopeDepth && (flushActQueue(queue), 0 !== queue.length && queueSeveralMicrotasks(function() {
          didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error(
            "A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"
          ));
        }), ReactSharedInternals.actQueue = null);
        if (0 < ReactSharedInternals.thrownErrors.length)
          throw callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
        return {
          then: function(resolve, reject) {
            didAwaitActCall = true;
            0 === prevActScopeDepth ? (ReactSharedInternals.actQueue = queue, enqueueTask(function() {
              return recursivelyFlushAsyncActWork(
                returnValue$jscomp$0,
                resolve,
                reject
              );
            })) : resolve(returnValue$jscomp$0);
          }
        };
      };
      exports.addTransitionType = addTransitionType;
      exports.cache = function(fn) {
        return function() {
          return fn.apply(null, arguments);
        };
      };
      exports.cacheSignal = function() {
        return null;
      };
      exports.captureOwnerStack = function() {
        var getCurrentStack = ReactSharedInternals.getCurrentStack;
        return null === getCurrentStack ? null : getCurrentStack();
      };
      exports.cloneElement = function(element, config, children) {
        if (null === element || void 0 === element)
          throw Error(
            "The argument must be a React element, but you passed " + element + "."
          );
        var props = assign({}, element.props), key = element.key, owner = element._owner;
        if (null != config) {
          var JSCompiler_inline_result;
          a: {
            if (hasOwnProperty.call(config, "ref") && (JSCompiler_inline_result = Object.getOwnPropertyDescriptor(
              config,
              "ref"
            ).get) && JSCompiler_inline_result.isReactWarning) {
              JSCompiler_inline_result = false;
              break a;
            }
            JSCompiler_inline_result = void 0 !== config.ref;
          }
          JSCompiler_inline_result && (owner = getOwner());
          hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key);
          for (propName in config)
            !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
        }
        var propName = arguments.length - 2;
        if (1 === propName) props.children = children;
        else if (1 < propName) {
          JSCompiler_inline_result = Array(propName);
          for (var i = 0; i < propName; i++)
            JSCompiler_inline_result[i] = arguments[i + 2];
          props.children = JSCompiler_inline_result;
        }
        props = ReactElement(
          element.type,
          key,
          props,
          owner,
          element._debugStack,
          element._debugTask
        );
        for (key = 2; key < arguments.length; key++)
          validateChildKeys(arguments[key]);
        return props;
      };
      exports.createContext = function(defaultValue) {
        defaultValue = {
          $$typeof: REACT_CONTEXT_TYPE,
          _currentValue: defaultValue,
          _currentValue2: defaultValue,
          _threadCount: 0,
          Provider: null,
          Consumer: null
        };
        defaultValue.Provider = defaultValue;
        defaultValue.Consumer = {
          $$typeof: REACT_CONSUMER_TYPE,
          _context: defaultValue
        };
        defaultValue._currentRenderer = null;
        defaultValue._currentRenderer2 = null;
        return defaultValue;
      };
      exports.createElement = function(type, config, children) {
        for (var i = 2; i < arguments.length; i++)
          validateChildKeys(arguments[i]);
        var propName;
        i = {};
        var key = null;
        if (null != config)
          for (propName in didWarnAboutOldJSXRuntime || !("__self" in config) || "key" in config || (didWarnAboutOldJSXRuntime = true, console.warn(
            "Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform"
          )), hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key), config)
            hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (i[propName] = config[propName]);
        var childrenLength = arguments.length - 2;
        if (1 === childrenLength) i.children = children;
        else if (1 < childrenLength) {
          for (var childArray = Array(childrenLength), _i = 0; _i < childrenLength; _i++)
            childArray[_i] = arguments[_i + 2];
          Object.freeze && Object.freeze(childArray);
          i.children = childArray;
        }
        if (type && type.defaultProps)
          for (propName in childrenLength = type.defaultProps, childrenLength)
            void 0 === i[propName] && (i[propName] = childrenLength[propName]);
        key && defineKeyPropWarningGetter(
          i,
          "function" === typeof type ? type.displayName || type.name || "Unknown" : type
        );
        (propName = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++) ? (childArray = Error.stackTraceLimit, Error.stackTraceLimit = 10, childrenLength = Error("react-stack-top-frame"), Error.stackTraceLimit = childArray) : childrenLength = unknownOwnerDebugStack;
        return ReactElement(
          type,
          key,
          i,
          getOwner(),
          childrenLength,
          propName ? createTask(getTaskName(type)) : unknownOwnerDebugTask
        );
      };
      exports.createRef = function() {
        var refObject = { current: null };
        Object.seal(refObject);
        return refObject;
      };
      exports.forwardRef = function(render) {
        null != render && render.$$typeof === REACT_MEMO_TYPE ? console.error(
          "forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...))."
        ) : "function" !== typeof render ? console.error(
          "forwardRef requires a render function but was given %s.",
          null === render ? "null" : typeof render
        ) : 0 !== render.length && 2 !== render.length && console.error(
          "forwardRef render functions accept exactly two parameters: props and ref. %s",
          1 === render.length ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined."
        );
        null != render && null != render.defaultProps && console.error(
          "forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?"
        );
        var elementType = { $$typeof: REACT_FORWARD_REF_TYPE, render }, ownName;
        Object.defineProperty(elementType, "displayName", {
          enumerable: false,
          configurable: true,
          get: function() {
            return ownName;
          },
          set: function(name) {
            ownName = name;
            render.name || render.displayName || (Object.defineProperty(render, "name", { value: name }), render.displayName = name);
          }
        });
        return elementType;
      };
      exports.isValidElement = isValidElement;
      exports.lazy = function(ctor) {
        ctor = { _status: -1, _result: ctor };
        var lazyType = {
          $$typeof: REACT_LAZY_TYPE,
          _payload: ctor,
          _init: lazyInitializer
        }, ioInfo = {
          name: "lazy",
          start: -1,
          end: -1,
          value: null,
          owner: null,
          debugStack: Error("react-stack-top-frame"),
          debugTask: console.createTask ? console.createTask("lazy()") : null
        };
        ctor._ioInfo = ioInfo;
        lazyType._debugInfo = [{ awaited: ioInfo }];
        return lazyType;
      };
      exports.memo = function(type, compare) {
        null == type && console.error(
          "memo: The first argument must be a component. Instead received: %s",
          null === type ? "null" : typeof type
        );
        compare = {
          $$typeof: REACT_MEMO_TYPE,
          type,
          compare: void 0 === compare ? null : compare
        };
        var ownName;
        Object.defineProperty(compare, "displayName", {
          enumerable: false,
          configurable: true,
          get: function() {
            return ownName;
          },
          set: function(name) {
            ownName = name;
            type.name || type.displayName || (Object.defineProperty(type, "name", { value: name }), type.displayName = name);
          }
        });
        return compare;
      };
      exports.startTransition = startTransition;
      exports.unstable_useCacheRefresh = function() {
        return resolveDispatcher().useCacheRefresh();
      };
      exports.use = function(usable) {
        return resolveDispatcher().use(usable);
      };
      exports.useActionState = function(action, initialState, permalink) {
        return resolveDispatcher().useActionState(
          action,
          initialState,
          permalink
        );
      };
      exports.useCallback = function(callback, deps) {
        return resolveDispatcher().useCallback(callback, deps);
      };
      exports.useContext = function(Context) {
        var dispatcher = resolveDispatcher();
        Context.$$typeof === REACT_CONSUMER_TYPE && console.error(
          "Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?"
        );
        return dispatcher.useContext(Context);
      };
      exports.useDebugValue = function(value, formatterFn) {
        return resolveDispatcher().useDebugValue(value, formatterFn);
      };
      exports.useDeferredValue = function(value, initialValue) {
        return resolveDispatcher().useDeferredValue(value, initialValue);
      };
      exports.useEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useEffect(create, deps);
      };
      exports.useEffectEvent = function(callback) {
        return resolveDispatcher().useEffectEvent(callback);
      };
      exports.useId = function() {
        return resolveDispatcher().useId();
      };
      exports.useImperativeHandle = function(ref, create, deps) {
        return resolveDispatcher().useImperativeHandle(ref, create, deps);
      };
      exports.useInsertionEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useInsertionEffect(create, deps);
      };
      exports.useLayoutEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useLayoutEffect(create, deps);
      };
      exports.useMemo = function(create, deps) {
        return resolveDispatcher().useMemo(create, deps);
      };
      exports.useOptimistic = function(passthrough, reducer) {
        return resolveDispatcher().useOptimistic(passthrough, reducer);
      };
      exports.useReducer = function(reducer, initialArg, init) {
        return resolveDispatcher().useReducer(reducer, initialArg, init);
      };
      exports.useRef = function(initialValue) {
        return resolveDispatcher().useRef(initialValue);
      };
      exports.useState = function(initialState) {
        return resolveDispatcher().useState(initialState);
      };
      exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
        return resolveDispatcher().useSyncExternalStore(
          subscribe,
          getSnapshot,
          getServerSnapshot
        );
      };
      exports.useTransition = function() {
        return resolveDispatcher().useTransition();
      };
      exports.version = "19.3.0";
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
    })();
  }
});

// ../hermes-overlay-core/node_modules/react/index.js
var require_react = __commonJS({
  "../hermes-overlay-core/node_modules/react/index.js"(exports, module) {
    "use strict";
    if (false) {
      module.exports = null;
    } else {
      module.exports = require_react_development();
    }
  }
});

// ../hermes-overlay-core/node_modules/react/cjs/react-jsx-runtime.development.js
var require_react_jsx_runtime_development = __commonJS({
  "../hermes-overlay-core/node_modules/react/cjs/react-jsx-runtime.development.js"(exports) {
    "use strict";
    (function() {
      function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type)
          return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch (type) {
          case REACT_FRAGMENT_TYPE:
            return "Fragment";
          case REACT_PROFILER_TYPE:
            return "Profiler";
          case REACT_STRICT_MODE_TYPE:
            return "StrictMode";
          case REACT_SUSPENSE_TYPE:
            return "Suspense";
          case REACT_SUSPENSE_LIST_TYPE:
            return "SuspenseList";
          case REACT_ACTIVITY_TYPE:
            return "Activity";
          case REACT_VIEW_TRANSITION_TYPE:
            return "ViewTransition";
        }
        if ("object" === typeof type)
          switch ("number" === typeof type.tag && console.error(
            "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
          ), type.$$typeof) {
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_CONTEXT_TYPE:
              return type.displayName || "Context";
            case REACT_CONSUMER_TYPE:
              return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
              var innerType = type.render;
              type = type.displayName;
              type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
              return type;
            case REACT_MEMO_TYPE:
              return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
              innerType = type._payload;
              type = type._init;
              try {
                return getComponentNameFromType(type(innerType));
              } catch (x) {
              }
          }
        return null;
      }
      function testStringCoercion(value) {
        return "" + value;
      }
      function checkKeyStringCoercion(value) {
        try {
          testStringCoercion(value);
          var JSCompiler_inline_result = false;
        } catch (e) {
          JSCompiler_inline_result = true;
        }
        if (JSCompiler_inline_result) {
          JSCompiler_inline_result = console;
          var JSCompiler_temp_const = JSCompiler_inline_result.error;
          var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
          JSCompiler_temp_const.call(
            JSCompiler_inline_result,
            "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
            JSCompiler_inline_result$jscomp$0
          );
          return testStringCoercion(value);
        }
      }
      function getTaskName(type) {
        if (type === REACT_FRAGMENT_TYPE) return "<>";
        if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE)
          return "<...>";
        try {
          var name = getComponentNameFromType(type);
          return name ? "<" + name + ">" : "<...>";
        } catch (x) {
          return "<...>";
        }
      }
      function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
      }
      function UnknownOwner() {
        return Error("react-stack-top-frame");
      }
      function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
          var getter = Object.getOwnPropertyDescriptor(config, "key").get;
          if (getter && getter.isReactWarning) return false;
        }
        return void 0 !== config.key;
      }
      function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
          specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error(
            "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
            displayName
          ));
        }
        warnAboutAccessingKey.isReactWarning = true;
        Object.defineProperty(props, "key", {
          get: warnAboutAccessingKey,
          configurable: true
        });
      }
      function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error(
          "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
        ));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
      }
      function ReactElement(type, key, props, owner, debugStack, debugTask) {
        var refProp = props.ref;
        type = {
          $$typeof: REACT_ELEMENT_TYPE,
          type,
          key,
          props,
          _owner: owner
        };
        null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
          enumerable: false,
          get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: null
        });
        Object.defineProperty(type, "_debugStack", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugStack
        });
        Object.defineProperty(type, "_debugTask", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugTask
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
      }
      function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
        var children = config.children;
        if (void 0 !== children)
          if (isStaticChildren)
            if (isArrayImpl(children)) {
              for (isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++)
                validateChildKeys(children[isStaticChildren]);
              Object.freeze && Object.freeze(children);
            } else
              console.error(
                "React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead."
              );
          else validateChildKeys(children);
        if (hasOwnProperty.call(config, "key")) {
          children = getComponentNameFromType(type);
          var keys = Object.keys(config).filter(function(k) {
            return "key" !== k;
          });
          isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
          didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error(
            'A props object containing a "key" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />',
            isStaticChildren,
            children,
            keys,
            children
          ), didWarnAboutKeySpread[children + isStaticChildren] = true);
        }
        children = null;
        void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
        hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
        if ("key" in config) {
          maybeKey = {};
          for (var propName in config)
            "key" !== propName && (maybeKey[propName] = config[propName]);
        } else maybeKey = config;
        children && defineKeyPropWarningGetter(
          maybeKey,
          "function" === typeof type ? type.displayName || type.name || "Unknown" : type
        );
        return ReactElement(
          type,
          children,
          maybeKey,
          getOwner(),
          debugStack,
          debugTask
        );
      }
      function validateChildKeys(node) {
        isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
      }
      function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
      }
      var React2 = require_react(), REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo"), REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = /* @__PURE__ */ Symbol.for("react.activity"), REACT_VIEW_TRANSITION_TYPE = /* @__PURE__ */ Symbol.for("react.view_transition"), REACT_CLIENT_REFERENCE = /* @__PURE__ */ Symbol.for("react.client.reference"), ReactSharedInternals = React2.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
        return null;
      };
      React2 = {
        react_stack_bottom_frame: function(callStackForError) {
          return callStackForError();
        }
      };
      var specialPropKeyWarningShown;
      var didWarnAboutElementRef = {};
      var unknownOwnerDebugStack = React2.react_stack_bottom_frame.bind(
        React2,
        UnknownOwner
      )();
      var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
      var didWarnAboutKeySpread = {};
      exports.Fragment = REACT_FRAGMENT_TYPE;
      exports.jsx = function(type, config, maybeKey) {
        var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        if (trackActualOwner) {
          var previousStackTraceLimit = Error.stackTraceLimit;
          Error.stackTraceLimit = 10;
          var debugStackDEV = Error("react-stack-top-frame");
          Error.stackTraceLimit = previousStackTraceLimit;
        } else debugStackDEV = unknownOwnerDebugStack;
        return jsxDEVImpl(
          type,
          config,
          maybeKey,
          false,
          debugStackDEV,
          trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask
        );
      };
      exports.jsxs = function(type, config, maybeKey) {
        var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        if (trackActualOwner) {
          var previousStackTraceLimit = Error.stackTraceLimit;
          Error.stackTraceLimit = 10;
          var debugStackDEV = Error("react-stack-top-frame");
          Error.stackTraceLimit = previousStackTraceLimit;
        } else debugStackDEV = unknownOwnerDebugStack;
        return jsxDEVImpl(
          type,
          config,
          maybeKey,
          true,
          debugStackDEV,
          trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask
        );
      };
    })();
  }
});

// ../hermes-overlay-core/node_modules/react/jsx-runtime.js
var require_jsx_runtime = __commonJS({
  "../hermes-overlay-core/node_modules/react/jsx-runtime.js"(exports, module) {
    "use strict";
    if (false) {
      module.exports = null;
    } else {
      module.exports = require_react_jsx_runtime_development();
    }
  }
});

// tests/tmp/load-z7biwT/sdk.mjs
var ROUTES_AREA = "routes";
var SIDEBAR_NAV_AREA = "sidebar.nav";
var PALETTE_AREA = "palette";
var STATUSBAR_AREAS = { left: "statusBar.left", right: "statusBar.right" };
var ListRow = () => null;
var ToggleRow = () => null;
var SegmentedControl = () => null;
var host = { navigate: () => {
}, request: async () => ({}), composer: {} };

// tests/tmp/load-z7biwT/entry.mjs
var import_react = __toESM(require_react(), 1);
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
var ID = "hermes-notebook";
var ROUTE = "/notebook";
var T = {
  text: "var(--ui-text-primary, #e9e9ef)",
  text2: "var(--ui-text-secondary, #b6b6c2)",
  text3: "var(--ui-text-tertiary, #8b8b99)",
  text4: "var(--ui-text-quaternary, #6d6d7a)",
  accent: "var(--ui-accent, #8b93ff)",
  line: "var(--ui-stroke-secondary, rgba(233,233,239,0.11))",
  lineSoft: "var(--ui-stroke-tertiary, rgba(233,233,239,0.07))",
  card: "var(--ui-bg-secondary, rgba(233,233,239,0.045))",
  cardDeep: "var(--ui-bg-tertiary, rgba(233,233,239,0.03))",
  ok: "var(--ui-success, #3fb950)",
  warn: "var(--ui-warning, #d29922)",
  danger: "var(--ui-danger, #f85149)",
  cyan: "var(--ui-cyan, #56b6c2)",
  purple: "var(--ui-purple, #9e94d5)"
};
var CSS = `
.nb-root{
  --nb-rail: 300px; --nb-studio: 392px;
  display:flex; flex-direction:column; height:100%; min-height:0;
  color:${T.text}; font-size:16px; line-height:1.5;
  font-variant-numeric: tabular-nums;
}
.nb-root *{box-sizing:border-box}
.nb-root :focus-visible{outline:2px solid ${T.accent}; outline-offset:2px; border-radius:6px}
.nb-mono{font-family:var(--ui-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-variant-ligatures:none}
.nb-meta{font-size:12.5px;letter-spacing:.07em;text-transform:uppercase;color:${T.text3};font-weight:600}
.nb-num{font-family:var(--ui-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-variant-numeric:tabular-nums}

/* app bar */
.nb-bar{display:flex;align-items:center;gap:14px;height:54px;flex:0 0 54px;
  padding:0 16px;border-bottom:1px solid ${T.line};}
.nb-brand{display:flex;align-items:center;gap:10px;min-width:0}
.nb-mark{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;flex:0 0 auto;
  background:color-mix(in srgb,${T.accent} 16%, transparent);
  border:1px solid color-mix(in srgb,${T.accent} 32%, transparent);color:${T.accent}}
.nb-brandname{font-weight:650;letter-spacing:-.01em;font-size:16px}
.nb-crumb{color:${T.text3};font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nb-crumb b{color:${T.text2};font-weight:550}
.nb-spacer{flex:1 1 auto}
.nb-actions{display:flex;align-items:center;gap:8px}

/* controls */
.nb-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;
  min-height:34px;padding:0 12px;border-radius:9px;cursor:pointer;font-size:14px;
  font-weight:560;border:1px solid ${T.line};background:${T.card};color:${T.text};
  transition:background .12s ease,border-color .12s ease,transform .06s ease}
.nb-btn:hover{background:color-mix(in srgb,${T.text} 9%, transparent);border-color:${T.lineSoft}}
.nb-btn:active{transform:translateY(0.5px)}
.nb-btn[disabled]{opacity:.45;cursor:not-allowed}
.nb-btn[data-variant=primary]{background:color-mix(in srgb,${T.accent} 20%, transparent);
  border-color:color-mix(in srgb,${T.accent} 46%, transparent);color:${T.accent};font-weight:650}
.nb-btn[data-variant=primary]:hover{background:color-mix(in srgb,${T.accent} 30%, transparent);
  border-color:color-mix(in srgb,${T.accent} 62%, transparent)}
.nb-btn[data-variant=ghost]{background:transparent;border-color:transparent;color:${T.text2}}
.nb-btn[data-variant=ghost]:hover{background:color-mix(in srgb,${T.text} 7%, transparent);color:${T.text}}
.nb-btn[data-size=sm]{min-height:28px;font-size:13px;padding:0 9px;border-radius:7px}
.nb-icon{width:36px;height:36px;min-height:36px;padding:0;border-radius:9px;display:grid;place-items:center;
  cursor:pointer;border:1px solid transparent;background:transparent;color:${T.text2}}
.nb-icon:hover{background:color-mix(in srgb,${T.text} 8%, transparent);color:${T.text}}
.nb-icon[data-active=true]{background:color-mix(in srgb,${T.accent} 16%, transparent);color:${T.accent}}
.nb-seg{display:inline-flex;padding:3px;gap:2px;border-radius:10px;background:${T.cardDeep};
  border:1px solid ${T.lineSoft}}
.nb-seg[data-fill="true"]{display:flex;width:100%}
.nb-seg[data-fill="true"] > button{flex:1;justify-content:center;padding:0 10px;font-size:13px}
.nb-seg > button{min-height:32px;padding:0 12px;border-radius:7px;border:0;background:transparent;
  color:${T.text3};font-size:13.5px;font-weight:600;cursor:pointer;letter-spacing:.01em;
  display:inline-flex;align-items:center;gap:6px}
.nb-seg > button:hover{color:${T.text}}
.nb-seg > button[aria-selected=true]{background:color-mix(in srgb,${T.text} 15%, transparent);
  color:${T.text};box-shadow:inset 0 0 0 1px ${T.line}, 0 1px 0 rgba(0,0,0,.18)}
.nb-field{display:flex;align-items:center;gap:8px;height:36px;padding:0 10px;border-radius:9px;
  border:1px solid ${T.line};background:${T.cardDeep};color:${T.text2}}
.nb-field input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;
  color:${T.text};font-size:14.5px;font-family:inherit}
.nb-field input::placeholder{color:${T.text4}}

/* body */
.nb-body{flex:1 1 auto;display:grid;grid-template-columns:var(--nb-rail) minmax(0,1fr) var(--nb-studio);
  min-height:0;overflow:hidden}
.nb-col{min-width:0;min-height:0;display:flex;flex-direction:column}
.nb-rail{position:relative;border-right:1px solid ${T.line};background:color-mix(in srgb,${T.text} 2%, transparent)}
.nb-studio{position:relative;border-left:1px solid ${T.line};background:color-mix(in srgb,${T.text} 2%, transparent)}
.nb-fade{position:absolute;left:0;right:0;bottom:0;height:34px;pointer-events:none;
  background:linear-gradient(to top, color-mix(in srgb, ${T.text} 6%, #0b0c11), transparent)}
.nb-pane-head{display:flex;align-items:center;gap:8px;height:44px;flex:0 0 44px;padding:0 14px;
  border-bottom:1px solid ${T.lineSoft}}
.nb-pane-head .nb-meta{flex:1}
.nb-scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain}
.nb-pad{padding:12px}

/* rail */
.nb-nbrow{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:left;cursor:pointer;
  border:1px solid transparent;background:transparent;border-radius:10px;padding:9px 10px;color:${T.text}}
.nb-nbrow:hover{background:color-mix(in srgb,${T.text} 5%, transparent)}
.nb-nbrow[aria-current=true]{background:color-mix(in srgb,${T.accent} 12%, transparent);
  border-color:color-mix(in srgb,${T.accent} 26%, transparent)}
.nb-nbrow[aria-current=true] .nb-nbtitle{color:${T.text}}
.nb-nbtitle{font-size:14.5px;font-weight:600;line-height:1.3;color:${T.text2};
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.nb-nbsub{font-size:12.5px;color:${T.text3};margin-top:2px}
.nb-avatar{width:30px;height:30px;border-radius:8px;flex:0 0 auto;display:grid;place-items:center;
  font-size:12px;font-weight:700;letter-spacing:-.02em;color:${T.accent};
  background:color-mix(in srgb,${T.accent} 13%, transparent);
  border:1px solid color-mix(in srgb,${T.accent} 22%, transparent)}

.nb-src{display:flex;gap:10px;width:100%;text-align:left;cursor:pointer;border-radius:10px;
  padding:9px 10px;border:1px solid transparent;background:transparent;color:${T.text}}
.nb-src:hover{background:color-mix(in srgb,${T.text} 5%, transparent)}
.nb-src[data-on=true]{background:color-mix(in srgb,${T.accent} 10%, transparent);
  border-color:color-mix(in srgb,${T.accent} 24%, transparent)}
.nb-cite{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:11.5px;font-weight:700;
  color:${T.text3};padding-top:2px;min-width:22px}
.nb-src[data-on=true] .nb-cite{color:${T.accent}}
.nb-src-title{font-size:14.5px;font-weight:550;line-height:1.32;color:${T.text};
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.nb-src-meta{display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap}
.nb-chip{display:inline-flex;align-items:center;gap:4px;height:21px;padding:0 7px;border-radius:6px;
  font-size:11.5px;font-weight:550;letter-spacing:.01em;color:${T.text2};
  background:color-mix(in srgb,${T.text} 7%, transparent);
  border:1px solid ${T.lineSoft};white-space:nowrap}
.nb-chip[data-tone=accent]{color:${T.accent};background:color-mix(in srgb,${T.accent} 18%, transparent);
  border-color:color-mix(in srgb,${T.accent} 40%, transparent)}
.nb-chip[data-tone=ok]{color:${T.ok};background:color-mix(in srgb,${T.ok} 12%, transparent);
  border-color:color-mix(in srgb,${T.ok} 26%, transparent)}
.nb-chip[data-tone=warn]{color:${T.warn};background:color-mix(in srgb,${T.warn} 13%, transparent);
  border-color:color-mix(in srgb,${T.warn} 28%, transparent)}
.nb-chip[data-tone=danger]{color:${T.danger};background:color-mix(in srgb,${T.danger} 13%, transparent);
  border-color:color-mix(in srgb,${T.danger} 28%, transparent)}
.nb-chip[data-click=true]{cursor:pointer;min-height:32px;height:32px;padding:0 11px;font-size:12.5px}
.nb-chip[data-click=true]:hover{background:color-mix(in srgb,${T.text} 12%, transparent)}

/* main */
.nb-main-head{padding:16px 22px 12px;border-bottom:1px solid ${T.lineSoft};flex:0 0 auto}
.nb-h1{font-size:23px;font-weight:650;letter-spacing:-.02em;line-height:1.2;margin:0}
.nb-sub{color:${T.text3};font-size:14.5px;margin-top:5px;max-width:70ch}
.nb-strip{display:flex;align-items:stretch;margin-top:14px;border:1px solid ${T.line};
  border-radius:11px;overflow:hidden;background:${T.card}} 
.nb-cell{flex:1;padding:9px 14px;border-right:1px solid ${T.lineSoft};min-width:0}
.nb-cell:last-child{border-right:0}
.nb-cell b{display:block;font-size:18px;font-weight:650;letter-spacing:-.01em;line-height:1.15}
.nb-cell span{display:block;font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;
  color:${T.text3};margin-top:3px;font-weight:600}
.nb-tabs{display:flex;gap:4px;align-items:center;margin:12px 0 0}
.nb-tab{min-height:32px;padding:0 12px;border-radius:8px;border:1px solid transparent;
  background:transparent;color:${T.text3};font-size:14px;font-weight:600;cursor:pointer;
  display:inline-flex;align-items:center;gap:7px}
.nb-tab:hover{color:${T.text};background:color-mix(in srgb,${T.text} 6%, transparent)}
.nb-tab[aria-selected=true]{color:${T.text};background:color-mix(in srgb,${T.text} 10%, transparent);
  border-color:${T.line}}

/* chat */
.nb-chat{flex:1;min-height:0;display:flex;flex-direction:column}
.nb-thread{flex:1;min-height:0;overflow:auto;padding:20px 22px 8px;display:flex;flex-direction:column;gap:18px}
.nb-msg{display:flex;gap:12px;max-width:78ch}
.nb-msg[data-role=user]{align-self:flex-end;flex-direction:row-reverse}
.nb-msg-body{min-width:0}
.nb-msg[data-role=user] .nb-bubble{background:color-mix(in srgb,${T.accent} 13%, transparent);
  border:1px solid color-mix(in srgb,${T.accent} 22%, transparent);border-radius:12px 12px 4px 12px;
  padding:10px 14px;font-size:15.5px}
.nb-msg[data-role=assistant] .nb-bubble{font-size:16px;line-height:1.62;color:${T.text}}
.nb-who{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:${T.text4};
  font-weight:700;margin-bottom:6px}
.nb-md p{margin:0 0 10px}
.nb-md h2{font-size:17px;margin:16px 0 8px;letter-spacing:-.01em}
.nb-md h3{font-size:15.5px;margin:14px 0 6px;color:${T.text2}}
.nb-md ul{margin:0 0 10px;padding-left:20px}
.nb-md li{margin:4px 0}
.nb-md code{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:13.5px;
  background:color-mix(in srgb,${T.text} 9%, transparent);padding:1px 5px;border-radius:5px}
.nb-md strong{font-weight:650;color:${T.text}}
.nb-md blockquote{margin:10px 0;padding:2px 0 2px 12px;border-left:2px solid ${T.accent};color:${T.text2}}
.nb-inline-cite{display:inline-flex;align-items:center;min-height:26px;padding:0 7px;margin:0 2px;
  border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer;vertical-align:baseline;
  font-family:var(--ui-font-mono,ui-monospace,monospace);color:${T.accent};
  background:color-mix(in srgb,${T.accent} 12%, transparent);
  border:1px solid color-mix(in srgb,${T.accent} 26%, transparent)}
.nb-inline-cite:hover{background:color-mix(in srgb,${T.accent} 22%, transparent)}
.nb-composer{flex:0 0 auto;padding:12px 22px 16px;border-top:1px solid ${T.lineSoft}}
.nb-askbox{display:flex;flex-direction:column;gap:8px;border:1px solid ${T.line};border-radius:12px;
  background:${T.card};padding:10px 12px}
.nb-askbox:focus-within{border-color:color-mix(in srgb,${T.accent} 45%, transparent)}
.nb-askbox textarea{width:100%;min-height:44px;max-height:150px;resize:none;border:0;outline:0;
  background:transparent;color:${T.text};font-size:16px;line-height:1.5;font-family:inherit}
.nb-askbox textarea::placeholder{color:${T.text4}}
.nb-askfoot{display:flex;align-items:center;gap:8px}
.nb-hint{font-size:12.5px;color:${T.text3}}

/* studio cards */
.nb-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px}
.nb-card{display:flex;flex-direction:column;gap:6px;min-height:104px;padding:11px;border-radius:11px;
  border:1px solid ${T.line};background:${T.card};cursor:pointer;text-align:left;color:${T.text};
  position:relative;transition:border-color .12s ease,background .12s ease}
.nb-card:hover{border-color:color-mix(in srgb,${T.accent} 34%, transparent);
  background:color-mix(in srgb,${T.accent} 7%, ${T.card})}
.nb-card[data-ready=true]{background:linear-gradient(180deg,
  color-mix(in srgb,${T.accent} 9%, ${T.card}), ${T.card})}
.nb-card[data-busy=true]{border-color:color-mix(in srgb,${T.accent} 50%, transparent)}
.nb-card-top{display:flex;align-items:center;gap:8px}
.nb-card-ic{width:26px;height:26px;border-radius:7px;display:grid;place-items:center;flex:0 0 auto;
  color:${T.accent};background:color-mix(in srgb,${T.accent} 12%, transparent)}
.nb-card-name{font-size:14.5px;font-weight:620;letter-spacing:-.01em;line-height:1.2}
.nb-card-blurb{font-size:13px;color:${T.text3};line-height:1.38;flex:1}
.nb-card-state{display:flex;align-items:center;gap:6px;font-size:12px;color:${T.text3};
  letter-spacing:.01em;font-weight:600;margin-top:auto}
.nb-card[data-ready="false"]{background:color-mix(in srgb,${T.text} 2.5%, transparent)}
.nb-card[data-ready="false"]:hover{border-color:color-mix(in srgb,${T.accent} 38%, transparent);
  background:color-mix(in srgb,${T.accent} 6%, transparent)}
.nb-card[data-ready="false"] .nb-card-state{color:${T.accent};font-weight:650}
.nb-card[data-ready="true"] .nb-card-state{color:${T.text3}}
.nb-card[data-ready="true"]:hover .nb-card-state{color:${T.text2}}
.nb-bar-track{height:3px;border-radius:2px;background:color-mix(in srgb,${T.text} 10%, transparent);
  overflow:hidden;margin-top:2px}
.nb-bar-fill{height:100%;background:${T.accent};border-radius:2px;transition:width .4s ease}
.nb-dot{width:6px;height:6px;border-radius:99px;background:${T.ok};box-shadow:0 0 6px ${T.ok}}

/* viewer */
.nb-view{flex:1;min-height:0;display:flex;flex-direction:column}
.nb-view-head{display:flex;align-items:center;gap:10px;padding:10px 18px;border-bottom:1px solid ${T.lineSoft}}
.nb-view-title{font-size:15px;font-weight:620;letter-spacing:-.01em}
.nb-view-body{flex:1;min-height:0;overflow:auto;padding:20px 24px}
.nb-doc{max-width:74ch;font-size:16px;line-height:1.66}
.nb-doc h2{font-size:19px;margin:22px 0 10px;letter-spacing:-.015em}
.nb-doc h2:first-child{margin-top:0}
.nb-doc h3{font-size:16px;margin:18px 0 6px;color:${T.text2}}
.nb-doc ul,.nb-doc ol{padding-left:22px;margin:0 0 12px}
.nb-doc li{margin:5px 0}
.nb-doc table{border-collapse:collapse;width:100%;font-size:14.5px;margin:12px 0}
.nb-doc th,.nb-doc td{border:1px solid ${T.line};padding:7px 10px;text-align:left}
.nb-doc th{background:${T.cardDeep};font-weight:620}
.nb-doc pre{background:${T.cardDeep};border:1px solid ${T.lineSoft};border-radius:9px;padding:12px;
  overflow:auto;font-size:13.5px}

/* stage (media) */
.nb-stage{display:flex;flex-direction:column;gap:14px}
.nb-screen{position:relative;border-radius:14px;overflow:hidden;background:#07080b;
  border:1px solid ${T.line};aspect-ratio:16/9;display:grid;place-items:center}
.nb-screen video,.nb-screen iframe{width:100%;height:100%;border:0;display:block;background:#07080b}
.nb-screen-audio{aspect-ratio:auto;padding:18px;display:flex;flex-direction:column;gap:14px;
  place-items:stretch;width:100%;
  background:linear-gradient(150deg,color-mix(in srgb,${T.accent} 16%, #0a0b10),#0a0b10)}
.nb-wave{display:flex;align-items:center;gap:2px;height:64px;width:100%}
.nb-wave i{flex:1 1 0;min-width:2px;background:color-mix(in srgb,${T.accent} 72%, white);
  border-radius:2px;opacity:.55;transition:opacity .2s,transform .2s}
.nb-wave i[data-past=true]{opacity:1}
.nb-ctrl{display:flex;align-items:center;gap:10px}
.nb-timeline{display:flex;flex-direction:column;gap:0;margin:0;padding:0;list-style:none}
.nb-tl{display:grid;grid-template-columns:96px 1fr;gap:14px;padding:10px 0;border-top:1px solid ${T.lineSoft}}
.nb-tl:first-child{border-top:0}
.nb-tl-when{font-size:13px;font-weight:650;color:${T.accent};letter-spacing:.02em}
.nb-tl-what{font-size:15px;color:${T.text2}}

/* mind map */
.nb-map{width:100%;height:100%;min-height:320px;display:block;cursor:grab;
  border-radius:12px;background:radial-gradient(circle at 50% 45%,
   color-mix(in srgb,${T.accent} 9%, transparent), transparent 62%)}
.nb-map:active{cursor:grabbing}

/* flashcards */
.nb-deck{display:flex;flex-direction:column;gap:16px;max-width:620px;margin:0 auto}
.nb-flip{perspective:1400px;cursor:pointer;border:0;background:transparent;padding:0}
.nb-flip-inner{position:relative;width:100%;min-height:300px;transition:transform .5s cubic-bezier(.2,.7,.2,1);
  transform-style:preserve-3d}
.nb-flip[data-flipped=true] .nb-flip-inner{transform:rotateY(180deg)}
.nb-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:14px;
  border:1px solid ${T.line};background:${T.card};padding:26px;display:flex;flex-direction:column;
  justify-content:center;gap:10px;font-size:19px;line-height:1.45}
.nb-face[data-side=back]{transform:rotateY(180deg);
  background:linear-gradient(160deg,color-mix(in srgb,${T.accent} 12%, ${T.card}),${T.card})}
.nb-face .nb-meta{position:absolute;top:16px;left:20px}
.nb-face-hint{font-size:12.5px;color:${T.text4};margin-top:auto;letter-spacing:.01em}

/* ops */
.nb-fleet{display:flex;flex-direction:column;gap:2px;padding:8px}
.nb-frow{display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;gap:10px;
  padding:8px 10px;border-radius:9px;border:1px solid transparent;background:transparent;
  cursor:pointer;text-align:left;color:${T.text};min-height:44px}
.nb-frow:hover{background:color-mix(in srgb,${T.text} 5%, transparent)}
.nb-frow[aria-current=true]{background:color-mix(in srgb,${T.accent} 11%, transparent);
  border-color:color-mix(in srgb,${T.accent} 24%, transparent)}
.nb-fname{font-size:14.5px;font-weight:600;line-height:1.25}
.nb-frole{font-size:12px;color:${T.text4};text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.nb-term{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:13.5px;line-height:1.55;flex:1 1 auto;
  background:#08090d;color:#d6d8e6;border-radius:10px;border:1px solid ${T.line};
  padding:12px 14px;min-height:120px;max-height:none;overflow:auto;white-space:pre-wrap;
  word-break:break-word}
.nb-term-in{display:flex;gap:8px;align-items:center;margin-top:10px}
.nb-term-in input{flex:1;height:38px;border-radius:9px;border:1px solid ${T.line};
  background:${T.cardDeep};color:${T.text};padding:0 12px;font-size:14px;
  font-family:var(--ui-font-mono,ui-monospace,monospace);outline:0}
.nb-term-in input:focus{border-color:color-mix(in srgb,${T.accent} 45%, transparent)}

/* status bar */
.nb-status{flex:0 0 32px;height:32px;display:flex;align-items:center;gap:16px;padding:0 14px;
  border-top:1px solid ${T.line};background:color-mix(in srgb,${T.text} 3%, transparent);
  font-size:12.5px;color:${T.text3}}
.nb-status b{color:${T.text2};font-weight:600}
.nb-sdot{width:7px;height:7px;border-radius:99px;display:inline-block;margin-right:6px}
.nb-void{display:grid;place-items:center;height:100%;padding:32px;text-align:center;color:${T.text3}}
.nb-void h3{color:${T.text};font-size:18px;margin:0 0 8px;letter-spacing:-.01em}
.nb-void p{margin:0;max-width:46ch;font-size:14.5px;line-height:1.6}

@media (max-width:1280px){
  .nb-root{--nb-rail:264px; --nb-studio:340px}
}
@media (max-width:1100px){
  .nb-body{grid-template-columns:240px minmax(0,1fr)}
  .nb-studio{display:none}
}
@media (max-width:820px){
  .nb-body{grid-template-columns:minmax(0,1fr)}
  .nb-rail{display:none}
}
`;
var el = (tag, props, ...kids) => {
  const merged = { ...props || {} };
  if (kids.length === 1 && merged.children !== void 0 && (typeof kids[0] === "string" || typeof kids[0] === "number")) {
    merged.key = kids[0];
  } else if (kids.length === 1) {
    merged.children = kids[0];
  } else if (kids.length > 1) {
    merged.children = kids;
  }
  return (0, import_jsx_runtime.jsxs)(tag, merged);
};
var cx = (...parts) => parts.filter(Boolean).join(" ");
var nfmt = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(Math.round(v));
};
var ago = (stamp) => {
  const then = Date.parse(stamp);
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 6e4);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};
var clock = (stamp) => {
  const d = new Date(Date.parse(stamp) || Date.now());
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
var esc = (s) => String(s == null ? "" : s);
var P = {
  notebook: "M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Zm0 0v16M9 8h6M9 12h6",
  book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5ZM8 7h7M8 10h5",
  video: "M3 7.5A2.5 2.5 0 0 1 5.5 5h7A2.5 2.5 0 0 1 15 7.5v9A2.5 2.5 0 0 1 12.5 19h-7A2.5 2.5 0 0 1 3 16.5v-9ZM15 10l5-3v10l-5-3",
  audio: "M4 10v4M8 6v12M12 8v8M16 4v16M20 9v6",
  mindmap: "M9 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM12 9V5M12 15v4M9.6 10.4 5 8M9.6 13.6 5 16M14.4 10.4 19 8M14.4 13.6 19 16",
  study: "M3 8l9-4 9 4-9 4-9-4Zm3 4.2V16c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-3.8",
  doc: "M7 3h7l4 4v14H7V3Zm7 0v4h4M9.5 12h6M9.5 15.5h6M9.5 8.5h2",
  faq: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-2.2-9.8a2.2 2.2 0 1 1 3.1 2c-.6.3-.9.8-.9 1.4v.4M12 17h.01",
  timeline: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3.2 2",
  cards: "M8 7h11v11H8V7ZM5 17V4h11",
  slides: "M3 4h18v11H3V4Zm9 11v5M8 20h8",
  chart: "M4 20h16M7 16V9M12 16V5M17 16v-5",
  summary: "M5 6h14M5 10h14M5 14h9M5 18h6",
  quiz: "M4 5h16v14H4V5Zm3.5 7.2 2 2 3.5-3.5",
  search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm4.8.2L20 21",
  plus: "M12 5v14M5 12h14",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 18l-6-6 6-6",
  play: "M7 4.5v15l13-7.5-13-7.5Z",
  pause: "M8 5v14M16 5v14",
  chevron: "M6 9l6 6 6-6",
  close: "M6 6l12 12M18 6L6 18",
  refresh: "M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4",
  sparkle: "M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7L12 3Z",
  external: "M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  terminal: "M4 5h16v14H4V5Zm3.5 5 2.5 2.5L7.5 15M13 15h4",
  server: "M4 6h16v5H4V6Zm0 7h16v5H4v-5ZM7 8.5h.01M7 15.5h.01",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
  camera: "M4 8h3l1.5-2h7L17 8h3v11H4V8Zm8 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  shield: "M12 3l8 3v6c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6l8-3Zm-3 9 2 2 4-4",
  copy: "M9 9h10v10H9V9Zm-4 6H4V4h11v1",
  check: "M5 13l4.5 4.5L19 7",
  download: "M12 4v10M8 11l4 4 4-4M5 19h14",
  bolt: "M13 3L5 14h6l-1 7 8-11h-6l1-7Z",
  cpu: "M8 8h8v8H8V8Zm-3 3h3m-3 3h3m13-6h-3m3 6h-3M11 5v3m3-3v3m-3 11v-3m3 3v-3",
  link: "M10 14a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11.4 7M14 10a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7L12.6 17",
  file: "M7 3h7l4 4v14H7V3Zm7 0v4h4",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-18c3 3.4 3 14.6 0 18M3.5 9h17M3.5 15h17",
  image: "M4 5h16v14H4V5Zm3 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM20 15l-5-5-8 9",
  note: "M6 3h9l4 4v14H6V3Zm3 8h7m-7 4h5",
  trash: "M5 7h14M9 7V4h6v3m-7 0 1 13h6l1-13",
  layers: "M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17.5 12 22l9-4.5",
  send: "M4 12l16-8-6 16-3-6-7-2Z",
  keyboard: "M3 6h18v12H3V6Zm3 3h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M6.5 15h11",
  grid: "M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z",
  stop: "M7 7h10v10H7V7Z"
};
function Glyph({ name, size = 16, stroke = 1.7 }) {
  const d = P[name] || P.doc;
  return el("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false",
    children: el("path", { d })
  });
}
function Btn({ children, icon, variant, size, onClick, disabled, title, type = "button", ...rest }) {
  return el("button", {
    type,
    className: "nb-btn",
    "data-variant": variant,
    "data-size": size,
    onClick,
    disabled,
    title,
    "aria-label": rest["aria-label"],
    children: [
      icon ? (0, import_jsx_runtime.jsx)(Glyph, { name: icon, size: size === "sm" ? 14 : 15 }) : null,
      children ? el("span", { children }) : null
    ].filter(Boolean)
  });
}
function IconBtn({ icon, label, onClick, active, size = 16 }) {
  return el("button", {
    type: "button",
    className: "nb-icon",
    onClick,
    title: label,
    "aria-label": label,
    "data-active": active ? "true" : "false",
    children: (0, import_jsx_runtime.jsx)(Glyph, { name: icon, size })
  });
}
function Seg({ value, onChange, options, label, fill }) {
  const refs = (0, import_react.useRef)([]);
  const onKey = (e) => {
    const i = options.findIndex((o) => o.id === value);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].id);
    const node = refs.current[next];
    if (node) node.focus();
  };
  return el("div", {
    className: "nb-seg",
    role: "tablist",
    "aria-label": label,
    onKeyDown: onKey,
    "data-fill": fill ? "true" : "false"
  }, options.map((o, i) => el("button", {
    type: "button",
    role: "tab",
    ref: (n) => {
      refs.current[i] = n;
    },
    "aria-selected": o.id === value,
    tabIndex: o.id === value ? 0 : -1,
    onClick: () => onChange(o.id),
    title: o.title || o.label,
    children: [
      o.icon ? (0, import_jsx_runtime.jsx)(Glyph, { name: o.icon, size: 14 }) : null,
      el("span", { children: o.label })
    ].filter(Boolean)
  }, o.id)));
}
function Chip({ children, tone, onClick, title, pressed }) {
  const clickable = typeof onClick === "function";
  const props = {
    className: "nb-chip",
    "data-tone": tone,
    "data-click": clickable ? "true" : void 0,
    title,
    children
  };
  if (clickable) {
    props.onClick = onClick;
    props.type = "button";
    props["aria-pressed"] = pressed === void 0 ? void 0 : !!pressed;
    return el("button", props);
  }
  return el("span", props);
}
function SearchField({ value, onChange, placeholder, label }) {
  return el(
    "div",
    { className: "nb-field" },
    (0, import_jsx_runtime.jsx)(Glyph, { name: "search", size: 14 }),
    el("input", {
      value,
      placeholder,
      "aria-label": label || placeholder,
      onChange: (e) => onChange(e.target.value),
      spellCheck: false
    }),
    value ? (0, import_jsx_runtime.jsx)(IconBtn, { icon: "close", label: "Clear search", size: 13, onClick: () => onChange("") }) : null
  );
}
function useDialogFocus(open, onClose) {
  (0, import_react.useEffect)(() => {
    if (!open) return void 0;
    const prior = document.activeElement;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = document.querySelector('[data-nb-dialog="true"]');
      if (!root) return;
      const items = Array.from(root.querySelectorAll(
        'button,[href],input,textarea,select,[tabindex]:not([tabindex="-1"])'
      )).filter((n) => !n.disabled && n.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    const t = setTimeout(() => {
      const root = document.querySelector('[data-nb-dialog="true"]');
      const target = root && (root.querySelector("[autofocus]") || root.querySelector("input,textarea,button"));
      if (target) target.focus();
    }, 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
      if (prior && prior.focus) prior.focus();
    };
  }, [open, onClose]);
}
function Dialog({ open, onClose, title, children, width = 520 }) {
  useDialogFocus(open, onClose);
  if (!open) return null;
  return el(
    "div",
    {
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 90,
        display: "grid",
        placeItems: "center",
        background: "color-mix(in srgb, #000 55%, transparent)",
        padding: "24px"
      },
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      }
    },
    el(
      "div",
      {
        "data-nb-dialog": "true",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": title,
        tabIndex: -1,
        style: {
          width: `min(${width}px, 100%)`,
          maxHeight: "84vh",
          overflow: "auto",
          background: "var(--ui-bg-elevated, var(--ui-bg-primary, #14151b))",
          border: `1px solid ${T.line}`,
          borderRadius: "14px",
          padding: "18px",
          boxShadow: "0 24px 60px rgba(0,0,0,.45)"
        }
      },
      el(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" } },
        el(
          "div",
          { style: { flex: 1 } },
          el("div", { style: { fontSize: "17px", fontWeight: 650, letterSpacing: "-.01em" }, children: title })
        ),
        (0, import_jsx_runtime.jsx)(IconBtn, { icon: "close", label: "Close dialog", onClick: onClose })
      ),
      children
    )
  );
}
var INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|\[S\d+\]|\[[^\]]+\]\([^)]+\))/g;
function inlineNodes(text, keyBase, onCite) {
  const out = [];
  let last = 0;
  const s = esc(text);
  let m;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(s)) !== null) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${m.index}`;
    if (tok.startsWith("**")) {
      out.push(el("strong", { children: tok.slice(2, -2) }, k));
    } else if (tok.startsWith("`")) {
      out.push(el("code", { children: tok.slice(1, -1) }, k));
    } else if (tok.startsWith("*")) {
      out.push(el("em", { children: tok.slice(1, -1) }, k));
    } else if (/^\[S\d+\]$/.test(tok)) {
      const n = Number(tok.slice(2, -1));
      if (onCite) {
        out.push(el("button", {
          type: "button",
          className: "nb-inline-cite",
          title: `Open source S${n}`,
          "aria-label": `Citation ${n} \u2014 open the source`,
          onClick: (e) => {
            e.stopPropagation();
            onCite(n);
          },
          children: tok
        }, k));
      } else out.push(el("span", { className: "nb-inline-cite", children: tok }, k));
    } else {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      out.push(el("a", {
        href: mm[2],
        target: "_blank",
        rel: "noreferrer",
        style: { color: T.accent },
        children: mm[1]
      }, k));
    }
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
function Markdown({ text, onCite, className }) {
  const blocks = (0, import_react.useMemo)(() => parseBlocks(String(text || "")), [text]);
  return el("div", {
    className: cx("nb-md", className),
    children: blocks.map((b, i) => renderBlock(b, i, onCite))
  });
}
function parseBlocks(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  const flushList = (ordered, items) => {
    blocks.push({ t: ordered ? "ol" : "ul", items });
  };
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const buf2 = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf2.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ t: "code", lang, text: buf2.join("\n") });
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ t: "h" + h[1].length, text: h[2] });
      i += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf2 = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf2.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ t: "quote", text: buf2.join(" ") });
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        i += 1;
      }
      const body = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c) || !c));
      if (body.length) blocks.push({ t: "table", rows: [body[0], body.slice(1)] });
      continue;
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ""));
        i += 1;
      }
      flushList(ordered, items);
      continue;
    }
    const buf = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|\s*\||\s*([-*+]|\d+\.)\s|```)/.test(lines[i])) {
      buf.push(lines[i]);
      i += 1;
    }
    blocks.push({ t: "p", text: buf.join(" ") });
  }
  return blocks;
}
function renderBlock(b, i, onCite) {
  const key = `b${i}`;
  if (b.t === "ul" || b.t === "ol") {
    return el(b.t, { key }, b.items.map((it, j) => el("li", { children: inlineNodes(it, key + j, onCite) }, `${key}-${j}`)));
  }
  if (b.t === "table") {
    const [head, rows] = b.rows;
    return el(
      "table",
      { key },
      el("thead", { children: el("tr", { children: head.map((c, j) => el("th", { children: inlineNodes(c, `${key}t${j}`, onCite) }, `${key}-th-${j}`)) }) }),
      el("tbody", { children: rows.map((r, j) => el("tr", { children: r.map((c, k2) => el("td", { children: inlineNodes(c, `${key}r${j}c${k2}`, onCite) }, `${key}-${j}-${k2}`)) }, `${key}-r-${j}`)) })
    );
  }
  if (b.t === "code") {
    return el("pre", { key }, el("code", { children: b.text }));
  }
  const tag = b.t === "quote" ? "blockquote" : b.t.length === 2 ? b.t : "p";
  return (0, import_jsx_runtime.jsx)(tag, { key, children: inlineNodes(b.text, key, onCite) });
}
var CTX = null;
var setCtx = (c) => {
  CTX = c;
};
var api = async (path, opts) => {
  if (!CTX || typeof CTX.rest !== "function") {
    throw new Error("this page is not attached to the gateway yet \u2014 reload the window");
  }
  const out = await CTX.rest(path, opts);
  if (out && out.ok === false) throw new Error(out.error || "the backend refused that");
  if (out && out.detail && out.ok === void 0) throw new Error(String(out.detail));
  return out;
};
var qs = (obj) => Object.keys(obj).filter((k) => obj[k] !== void 0 && obj[k] !== null && obj[k] !== "").map((k) => `${k}=${encodeURIComponent(obj[k])}`).join("&");
var persist = {
  get(key, dflt) {
    try {
      const v = CTX && CTX.storage && CTX.storage.get(key);
      return v === void 0 || v === null ? dflt : v;
    } catch {
      return dflt;
    }
  },
  set(key, value) {
    try {
      CTX && CTX.storage && CTX.storage.set(key, value);
    } catch {
    }
  }
};
function useStudio(nb) {
  const [data, setData] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)("");
  const [loading, setLoading] = (0, import_react.useState)(true);
  const alive = (0, import_react.useRef)(true);
  const load = (0, import_react.useCallback)(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const next = await api(`/state${nb ? `?${qs({ notebook: nb })}` : ""}`);
      if (!alive.current) return next;
      setData(next);
      setError("");
      return next;
    } catch (e) {
      if (alive.current) setError(e.message || String(e));
      return null;
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [nb]);
  (0, import_react.useEffect)(() => {
    alive.current = true;
    load(false);
    return () => {
      alive.current = false;
    };
  }, [load]);
  return { data, error, loading, reload: load, setData };
}
var KIND_ICON = {
  video_overview: "video",
  audio_overview: "audio",
  summary: "summary",
  briefing_doc: "doc",
  study_guide: "study",
  faq: "faq",
  timeline: "timeline",
  mind_map: "mindmap",
  flashcards: "cards",
  quiz: "quiz",
  slides: "slides",
  infographic: "chart"
};
var FILTERS = [
  { id: "all", label: "All" },
  { id: "docs", label: "Docs" },
  { id: "study", label: "Study" },
  { id: "media", label: "Media" },
  { id: "visual", label: "Visual" }
];
function latestByKind(artifacts) {
  const map = {};
  for (const a of artifacts || []) {
    if (!map[a.kind]) map[a.kind] = a;
  }
  return map;
}
function App() {
  const [mode, setMode] = (0, import_react.useState)(() => persist.get("mode", "studio"));
  const [nb, setNb] = (0, import_react.useState)(() => persist.get("notebook", ""));
  const studio = useStudio(nb);
  const [picked, setPicked] = (0, import_react.useState)(null);
  const [tab, setTab] = (0, import_react.useState)("chat");
  const [busy, setBusy] = (0, import_react.useState)({});
  const [toast, setToast] = (0, import_react.useState)("");
  const [askOpen, setAskOpen] = (0, import_react.useState)(0);
  const [addSource, setAddSource] = (0, import_react.useState)(false);
  const [newNb, setNewNb] = (0, import_react.useState)(false);
  const [filter, setFilter] = (0, import_react.useState)("all");
  const [q, setQ] = (0, import_react.useState)("");
  const [note, setNote] = (0, import_react.useState)("");
  const [opsStats, setOpsStats] = (0, import_react.useState)(null);
  const say = (0, import_react.useCallback)((msg) => {
    setNote(msg);
    const t = setTimeout(() => setNote(""), 6e3);
    return () => clearTimeout(t);
  }, []);
  (0, import_react.useEffect)(() => {
    persist.set("mode", mode);
  }, [mode]);
  (0, import_react.useEffect)(() => {
    persist.set("notebook", nb);
  }, [nb]);
  const data = studio.data;
  const notebook = data && data.notebook;
  const kinds = data && data.kinds || [];
  (0, import_react.useEffect)(() => {
    if (!nb && data && data.notebooks && data.notebooks.length) setNb(data.notebooks[0].id);
  }, [data, nb]);
  (0, import_react.useEffect)(() => {
    if (!notebook) return;
    const want = persist.get("__open", "");
    if (!want) return;
    const hit = (notebook.artifacts || []).find((a) => a.kind === want);
    if (hit) {
      setPicked(hit);
      setTab("view");
    }
    persist.set("__open", "");
  }, [notebook]);
  const generate = (0, import_react.useCallback)(async (kind) => {
    if (!notebook) return;
    setBusy((b) => ({ ...b, [kind]: Date.now() }));
    try {
      await api("/generate", {
        method: "POST",
        body: { notebook: notebook.id, kind, length: "short" },
        timeoutMs: 24e4
      });
      await studio.reload(true);
      const fresh = await studio.reload(true);
      const target = fresh && fresh.notebook && fresh.notebook.artifacts ? fresh.notebook.artifacts.find((a) => a.kind === kind) : null;
      if (target) {
        setPicked(target);
        setTab("view");
      }
      say(`${kind.replace(/_/g, " ")} ready`);
    } catch (e) {
      say(`${kind.replace(/_/g, " ")} failed: ${e.message || e}`);
    } finally {
      setBusy((b) => {
        const n = { ...b };
        delete n[kind];
        return n;
      });
    }
  }, [notebook, studio, say]);
  const ops = mode === "ops";
  return el(
    "div",
    { className: "nb-root", "data-mode": mode, "data-plugin": ID },
    el("style", { dangerouslySetInnerHTML: { __html: CSS } }),
    el(
      "header",
      { className: "nb-bar" },
      el(
        "div",
        { className: "nb-brand" },
        el("span", { className: "nb-mark" }, (0, import_jsx_runtime.jsx)(Glyph, { name: "notebook", size: 15 })),
        el("span", { className: "nb-brandname", children: "Notebook" }),
        el(
          "span",
          { className: "nb-crumb" },
          ops ? el("b", { children: "Lab Ops" }) : el("span", null, "/ ", el("b", { children: notebook ? notebook.title : "no notebook" }))
        )
      ),
      el("div", { className: "nb-spacer" }),
      (0, import_jsx_runtime.jsx)(Seg, {
        label: "Surface",
        value: mode,
        onChange: (v) => setMode(v),
        options: [
          { id: "studio", label: "Studio", icon: "notebook" },
          { id: "ops", label: "Lab Ops", icon: "server" }
        ]
      }),
      el(
        "div",
        { className: "nb-actions" },
        ops ? null : (0, import_jsx_runtime.jsx)(Btn, {
          icon: "plus",
          variant: "primary",
          onClick: () => setAddSource(true),
          disabled: !notebook,
          children: "Add source"
        })
      )
    ),
    ops ? (0, import_jsx_runtime.jsx)(OpsDeck, { onSay: say, onStats: setOpsStats }) : el(
      "div",
      { className: "nb-body" },
      (0, import_jsx_runtime.jsx)(Rail, {
        data,
        nb,
        setNb,
        q,
        setQ,
        filter,
        setFilter,
        onNewNotebook: () => setNewNb(true),
        onAddSource: () => setAddSource(true),
        loading: studio.loading,
        error: studio.error,
        reload: studio.reload
      }),
      (0, import_jsx_runtime.jsx)(Main, {
        notebook,
        kinds,
        tab,
        setTab,
        picked,
        setPicked,
        busy,
        generate,
        onAsk: () => setAskOpen((n) => n + 1),
        askOpen,
        onSay: say,
        reload: studio.reload,
        modelReady: data && data.model_ready,
        error: studio.error,
        loading: studio.loading,
        onAddSource: () => setAddSource(true)
      }),
      (0, import_jsx_runtime.jsx)(StudioPanel, {
        kinds,
        notebook,
        busy,
        generate,
        filter,
        setFilter,
        picked,
        setPicked,
        onOpen: (art) => {
          setPicked(art);
          setTab("view");
        }
      })
    ),
    (0, import_jsx_runtime.jsx)(StatusBar, { mode, notebook, data, note, opsStats }),
    (0, import_jsx_runtime.jsx)(AddSourceDialog, {
      open: addSource,
      onClose: () => setAddSource(false),
      notebook,
      onDone: async (msg) => {
        setAddSource(false);
        await studio.reload(true);
        if (msg) say(msg);
      }
    }),
    (0, import_jsx_runtime.jsx)(NewNotebookDialog, {
      open: newNb,
      onClose: () => setNewNb(false),
      onDone: async (id) => {
        setNewNb(false);
        if (id) {
          setNb(id);
          setPicked(null);
        }
      }
    })
  );
}
function Rail({ data, nb, setNb, q, setQ, filter, setFilter, onNewNotebook, onAddSource, loading, error, reload }) {
  const notebooks = data && data.notebooks || [];
  const notebook = data && data.notebook;
  const sources = notebook && notebook.sources || [];
  const labels = notebook && notebook.labels || [];
  const shown = (0, import_react.useMemo)(() => {
    const needle = q.trim().toLowerCase();
    return sources.filter((s) => {
      if (filter !== "all" && !(s.labels || []).some((l) => l.toLowerCase().includes(filter))) return false;
      if (!needle) return true;
      return (s.title + " " + (s.origin || "") + " " + (s.labels || []).join(" ")).toLowerCase().includes(needle);
    });
  }, [sources, q, filter]);
  return el(
    "aside",
    { className: "nb-col nb-rail", "aria-label": "Notebooks and sources" },
    el(
      "div",
      { className: "nb-pane-head" },
      el("span", { className: "nb-meta", children: `Notebooks \xB7 ${notebooks.length}` }),
      (0, import_jsx_runtime.jsx)(IconBtn, { icon: "plus", label: "New notebook", onClick: onNewNotebook })
    ),
    el(
      "div",
      { className: "nb-scroll", style: { flex: "0 1 auto", maxHeight: "38%" } },
      el(
        "div",
        { className: "nb-pad", style: { paddingTop: "8px" } },
        loading && !notebooks.length ? el("div", { className: "nb-hint", style: { padding: "8px" }, children: "reading notebooks\u2026" }) : notebooks.length === 0 ? el(
          "div",
          { className: "nb-hint", style: { padding: "8px", lineHeight: 1.5 } },
          "No notebooks yet. Create one, then add sources \u2014 every answer and artifact is derived from them."
        ) : notebooks.map((item) => el("button", {
          type: "button",
          className: "nb-nbrow",
          "aria-current": item.id === nb ? "true" : "false",
          onClick: () => setNb(item.id),
          title: item.description || item.title,
          children: [
            el("span", { className: "nb-avatar", children: (item.title || "?").slice(0, 2).toUpperCase() }),
            el(
              "span",
              { style: { minWidth: 0, flex: 1 } },
              el("span", { className: "nb-nbtitle", children: item.title }),
              el(
                "span",
                { className: "nb-nbsub" },
                `${item.sources} source${item.sources === 1 ? "" : "s"} \xB7 ${item.artifacts} artifact${item.artifacts === 1 ? "" : "s"}`
              )
            )
          ]
        }, item.id))
      )
    ),
    el(
      "div",
      { className: "nb-pane-head", style: { borderTop: `1px solid ${T.lineSoft}` } },
      el("span", { className: "nb-meta", children: `Sources \xB7 ${sources.length}` }),
      (0, import_jsx_runtime.jsx)(IconBtn, { icon: "refresh", label: "Refresh sources", onClick: () => reload(true) })
    ),
    el(
      "div",
      { className: "nb-pad", style: { paddingBottom: "6px" } },
      (0, import_jsx_runtime.jsx)(SearchField, { value: q, onChange: setQ, placeholder: "Search sources", label: "Search sources" })
    ),
    el(
      "div",
      {
        className: "nb-pad",
        style: { display: "flex", gap: "6px", flexWrap: "wrap", paddingTop: 0, paddingBottom: "10px" },
        role: "group",
        "aria-label": "Filter sources by label"
      },
      labels.slice(0, 6).map((l) => (0, import_jsx_runtime.jsx)(Chip, {
        key: l.label,
        tone: filter === l.label.toLowerCase() ? "accent" : void 0,
        pressed: filter === l.label.toLowerCase(),
        onClick: () => setFilter(filter === l.label.toLowerCase() ? "all" : l.label.toLowerCase()),
        title: `${l.count} source${l.count === 1 ? "" : "s"} labelled ${l.label}`,
        children: `${l.label} ${l.count}`
      }))
    ),
    el(
      "div",
      { className: "nb-scroll", "aria-label": "Source list" },
      el(
        "div",
        { className: "nb-pad", style: { paddingTop: 0, display: "flex", flexDirection: "column", gap: "2px" } },
        error ? el("div", { className: "nb-hint", style: { padding: "10px", color: T.danger }, children: error }) : shown.length === 0 ? el(
          "div",
          { className: "nb-void", style: { height: "auto", padding: "24px 8px" } },
          el(
            "div",
            null,
            el("h3", { style: { fontSize: "15px" }, children: sources.length ? "Nothing matches" : "No sources yet" }),
            el("p", { style: { fontSize: "13.5px" }, children: sources.length ? "Clear the filter or the search to see every source." : "Add a file, a URL or pasted text and it becomes citable." })
          )
        ) : shown.map((s) => el("button", {
          type: "button",
          className: "nb-src",
          "data-on": pickedCite === s.n ? "true" : "false",
          onClick: () => setPickedCite(s.n),
          title: s.summary || s.origin || s.title,
          children: [
            el("span", { className: "nb-cite", children: `S${s.n}` }),
            el(
              "span",
              { style: { minWidth: 0, flex: 1 } },
              el("span", { className: "nb-src-title", children: s.title }),
              el(
                "span",
                { className: "nb-src-meta" },
                el("span", { className: "nb-chip", children: `${s.kind} \xB7 ${nfmt(s.chars)}` }),
                (s.labels || []).slice(0, 2).map((l) => el("span", { className: "nb-chip", children: l }, l))
              )
            )
          ]
        }, s.id))
      )
    ),
    el(
      "div",
      { style: { borderTop: `1px solid ${T.lineSoft}`, padding: "10px" } },
      (0, import_jsx_runtime.jsx)(Btn, { icon: "plus", variant: "ghost", onClick: onAddSource, disabled: !notebook, children: "Add source" })
    )
  );
}
var pickedCite = 0;
var setPickedCite = (n) => {
  pickedCite = n;
};
function Main({
  notebook,
  kinds,
  tab,
  setTab,
  picked,
  setPicked,
  busy,
  generate,
  onAsk,
  askOpen,
  onSay,
  reload,
  modelReady,
  error,
  loading,
  onAddSource
}) {
  const [peek, setPeek] = (0, import_react.useState)(null);
  const sources = notebook && notebook.sources || [];
  if (loading && !notebook) {
    return el(
      "main",
      { className: "nb-col" },
      el(
        "div",
        { className: "nb-void" },
        el(
          "div",
          null,
          el("h3", { children: "Opening the notebook" }),
          el("p", { children: "Reading sources and artifacts from the plugin store\u2026" })
        )
      )
    );
  }
  if (error && !notebook) {
    return el(
      "main",
      { className: "nb-col" },
      el(
        "div",
        { className: "nb-void" },
        el(
          "div",
          null,
          el("h3", { children: "The notebook backend did not answer" }),
          el("p", { children: error }),
          el(
            "div",
            { style: { marginTop: "14px" } },
            (0, import_jsx_runtime.jsx)(Btn, { icon: "refresh", onClick: () => reload(false), children: "Try again" })
          )
        )
      )
    );
  }
  if (!notebook) {
    return el(
      "main",
      { className: "nb-col" },
      el(
        "div",
        { className: "nb-void" },
        el(
          "div",
          null,
          el("h3", { children: "Start a notebook" }),
          el("p", { children: "A notebook is a set of sources. Everything the studio makes \u2014 answers, a podcast, a mind map, slides \u2014 is derived from those sources and cites them by number." }),
          el(
            "div",
            { style: { marginTop: "16px" } },
            (0, import_jsx_runtime.jsx)(Btn, { variant: "primary", icon: "plus", onClick: onAddSource, children: "Add your first source" })
          )
        )
      )
    );
  }
  const viewName = picked ? picked.label : "";
  const art = picked;
  const stats = notebook.stats || {};
  return el(
    "main",
    { className: "nb-col" },
    el(
      "div",
      { className: "nb-main-head" },
      el("h1", { className: "nb-h1", children: notebook.title }),
      notebook.description ? el("p", { className: "nb-sub", children: notebook.description }) : el("p", { className: "nb-sub", children: "Answers are generated only from the sources on the left; each citation opens the source it came from." }),
      el(
        "div",
        { className: "nb-strip", role: "group", "aria-label": "Notebook totals" },
        el("div", { className: "nb-cell" }, el("b", { children: stats.sources || 0 }), el("span", { children: "sources" })),
        el("div", { className: "nb-cell" }, el("b", { children: nfmt(stats.chars) }), el("span", { children: "chars indexed" })),
        el("div", { className: "nb-cell" }, el("b", { children: stats.labels || 0 }), el("span", { children: "labels" })),
        el("div", { className: "nb-cell" }, el("b", { children: stats.artifacts || 0 }), el("span", { children: "artifacts" })),
        el(
          "div",
          { className: "nb-cell" },
          el("b", { style: { color: modelReady ? T.ok : T.warn }, children: modelReady ? "ready" : "offline" }),
          el("span", { children: "model" })
        )
      ),
      el(
        "div",
        { className: "nb-tabs", role: "tablist", "aria-label": "Notebook views" },
        el("button", {
          type: "button",
          role: "tab",
          className: "nb-tab",
          "aria-selected": tab === "chat",
          onClick: () => setTab("chat"),
          children: [(0, import_jsx_runtime.jsx)(Glyph, { name: "faq", size: 15 }), "Chat"]
        }),
        el("button", {
          type: "button",
          role: "tab",
          className: "nb-tab",
          "aria-selected": tab === "view",
          onClick: () => setTab("view"),
          disabled: !picked,
          children: [
            (0, import_jsx_runtime.jsx)(Glyph, { name: picked ? KIND_ICON[picked.kind] || "doc" : "doc", size: 15 }),
            viewName || "Viewer"
          ]
        }),
        peek ? el("button", {
          type: "button",
          role: "tab",
          className: "nb-tab",
          "aria-selected": tab === "peek",
          onClick: () => setTab("peek"),
          children: [(0, import_jsx_runtime.jsx)(Glyph, { name: "book", size: 15 }), `S${peek.n} \xB7 ${peek.title}`]
        }) : null
      )
    ),
    tab === "peek" && peek ? (0, import_jsx_runtime.jsx)(SourcePeek, { source: peek, notebook, onClose: () => {
      setPeek(null);
      setTab("chat");
    } }) : tab === "view" && picked ? (0, import_jsx_runtime.jsx)(Viewer, { artifact: picked, notebook, onSearch: () => {
    }, onCite: (n) => {
      const src = sources.find((s) => s.n === n);
      if (src) {
        setPeek(src);
        setTab("peek");
      }
    } }) : (0, import_jsx_runtime.jsx)(Chat, {
      notebook,
      askOpen,
      onSay,
      modelReady,
      onCite: (n) => {
        const src = sources.find((s) => s.n === n);
        if (src) {
          setPeek(src);
          setTab("peek");
        }
      },
      onOpenSource: (s) => {
        setPeek(s);
        setTab("peek");
      }
    })
  );
}
var SUGGEST = [
  "Summarise the strongest claim in the sources, with citations.",
  "Where do the sources disagree?",
  "What is missing that I should go and find?"
];
function Chat({ notebook, askOpen, onSay, modelReady, onCite, onOpenSource }) {
  const [msgs, setMsgs] = (0, import_react.useState)(() => (notebook.thread || []).map((m, i) => ({ ...m, k: `t${i}` })));
  const [text, setText] = (0, import_react.useState)("");
  const [pending, setPending] = (0, import_react.useState)(null);
  const threadRef = (0, import_react.useRef)(null);
  const boxRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    const stored = (notebook.thread || []).map((m, i) => ({ ...m, k: `t${i}` }));
    setMsgs(stored);
  }, [notebook.id, notebook.thread && notebook.thread.length]);
  (0, import_react.useEffect)(() => {
    if (askOpen) {
      const n = boxRef.current;
      if (n) n.focus();
    }
  }, [askOpen]);
  (0, import_react.useEffect)(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [msgs.length, pending && pending.since]);
  const send = async (question) => {
    const q = (question || text).trim();
    if (!q || pending) return;
    setText("");
    setMsgs((m) => [...m, { role: "user", content: q, k: `u${Date.now()}` }]);
    const started = Date.now();
    setPending({ since: started, q });
    const tick = setInterval(() => setPending((p) => p ? { ...p, now: Date.now() } : p), 500);
    try {
      const out = await api("/ask", {
        method: "POST",
        body: { notebook: notebook.id, question: q, thread: "default" },
        timeoutMs: 18e4
      });
      setMsgs((m) => [...m, {
        role: "assistant",
        content: out.answer,
        k: `a${Date.now()}`,
        citations: out.citations || [],
        seconds: out.seconds,
        meta: `${out.chunks_used || 0} of ${out.total_chunks || 0} passages`
      }]);
    } catch (e) {
      setMsgs((m) => [...m, {
        role: "assistant",
        content: `**That question did not get an answer.**

${e.message || e}`,
        k: `e${Date.now()}`,
        error: true
      }]);
      if (onSay) onSay(e.message || "ask failed");
    } finally {
      clearInterval(tick);
      setPending(null);
    }
  };
  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };
  const elapsed = pending ? Math.round(((pending.now || Date.now()) - pending.since) / 1e3) : 0;
  return el(
    "div",
    { className: "nb-chat" },
    el(
      "div",
      { className: "nb-thread", ref: threadRef, role: "log", "aria-live": "polite", "aria-label": "Conversation" },
      msgs.length === 0 && !pending ? el(
        "div",
        { style: { margin: "auto", textAlign: "center", maxWidth: "54ch" } },
        el(
          "div",
          { style: { display: "grid", placeItems: "center", gap: "10px" } },
          el(
            "span",
            { className: "nb-mark", style: { width: "40px", height: "40px", borderRadius: "12px" } },
            (0, import_jsx_runtime.jsx)(Glyph, { name: "sparkle", size: 19 })
          ),
          el("div", { style: { fontSize: "20px", fontWeight: 650, letterSpacing: "-.015em" }, children: "Ask the sources" }),
          el("div", {
            style: { color: T.text3, fontSize: "14.5px", lineHeight: 1.6 },
            children: "Every answer is built from this notebook and cites the source it came from. If the sources do not cover it, the answer says so."
          })
        )
      ) : null,
      msgs.map((m) => (0, import_jsx_runtime.jsx)(Msg, { msg: m, onCite, onOpenSource }, m.k)),
      pending ? el(
        "div",
        { className: "nb-msg", "data-role": "assistant" },
        el("span", { className: "nb-avatar", children: "HK" }),
        el(
          "div",
          { className: "nb-msg-body" },
          el("div", { className: "nb-who", children: "Reading sources" }),
          el(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px", color: T.text3, fontSize: "14.5px" } },
            el("span", { className: "nb-dot", style: { background: T.accent, boxShadow: `0 0 8px ${T.accent}` } }),
            `retrieving passages \xB7 ${elapsed}s`
          )
        )
      ) : null
    ),
    el(
      "div",
      { className: "nb-composer" },
      msgs.length === 0 && !pending ? el(
        "div",
        { style: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" } },
        SUGGEST.map((s) => (0, import_jsx_runtime.jsx)(Chip, {
          key: s,
          onClick: () => {
            setText(s);
            const n = boxRef.current;
            if (n) n.focus();
          },
          title: "Use this question",
          children: s
        }))
      ) : null,
      el(
        "div",
        { className: "nb-askbox" },
        el("textarea", {
          ref: boxRef,
          value: text,
          onChange: (e) => setText(e.target.value),
          onKeyDown: onKey,
          placeholder: "Ask anything \u2014 the answer cites the source it came from",
          "aria-label": "Ask the notebook",
          rows: 2
        }),
        el(
          "div",
          { className: "nb-askfoot" },
          el(
            "span",
            { className: "nb-hint" },
            modelReady ? "\u23CE send \xB7 \u21E7\u23CE newline" : "model offline \u2014 enable the plugin and restart the gateway"
          ),
          el("span", { style: { flex: 1 } }),
          (0, import_jsx_runtime.jsx)(Btn, {
            variant: "primary",
            icon: "send",
            onClick: () => send(),
            disabled: !text.trim() || !!pending,
            children: pending ? "Asking\u2026" : "Send"
          })
        )
      )
    )
  );
}
function Msg({ msg, onCite }) {
  const isUser = msg.role === "user";
  return el(
    "div",
    { className: "nb-msg", "data-role": isUser ? "user" : "assistant" },
    isUser ? null : el("span", { className: "nb-avatar", children: "HK" }),
    el(
      "div",
      { className: "nb-msg-body" },
      isUser ? el("div", { className: "nb-bubble", children: msg.content }) : el(
        "div",
        null,
        el(
          "div",
          { className: "nb-who" },
          "Hermes Notebook",
          msg.meta ? el("span", { style: { marginLeft: "8px", color: T.text4, fontWeight: 500, textTransform: "none", letterSpacing: 0 }, children: `\xB7 ${msg.meta}` }) : null
        ),
        el(
          "div",
          { className: "nb-bubble" },
          (0, import_jsx_runtime.jsx)(Markdown, { text: msg.content, onCite })
        ),
        (msg.citations || []).length ? el(
          "div",
          { style: { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }, role: "list", "aria-label": "Citations" },
          msg.citations.map((c) => (0, import_jsx_runtime.jsx)(Chip, {
            tone: "accent",
            onClick: () => onCite && onCite(c.n),
            title: c.origin || c.title,
            children: `S${c.n} \xB7 ${c.title}`
          }, `${c.n}-${c.title}`))
        ) : null
      )
    )
  );
}
function SourcePeek({ source, notebook, onClose }) {
  const [text, setText] = (0, import_react.useState)("");
  const [err, setErr] = (0, import_react.useState)("");
  (0, import_react.useEffect)(() => {
    let live = true;
    setText("");
    api(`/source_text?${qs({ notebook: notebook.id, id: source.id, chars: 24e3 })}`).then((out) => {
      if (live) setText(out.text || "");
    }).catch((e) => {
      if (live) setErr(e.message || String(e));
    });
    return () => {
      live = false;
    };
  }, [source.id, notebook.id]);
  return el(
    "div",
    { className: "nb-view" },
    el(
      "div",
      { className: "nb-view-head" },
      el("span", { className: "nb-chip", "data-tone": "accent", children: `S${source.n}` }),
      el(
        "div",
        { style: { flex: 1, minWidth: 0 } },
        el("div", { className: "nb-view-title", children: source.title }),
        el("div", {
          style: { fontSize: "12.5px", color: T.text4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
          children: `${source.kind} \xB7 ${nfmt(source.chars)} chars \xB7 ${source.origin || "stored text"}`
        })
      ),
      source.origin && source.origin.startsWith("http") ? (0, import_jsx_runtime.jsx)(IconBtn, { icon: "external", label: "Open the original", onClick: () => host.openLink ? host.openLink(source.origin) : window.open(source.origin, "_blank") }) : null,
      (0, import_jsx_runtime.jsx)(IconBtn, { icon: "close", label: "Close source", onClick: onClose })
    ),
    el(
      "div",
      { className: "nb-view-body" },
      err ? el("div", { style: { color: T.danger }, children: err }) : text ? el("pre", {
        className: "nb-mono",
        style: { whiteSpace: "pre-wrap", fontSize: "14.5px", lineHeight: 1.7, color: T.text2, margin: 0 },
        children: text
      }) : el("div", { className: "nb-hint", children: "reading\u2026" })
    )
  );
}
function StudioPanel({ kinds, notebook, busy, generate, filter, setFilter, picked, onOpen }) {
  const ready = latestByKind(notebook ? notebook.artifacts : []);
  const shown = kinds.filter((k) => filter === "all" || k.group === filter);
  const scrollRef = (0, import_react.useRef)(null);
  const [canScroll, setCanScroll] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    const node = scrollRef.current;
    if (!node) return void 0;
    const check = () => setCanScroll(node.scrollHeight > node.clientHeight + 2);
    check();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    if (ro) ro.observe(node);
    node.addEventListener("scroll", check, { passive: true });
    return () => {
      if (ro) ro.disconnect();
      node.removeEventListener("scroll", check);
    };
  }, [shown.length]);
  return el(
    "aside",
    { className: "nb-col nb-studio", "aria-label": "Studio outputs" },
    el(
      "div",
      { className: "nb-pane-head" },
      el("span", { className: "nb-meta", children: "Studio" }),
      el("span", {
        className: "nb-chip",
        "data-tone": Object.keys(ready).length ? "ok" : void 0,
        children: `${Object.keys(ready).length} of ${kinds.length} ready`
      })
    ),
    el(
      "div",
      { className: "nb-pad", style: { paddingBottom: 0 } },
      (0, import_jsx_runtime.jsx)(Seg, {
        label: "Filter studio outputs",
        value: filter,
        onChange: setFilter,
        fill: true,
        options: FILTERS.map((f) => ({
          id: f.id,
          label: f.id === "all" ? "All" : f.label,
          title: `${f.label} outputs`
        }))
      })
    ),
    el(
      "div",
      { className: "nb-scroll", ref: scrollRef, "data-scrollable": canScroll ? "true" : "false" },
      el(
        "div",
        { className: "nb-grid" },
        shown.map((k) => (0, import_jsx_runtime.jsx)(StudioCard, {
          key: k.id,
          kind: k,
          art: ready[k.id],
          started: busy[k.id],
          onOpen: () => {
            const a = ready[k.id];
            if (a) onOpen(a);
            else generate(k.id);
          },
          onRegenerate: () => generate(k.id)
        }))
      )
    ),
    canScroll ? (0, import_jsx_runtime.jsx)("div", { className: "nb-fade", "aria-hidden": "true" }) : null
  );
}
function StudioCard({ kind, art, started, onOpen, onRegenerate }) {
  const [, force] = (0, import_react.useState)(0);
  (0, import_react.useEffect)(() => {
    if (!started) return void 0;
    const t = setInterval(() => force((n) => n + 1), 1e3);
    return () => clearInterval(t);
  }, [started]);
  const secs = started ? Math.max(0, Math.round((Date.now() - started) / 1e3)) : 0;
  const state = started ? `writing \xB7 ${secs}s` : art ? `ready \xB7 ${ago(art.modified)}` : `Generate`;
  return el("button", {
    type: "button",
    className: "nb-card",
    "data-ready": art ? "true" : "false",
    "data-busy": started ? "true" : "false",
    onClick: started ? void 0 : onOpen,
    "aria-label": `${kind.label} \u2014 ${state}. ${art ? "Open it" : "Generate it"}`,
    title: art ? `${kind.label} \xB7 ${art.primary}` : `Generate ${kind.label}`,
    children: [
      el(
        "div",
        { className: "nb-card-top" },
        el("span", { className: "nb-card-ic" }, (0, import_jsx_runtime.jsx)(Glyph, { name: KIND_ICON[kind.id] || "doc", size: 14 })),
        el("span", { className: "nb-card-name", children: kind.label })
      ),
      el("span", { className: "nb-card-blurb", children: kind.blurb }),
      started ? el(
        "div",
        { className: "nb-bar-track" },
        el("div", {
          className: "nb-bar-fill",
          style: { width: `${Math.min(96, 12 + secs * 2.2)}%`, opacity: 0.85 }
        })
      ) : null,
      el(
        "div",
        { className: "nb-card-state" },
        el("span", {
          className: "nb-dot",
          style: {
            background: started ? T.accent : art ? T.ok : T.text4,
            boxShadow: started ? `0 0 8px ${T.accent}` : art ? `0 0 6px ${T.ok}` : "none"
          }
        }),
        state
      )
    ]
  });
}
function StatusBar({ mode, notebook, data, note, opsStats }) {
  const ready = data && data.model_ready;
  const ops = mode === "ops";
  return el(
    "footer",
    { className: "nb-status", role: "contentinfo" },
    ops ? el(
      "span",
      null,
      (0, import_jsx_runtime.jsx)("span", {
        className: "nb-sdot",
        style: { background: opsStats && opsStats.down ? T.warn : T.ok }
      }),
      opsStats ? `${opsStats.hosts} hosts \xB7 ${opsStats.patched} patched \xB7 ${opsStats.exposed} fix available \xB7 ${opsStats.down} unreachable` : "measuring the fleet\u2026"
    ) : el(
      "span",
      null,
      (0, import_jsx_runtime.jsx)("span", { className: "nb-sdot", style: { background: ready ? T.ok : T.warn } }),
      ready ? "grounded \xB7 model ready" : "model offline \u2014 enable the plugin"
    ),
    !ops && notebook ? el(
      "span",
      null,
      (0, import_jsx_runtime.jsx)("b", { children: notebook.stats.sources }),
      " sources \xB7 ",
      (0, import_jsx_runtime.jsx)("b", { children: nfmt(notebook.stats.chars) }),
      " chars \xB7 ",
      (0, import_jsx_runtime.jsx)("b", { children: notebook.stats.labels }),
      " labels"
    ) : null,
    !ops && notebook && notebook.stats.unlabeled ? (0, import_jsx_runtime.jsx)("span", {
      style: { color: T.warn },
      children: `${notebook.stats.unlabeled} source${notebook.stats.unlabeled === 1 ? "" : "s"} unlabeled \u2014 press \u201Clabel\u201D on the rail`
    }) : null,
    note ? (0, import_jsx_runtime.jsx)("span", { style: { color: T.accent }, children: note }) : null,
    el("span", { style: { flex: 1 } }),
    (0, import_jsx_runtime.jsx)("span", {
      className: "nb-mono",
      style: { fontSize: "11.5px" },
      children: ops ? "ssh \xB7 audited transport" : notebook ? notebook.id : "no notebook"
    }),
    data && !ops ? (0, import_jsx_runtime.jsx)("span", {
      className: "nb-mono",
      style: { fontSize: "11.5px" },
      children: `synced ${clock(data.generated_at)}`
    }) : null
  );
}
var SOURCE_MODES = [
  { id: "url", label: "Web URL", icon: "link" },
  { id: "path", label: "File path", icon: "file" },
  { id: "text", label: "Paste text", icon: "note" }
];
function AddSourceDialog({ open, onClose, notebook, onDone }) {
  const [mode, setMode] = (0, import_react.useState)("url");
  const [value, setValue] = (0, import_react.useState)("");
  const [title, setTitle] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [err, setErr] = (0, import_react.useState)("");
  const submit = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const body = { notebook: notebook.id, [mode]: value.trim() };
      if (title.trim()) body.title = title.trim();
      const out = await api("/source", { method: "POST", body, timeoutMs: 12e4 });
      setValue("");
      setTitle("");
      await onDone(out.source && out.source.title ? `added ${out.source.title}` : "source added");
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  return (0, import_jsx_runtime.jsx)(Dialog, {
    open,
    onClose,
    title: "Add a source",
    children: el(
      "div",
      null,
      el("p", {
        style: { margin: "0 0 14px", color: T.text3, fontSize: "14.5px", lineHeight: 1.55 },
        children: "A source is anything the notebook can cite: a URL, a file on this machine, or text you paste. It is extracted, labelled and indexed on the way in."
      }),
      (0, import_jsx_runtime.jsx)(Seg, { label: "Source kind", value: mode, onChange: setMode, options: SOURCE_MODES }),
      el(
        "div",
        { style: { marginTop: "14px", display: "grid", gap: "10px" } },
        mode === "text" ? el("textarea", {
          className: "nb-mono",
          value,
          onChange: (e) => setValue(e.target.value),
          autoFocus: true,
          placeholder: "Paste notes, a transcript, a spec\u2026",
          "aria-label": "Pasted source text",
          style: {
            minHeight: "160px",
            borderRadius: "10px",
            border: `1px solid ${T.line}`,
            background: T.cardDeep,
            color: T.text,
            padding: "12px",
            fontSize: "14px",
            lineHeight: 1.55,
            resize: "vertical",
            outline: "none"
          }
        }) : el(
          "div",
          { className: "nb-field", style: { height: "40px" } },
          (0, import_jsx_runtime.jsx)(Glyph, { name: mode === "url" ? "link" : "file", size: 14 }),
          el("input", {
            value,
            onChange: (e) => setValue(e.target.value),
            autoFocus: true,
            onKeyDown: (e) => {
              if (e.key === "Enter") submit();
            },
            placeholder: mode === "url" ? "https://\u2026 or a YouTube link" : "/home/you/doc.pdf",
            "aria-label": mode === "url" ? "Source URL" : "File path"
          })
        ),
        el(
          "div",
          { className: "nb-field", style: { height: "40px" } },
          (0, import_jsx_runtime.jsx)(Glyph, { name: "note", size: 14 }),
          el("input", {
            value: title,
            onChange: (e) => setTitle(e.target.value),
            placeholder: "Title (optional \u2014 derived when left blank)",
            "aria-label": "Source title"
          })
        )
      ),
      err ? el("div", { style: { marginTop: "12px", color: T.danger, fontSize: "14px" }, children: err }) : null,
      el(
        "div",
        { style: { display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" } },
        (0, import_jsx_runtime.jsx)(Btn, { onClick: onClose, children: "Cancel" }),
        (0, import_jsx_runtime.jsx)(Btn, {
          variant: "primary",
          icon: "plus",
          onClick: submit,
          disabled: busy || !value.trim(),
          children: busy ? "Ingesting\u2026" : "Add source"
        })
      )
    )
  });
}
function NewNotebookDialog({ open, onClose, onDone }) {
  const [title, setTitle] = (0, import_react.useState)("");
  const [desc, setDesc] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [err, setErr] = (0, import_react.useState)("");
  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const out = await api("/notebook", { method: "POST", body: { title: title.trim(), description: desc.trim() } });
      setTitle("");
      setDesc("");
      await onDone(out.id);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  return (0, import_jsx_runtime.jsx)(Dialog, {
    open,
    onClose,
    title: "New notebook",
    children: el(
      "div",
      null,
      el(
        "div",
        { style: { display: "grid", gap: "10px" } },
        el(
          "div",
          { className: "nb-field", style: { height: "40px" } },
          (0, import_jsx_runtime.jsx)(Glyph, { name: "book", size: 14 }),
          el("input", {
            value: title,
            onChange: (e) => setTitle(e.target.value),
            autoFocus: true,
            placeholder: "What is this notebook about?",
            "aria-label": "Notebook title",
            onKeyDown: (e) => {
              if (e.key === "Enter") submit();
            }
          })
        ),
        el("textarea", {
          value: desc,
          onChange: (e) => setDesc(e.target.value),
          placeholder: "One line of context (optional) \u2014 it steers the labels and the studio copy.",
          "aria-label": "Notebook description",
          style: {
            minHeight: "80px",
            borderRadius: "10px",
            border: `1px solid ${T.line}`,
            background: T.cardDeep,
            color: T.text,
            padding: "12px",
            fontSize: "14.5px",
            lineHeight: 1.5,
            resize: "vertical",
            outline: "none"
          }
        })
      ),
      err ? el("div", { style: { marginTop: "12px", color: T.danger, fontSize: "14px" }, children: err }) : null,
      el(
        "div",
        { style: { display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" } },
        (0, import_jsx_runtime.jsx)(Btn, { onClick: onClose, children: "Cancel" }),
        (0, import_jsx_runtime.jsx)(Btn, {
          variant: "primary",
          icon: "check",
          onClick: submit,
          disabled: busy || !title.trim(),
          children: busy ? "Creating\u2026" : "Create notebook"
        })
      )
    )
  });
}
function useFile(notebookId, name) {
  const [st, setSt] = (0, import_react.useState)({ loading: !!name, text: "", json: null, url: "", mime: "", error: "" });
  (0, import_react.useEffect)(() => {
    if (!name) {
      setSt({ loading: false, text: "", json: null, url: "", mime: "", error: "" });
      return void 0;
    }
    let live = true;
    let made = "";
    setSt({ loading: true, text: "", json: null, url: "", mime: "", error: "" });
    api(`/artifact?${qs({ notebook: notebookId, name, b64: 1 })}`, { timeoutMs: 9e4 }).then((out) => {
      if (!live) return;
      const raw = atob(out.b64 || "");
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
      const isText = (out.mime || "").startsWith("text/") || /^(md|txt|json|csv)$/.test(out.ext);
      if (isText) {
        const text = new TextDecoder().decode(bytes);
        let json = null;
        if (out.ext === "json") {
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
        }
        setSt({ loading: false, text, json, url: "", mime: out.mime, error: "" });
      } else {
        made = URL.createObjectURL(new Blob([bytes], { type: out.mime || "application/octet-stream" }));
        setSt({ loading: false, text: "", json: null, url: made, mime: out.mime, bytes: out.bytes, error: "" });
      }
    }).catch((e) => {
      if (live) setSt({ loading: false, text: "", json: null, url: "", mime: "", error: e.message || String(e) });
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [notebookId, name]);
  return st;
}
function Viewer({ artifact, notebook, onCite }) {
  const files = artifact.files || [];
  const jsonName = (files.find((f) => f.ext === "json") || {}).name || "";
  const txtName = (files.find((f) => f.ext === "txt") || {}).name || "";
  const primary = useFile(notebook.id, artifact.primary);
  const asJson = useFile(notebook.id, jsonName);
  const asTxt = useFile(notebook.id, txtName);
  const [regen, setRegen] = (0, import_react.useState)(false);
  const downloading = (url, name) => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = name || "artifact";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  let body;
  if (primary.error) body = el("div", { className: "nb-view-body", style: { color: T.danger }, children: primary.error });
  else if (primary.loading) body = el("div", { className: "nb-view-body" }, el("div", { className: "nb-hint", children: "loading artifact\u2026" }));
  else if (artifact.kind === "video_overview") {
    body = (0, import_jsx_runtime.jsx)(VideoView, { src: primary.url, json: asJson.json, text: asTxt.text });
  } else if (artifact.kind === "audio_overview") {
    body = (0, import_jsx_runtime.jsx)(AudioView, { src: primary.url, json: asJson.json, text: asTxt.text });
  } else if (artifact.kind === "mind_map") {
    body = (0, import_jsx_runtime.jsx)(MindMapView, { data: asJson.json, text: primary.text });
  } else if (artifact.kind === "flashcards") {
    body = (0, import_jsx_runtime.jsx)(FlashcardsView, { data: asJson.json, text: primary.text, key: artifact.key });
  } else if (artifact.kind === "quiz") {
    body = (0, import_jsx_runtime.jsx)(QuizView, { data: asJson.json, text: primary.text });
  } else if (artifact.kind === "slides") {
    body = (0, import_jsx_runtime.jsx)(SlidesView, { data: asJson.json, text: primary.text, htmlUrl: primary.url && artifact.ext === "html" ? primary.url : "" });
  } else if (artifact.kind === "infographic") {
    body = (0, import_jsx_runtime.jsx)(InfographicView, { src: primary.url, data: asJson.json });
  } else if (artifact.kind === "timeline") {
    body = (0, import_jsx_runtime.jsx)(TimelineView, { text: primary.text, onCite });
  } else {
    body = el(
      "div",
      { className: "nb-view-body" },
      el("div", { className: "nb-doc" }, (0, import_jsx_runtime.jsx)(Markdown, { text: primary.text, onCite }))
    );
  }
  return el(
    "div",
    { className: "nb-view" },
    el(
      "div",
      { className: "nb-view-head" },
      el("span", { className: "nb-chip", "data-tone": "accent", children: artifact.label }),
      el(
        "div",
        { style: { flex: 1, minWidth: 0 } },
        el("div", { className: "nb-view-title", children: asJson.json && (asJson.json.title || asJson.json.topic) || prettyFile(artifact.primary) }),
        el("div", {
          style: { fontSize: "12.5px", color: T.text4 },
          children: `${artifact.files.length} file${artifact.files.length === 1 ? "" : "s"} \xB7 ${Math.max(1, Math.round(artifact.bytes / 1024))} KB \xB7 ${ago(artifact.modified)}`
        })
      ),
      (0, import_jsx_runtime.jsx)(IconBtn, {
        icon: "download",
        label: `Download ${artifact.label}`,
        onClick: () => downloading(primary.url, artifact.primary)
      }),
      (0, import_jsx_runtime.jsx)(IconBtn, {
        icon: "refresh",
        label: `Regenerate ${artifact.label}`,
        active: regen,
        onClick: () => setRegen(true)
      })
    ),
    body
  );
}
var prettyFile = (name) => {
  const stem = String(name || "").replace(/\.[a-z0-9]+$/i, "");
  return stem.replace(/^\d{8}-\d{6}-/, "").replace(/_/g, " ");
};
function VideoView({ src, json, text }) {
  const segs = json && (json.segments || json.beats || json.scenes) || [];
  return el(
    "div",
    { className: "nb-view-body" },
    el(
      "div",
      { className: "nb-stage" },
      el(
        "div",
        { className: "nb-screen" },
        src ? el("video", { src, controls: true, playsInline: true, preload: "metadata" }) : el("div", { className: "nb-hint", children: "the video file did not load" })
      ),
      el(
        "div",
        { style: { display: "flex", gap: "8px", alignItems: "center" } },
        el("span", { className: "nb-chip", "data-tone": "ok", children: "mp4 \xB7 h264" }),
        json && json.title ? el("span", { style: { fontSize: "15px", fontWeight: 600 }, children: json.title }) : null,
        el("span", { style: { flex: 1 } }),
        el("span", { className: "nb-hint", children: segs.length ? `${segs.length} beats` : "narrated slideshow" })
      ),
      segs.length ? el(
        "ol",
        { className: "nb-timeline", "aria-label": "Video chapters" },
        segs.map((s, i) => el(
          "li",
          { className: "nb-tl", key: `s${i}` },
          el("span", { className: "nb-tl-when", children: `BEAT ${i + 1}` }),
          el(
            "span",
            { className: "nb-tl-what" },
            el("b", { children: s.headline || s.title || s.label || "" }),
            s.sub || s.subline ? el("span", { style: { color: T.text3 }, children: ` \u2014 ${s.sub || s.subline}` }) : null,
            s.text || s.narration ? el("span", { style: { display: "block", color: T.text3, marginTop: "3px", fontSize: "14px" }, children: s.text || s.narration }) : null
          )
        ))
      ) : text ? el("pre", { className: "nb-mono", style: { whiteSpace: "pre-wrap", color: T.text3, fontSize: "13.5px" }, children: text }) : null
    )
  );
}
function AudioView({ src, json, text }) {
  const audioRef = (0, import_react.useRef)(null);
  const [playing, setPlaying] = (0, import_react.useState)(false);
  const [t, setT] = (0, import_react.useState)(0);
  const [dur, setDur] = (0, import_react.useState)(0);
  const lines = (0, import_react.useMemo)(() => {
    const out = [];
    for (const raw of String(text || "").split("\n")) {
      let l = raw.trim();
      if (!l) continue;
      if (/^#\s/.test(l)) {
        out.push({ who: "", text: l.replace(/^#\s*/, ""), head: true });
        continue;
      }
      if (/^[_*]{1,2}[^_*].*[_*]{1,2}$/.test(l) && l.length < 160) {
        out.push({ who: "", text: l.replace(/^[_*]+|[_*]+$/g, ""), meta: true });
        continue;
      }
      l = l.replace(/\*\*/g, "");
      const m = /^\[?\s*(host\s*[ab]|speaker\s*\d+)\s*\]?\s*[:—-]\s*(.*)$/i.exec(l);
      if (m) {
        const who = /b|2/i.test(m[1]) ? "B" : "A";
        out.push({ who, text: m[2] });
        continue;
      }
      if (out.length) out.push({ who: out[out.length - 1].who, text: l });
    }
    return out;
  }, [text]);
  const bars = (0, import_react.useMemo)(() => {
    const n = 64;
    const seedText = json && json.title || String(text || "").slice(0, 80) || "overview";
    let x = 0;
    for (let i = 0; i < seedText.length; i += 1) x = (x * 31 + seedText.charCodeAt(i)) % 1e5;
    const out = [];
    for (let i = 0; i < n; i += 1) {
      x = (x * 1103515245 + 12345) % 2147483648;
      const base = 0.22 + Math.abs(Math.sin(i / 5)) * 0.5;
      out.push(Math.max(0.14, Math.min(1, base + x % 100 / 260)));
    }
    return out;
  }, [text, json]);
  const progress = dur ? t / dur : 0;
  return el(
    "div",
    { className: "nb-view-body" },
    el(
      "div",
      { className: "nb-stage" },
      el(
        "div",
        { className: "nb-screen nb-screen-audio", style: { aspectRatio: "auto" } },
        el(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px" } },
          el("span", { className: "nb-chip", "data-tone": "accent", children: "TWO HOSTS" }),
          el("span", {
            style: { fontSize: "16px", fontWeight: 620, color: "#eee" },
            children: json && json.title || "Audio Overview"
          }),
          el("span", { style: { flex: 1 } }),
          el("span", {
            className: "nb-mono",
            style: { fontSize: "12.5px", color: "#9aa0b5" },
            children: `${fmtTime(t)} / ${dur ? fmtTime(dur) : "\u2014"}`
          })
        ),
        el("div", {
          className: "nb-wave",
          role: "img",
          "aria-label": `waveform, ${Math.round(progress * 100)} percent played`,
          onClick: (e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const frac = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
            const el2 = audioRef.current;
            if (el2 && dur) {
              el2.currentTime = frac * dur;
              setT(el2.currentTime);
            }
          },
          style: { cursor: "pointer" }
        }, bars.map((h, i) => (0, import_jsx_runtime.jsx)("i", {
          key: `b${i}`,
          style: { height: `${Math.round(h * 100)}%` },
          "data-past": i / bars.length <= progress ? "true" : "false"
        }))),
        el(
          "div",
          { className: "nb-ctrl" },
          el("button", {
            type: "button",
            className: "nb-icon",
            "aria-label": playing ? "Pause" : "Play",
            onClick: () => {
              const a = audioRef.current;
              if (!a) return;
              if (a.paused) {
                a.play();
                setPlaying(true);
              } else {
                a.pause();
                setPlaying(false);
              }
            },
            style: { background: "rgba(255,255,255,.1)", width: "40px", height: "40px" },
            children: (0, import_jsx_runtime.jsx)(Glyph, { name: playing ? "pause" : "play", size: 16 })
          }),
          el("input", {
            type: "range",
            min: 0,
            max: 100,
            value: Math.round(progress * 100),
            "aria-label": "Scrub audio",
            style: { flex: 1, accentColor: T.accent },
            onChange: (e) => {
              const a = audioRef.current;
              if (a && dur) {
                a.currentTime = Number(e.target.value) / 100 * dur;
              }
            }
          }),
          el("span", { className: "nb-chip", children: "1.0\xD7" })
        ),
        el("audio", {
          ref: audioRef,
          src: src || void 0,
          preload: "metadata",
          onTimeUpdate: (e) => setT(e.currentTarget.currentTime),
          onLoadedMetadata: (e) => setDur(e.currentTarget.duration || 0),
          onEnded: () => setPlaying(false),
          style: { display: "none" }
        })
      ),
      lines.length ? el(
        "div",
        { className: "nb-doc", style: { maxWidth: "100%" } },
        el("div", { className: "nb-meta", style: { marginBottom: "10px" }, children: "Transcript" }),
        lines.map((l, i) => (0, import_jsx_runtime.jsx)(TranscriptLine, { line: l, first: i === 0 }, `l${i}`))
      ) : null
    )
  );
}
function TranscriptLine({ line, first }) {
  if (line.head) {
    return (0, import_jsx_runtime.jsx)("div", {
      style: { fontSize: "17px", fontWeight: 650, letterSpacing: "-.01em", margin: "0 0 6px" },
      children: line.text
    });
  }
  if (line.meta) {
    return (0, import_jsx_runtime.jsx)("div", {
      style: { fontSize: "12.5px", color: T.text4, marginBottom: "10px" },
      children: line.text
    });
  }
  return el(
    "div",
    {
      style: {
        display: "grid",
        gridTemplateColumns: "26px 1fr",
        gap: "10px",
        padding: "7px 0",
        borderTop: first ? "none" : `1px solid ${T.lineSoft}`
      }
    },
    (0, import_jsx_runtime.jsx)("span", {
      style: {
        fontSize: "11.5px",
        fontWeight: 700,
        letterSpacing: ".04em",
        color: line.who === "B" ? T.purple : T.accent,
        fontFamily: "var(--ui-font-mono, ui-monospace, monospace)"
      },
      children: line.who || "\xB7"
    }),
    (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "15px", lineHeight: 1.55, color: T.text2 }, children: line.text })
  );
}
var fmtTime = (s) => {
  const v = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
};
function MindMapView({ data, text }) {
  const tree = (0, import_react.useMemo)(() => data && data.children ? data : parseMindMapMd(text), [data, text]);
  const [zoom, setZoom] = (0, import_react.useState)(1);
  const [pan, setPan] = (0, import_react.useState)({ x: 0, y: 0 });
  const drag = (0, import_react.useRef)(null);
  const { nodes, width, height } = (0, import_react.useMemo)(() => layoutTree(tree), [tree]);
  if (!nodes.length) {
    return el(
      "div",
      { className: "nb-view-body" },
      (0, import_jsx_runtime.jsx)("div", { className: "nb-hint", children: "no mind map structure in this artifact" })
    );
  }
  const nodeEls = nodes.map((n, i) => (0, import_jsx_runtime.jsx)("g", { key: `n${i}`, children: [
    n.parent >= 0 ? (0, import_jsx_runtime.jsx)("path", {
      d: curve(nodes[n.parent], n),
      fill: "none",
      stroke: `color-mix(in srgb, ${T.accent} ${n.depth === 1 ? 52 : 34}%, transparent)`,
      strokeWidth: n.depth === 1 ? 1.8 : 1.3
    }) : null,
    (0, import_jsx_runtime.jsx)("rect", {
      x: n.x - n.w / 2,
      y: n.y - n.h / 2,
      width: n.w,
      height: n.h,
      rx: 9,
      fill: n.depth === 0 ? `color-mix(in srgb, ${T.accent} 24%, transparent)` : n.depth === 1 ? `color-mix(in srgb, ${T.accent} 9%, var(--ui-bg-primary, #101116))` : "var(--ui-bg-primary, #101116)",
      stroke: `color-mix(in srgb, ${T.accent} ${n.depth === 0 ? 62 : n.depth === 1 ? 34 : 20}%, transparent)`
    }),
    (0, import_jsx_runtime.jsx)("text", {
      x: n.x,
      y: n.y + (n.depth === 0 ? 5 : 4),
      textAnchor: "middle",
      fill: n.depth === 0 ? T.text : n.depth === 1 ? T.text : T.text2,
      fontSize: n.depth === 0 ? 18 : n.depth === 1 ? 16 : 14.5,
      fontWeight: n.depth <= 1 ? 660 : 500,
      children: n.label
    }),
    n.detail ? (0, import_jsx_runtime.jsx)("title", { children: `${n.label} \u2014 ${n.detail}` }) : null
  ].filter(Boolean) }));
  const canvas = (0, import_jsx_runtime.jsx)("svg", {
    className: "nb-map",
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": `Mind map: ${tree && tree.label || "root"} with ${nodes.length} nodes`,
    preserveAspectRatio: "xMidYMid meet",
    onWheel: (e) => {
      e.preventDefault();
      setZoom((z) => Math.min(2.4, Math.max(0.55, z - e.deltaY * 12e-4)));
    },
    onPointerDown: (e) => {
      drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e) => {
      if (drag.current) setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
    },
    onPointerUp: () => {
      drag.current = null;
    },
    onPointerCancel: () => {
      drag.current = null;
    },
    children: el("g", {
      transform: `translate(${pan.x} ${pan.y}) translate(${width / 2} ${height / 2}) scale(${zoom}) translate(${-width / 2} ${-height / 2})`
    }, nodeEls)
  });
  const toolbar = el(
    "div",
    { style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" } },
    (0, import_jsx_runtime.jsx)("span", { className: "nb-hint", children: `${nodes.length} nodes \xB7 drag to pan \xB7 scroll to zoom \xB7 hover a node for its detail` }),
    el("span", { style: { flex: 1 } }),
    (0, import_jsx_runtime.jsx)(Btn, {
      size: "sm",
      icon: "grid",
      children: "Reset view",
      onClick: () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    })
  );
  return el(
    "div",
    { className: "nb-view-body", style: { padding: "12px", display: "flex", flexDirection: "column" } },
    toolbar,
    el("div", { style: { flex: 1, minHeight: "340px" } }, canvas)
  );
}
function curve(a, b) {
  const mx = (a.x + b.x) / 2;
  return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
}
function layoutTree(tree) {
  const nodes = [];
  if (!tree) return { nodes, width: 900, height: 560 };
  const labelOf = (n) => String(n.label || n.title || "node");
  const measure = (label, depth) => {
    const fs = depth === 0 ? 18 : depth === 1 ? 16 : 14.5;
    const w = Math.min(232, 26 + label.length * fs * 0.58);
    return { w, h: depth === 0 ? 44 : 34 };
  };
  let cursor = 0;
  const rowH = 38;
  const walk = (node, depth, parent) => {
    const kids = (node.children || []).filter((c) => c && typeof c === "object").slice(0, 8);
    const index = nodes.length;
    nodes.push({ label: "", detail: node.detail || "", depth, parent, x: 0, y: 0, w: 0, h: 0 });
    let y;
    if (!kids.length) {
      y = cursor * rowH;
      cursor += 1;
    } else {
      const ys = kids.map((c) => walk(c, depth + 1, index));
      y = (ys[0] + ys[ys.length - 1]) / 2;
    }
    const label = labelOf(node);
    const { w, h } = measure(label, depth);
    nodes[index] = { ...nodes[index], label, x: 0, y, w, h };
    return y;
  };
  walk(tree, 0, -1);
  const byDepth = [];
  for (const n of nodes) {
    byDepth[n.depth] = Math.max(byDepth[n.depth] || 0, n.w);
  }
  const gap = 58;
  const pad = 34;
  const xs = [];
  let x = pad;
  for (let d = 0; d < byDepth.length; d += 1) {
    xs[d] = x + byDepth[d] / 2;
    x += byDepth[d] + gap;
  }
  for (const n of nodes) n.x = xs[n.depth];
  const width = Math.max(420, x - gap + pad);
  const height = Math.max(240, (Math.max(cursor, 1) - 1) * rowH + 64);
  for (const n of nodes) n.y += 30;
  return { nodes, width, height };
}
function parseMindMapMd(text) {
  const lines = String(text || "").split("\n");
  const root = { label: "Mind map", children: [] };
  const stack = [{ node: root, depth: -1 }];
  for (const line of lines) {
    const m = /^(\s*)-\s+(.*)$/.exec(line);
    if (!m) continue;
    const depth = Math.floor(m[1].length / 2);
    const [label, detail] = m[2].split(" \u2014 ");
    const node = { label: label.trim(), detail: (detail || "").trim(), children: [] };
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    const parent = stack.length ? stack[stack.length - 1].node : root;
    parent.children.push(node);
    stack.push({ node, depth });
  }
  return root.children.length ? root : null;
}
function FlashcardsView({ data, text }) {
  const cards = data && data.cards || [];
  const [i, setI] = (0, import_react.useState)(0);
  const [flipped, setFlipped] = (0, import_react.useState)(false);
  const [known, setKnown] = (0, import_react.useState)(() => persist.get("known:cards", {}) || {});
  (0, import_react.useEffect)(() => {
    setI(0);
    setFlipped(false);
  }, [cards.length]);
  if (!cards.length) {
    return el("div", { className: "nb-view-body" }, el("div", { className: "nb-doc" }, (0, import_jsx_runtime.jsx)(Markdown, { text })));
  }
  const card = cards[Math.min(i, cards.length - 1)];
  const mark = (val) => {
    const next = { ...known, [i]: val };
    setKnown(next);
    persist.set("known:cards", next);
    setFlipped(false);
    setI((n) => Math.min(cards.length - 1, n + 1));
  };
  const knownCount = Object.values(known).filter(Boolean).length;
  return el(
    "div",
    { className: "nb-view-body" },
    el(
      "div",
      { className: "nb-deck" },
      el(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        (0, import_jsx_runtime.jsx)("span", {
          className: "nb-chip",
          "data-tone": Object.keys(known).length ? "ok" : void 0,
          children: `${knownCount} known`
        }),
        (0, import_jsx_runtime.jsx)("span", { className: "nb-hint", children: `card ${i + 1} of ${cards.length}` }),
        el("span", { style: { flex: 1 } }),
        (0, import_jsx_runtime.jsx)(Btn, {
          size: "sm",
          icon: "refresh",
          children: "Restart",
          onClick: () => {
            setI(0);
            setFlipped(false);
            setKnown({});
            persist.set("known:cards", {});
          }
        })
      ),
      (0, import_jsx_runtime.jsx)("button", {
        type: "button",
        className: "nb-flip",
        "data-flipped": flipped ? "true" : "false",
        onClick: () => setFlipped((f) => !f),
        "aria-label": flipped ? "Show the question again" : "Show the answer",
        children: el(
          "div",
          { className: "nb-flip-inner" },
          el(
            "div",
            { className: "nb-face", "data-side": "front" },
            (0, import_jsx_runtime.jsx)("span", { className: "nb-meta", children: "question" }),
            (0, import_jsx_runtime.jsx)("span", { children: card.front }),
            (0, import_jsx_runtime.jsx)("span", { className: "nb-face-hint", children: "click the card \u2014 or press \u201CShow answer\u201D \u2014 to flip" })
          ),
          el(
            "div",
            { className: "nb-face", "data-side": "back" },
            (0, import_jsx_runtime.jsx)("span", { className: "nb-meta", children: "answer" }),
            (0, import_jsx_runtime.jsx)("span", { children: card.back }),
            card.source ? (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "13px", color: T.text3, marginTop: "auto" }, children: card.source }) : null
          )
        )
      }),
      el(
        "div",
        { style: { display: "flex", gap: "8px", justifyContent: "center", alignItems: "center" } },
        (0, import_jsx_runtime.jsx)(Btn, {
          icon: "arrowLeft",
          disabled: i === 0,
          children: "Prev",
          onClick: () => {
            setFlipped(false);
            setI((n) => Math.max(0, n - 1));
          }
        }),
        flipped ? (0, import_jsx_runtime.jsx)(Btn, { icon: "close", onClick: () => mark(false), children: "Again" }) : (0, import_jsx_runtime.jsx)(Btn, {
          variant: "primary",
          icon: "refresh",
          children: "Show answer",
          onClick: () => setFlipped(true)
        }),
        flipped ? (0, import_jsx_runtime.jsx)(Btn, { variant: "primary", icon: "check", onClick: () => mark(true), children: "Got it" }) : null,
        (0, import_jsx_runtime.jsx)(Btn, {
          icon: "arrowRight",
          disabled: i === cards.length - 1,
          children: "Next",
          onClick: () => {
            setFlipped(false);
            setI((n) => Math.min(cards.length - 1, n + 1));
          }
        })
      ),
      el(
        "div",
        { className: "nb-bar-track", style: { maxWidth: "100%" } },
        el("div", { className: "nb-bar-fill", style: { width: `${(i + 1) / cards.length * 100}%` } })
      )
    )
  );
}
function QuizView({ data, text }) {
  const questions = data && (data.questions || data.items) || [];
  const [picked, setPicked] = (0, import_react.useState)({});
  if (!questions.length) {
    return el("div", { className: "nb-view-body" }, el("div", { className: "nb-doc" }, (0, import_jsx_runtime.jsx)(Markdown, { text })));
  }
  const score = questions.reduce((acc, q, i) => {
    const chosen = picked[i];
    if (chosen === void 0) return acc;
    return acc + (normAnswer(chosen) === normAnswer(q.answer) ? 1 : 0);
  }, 0);
  const answered = Object.keys(picked).length;
  return el(
    "div",
    { className: "nb-view-body" },
    el(
      "div",
      { style: { maxWidth: "76ch" } },
      el(
        "div",
        { style: { display: "flex", gap: "10px", alignItems: "center", marginBottom: "14px" } },
        el("span", {
          className: "nb-chip",
          "data-tone": answered === questions.length ? "ok" : "accent",
          children: `${answered}/${questions.length} answered`
        }),
        answered ? el("span", { className: "nb-chip", children: `${score} correct` }) : null,
        el("span", { style: { flex: 1 } }),
        answered ? (0, import_jsx_runtime.jsx)(Btn, { size: "sm", icon: "refresh", onClick: () => setPicked({}), children: "Reset" }) : null
      ),
      questions.map((q, qi) => {
        const chosen = picked[qi];
        const done = chosen !== void 0;
        const right = done && normAnswer(chosen) === normAnswer(q.answer);
        return el(
          "div",
          {
            key: `q${qi}`,
            style: { border: `1px solid ${T.line}`, borderRadius: "12px", padding: "14px", marginBottom: "10px", background: T.card }
          },
          el(
            "div",
            { style: { display: "flex", gap: "10px", alignItems: "baseline" } },
            el("span", { className: "nb-mono", style: { color: T.text4, fontSize: "12.5px" }, children: String(qi + 1).padStart(2, "0") }),
            el("span", { style: { fontSize: "15.5px", fontWeight: 600, lineHeight: 1.45 }, children: q.question })
          ),
          el(
            "div",
            { style: { display: "grid", gap: "6px", marginTop: "10px" }, role: "group", "aria-label": `Choices for question ${qi + 1}` },
            (q.choices && q.choices.length ? q.choices : [q.answer]).map((c, ci) => {
              const isChosen = chosen === c;
              const isRight = normAnswer(c) === normAnswer(q.answer);
              const tone = !done ? T.card : isRight ? `color-mix(in srgb, ${T.ok} 16%, transparent)` : isChosen ? `color-mix(in srgb, ${T.danger} 14%, transparent)` : T.card;
              return el("button", {
                type: "button",
                disabled: done,
                onClick: () => setPicked((p) => ({ ...p, [qi]: c })),
                "aria-pressed": isChosen,
                style: {
                  minHeight: "38px",
                  textAlign: "left",
                  padding: "8px 12px",
                  borderRadius: "9px",
                  border: `1px solid ${isChosen || done && isRight ? T.line : T.lineSoft}`,
                  background: tone,
                  color: T.text,
                  fontSize: "14.5px",
                  cursor: done ? "default" : "pointer"
                },
                children: c
              }, `c${ci}`);
            })
          ),
          done ? el(
            "div",
            { style: { marginTop: "10px", fontSize: "14px", color: right ? T.ok : T.warn } },
            el("b", { children: right ? "Correct. " : `Not quite \u2014 ${q.answer}. ` }),
            q.explanation ? el("span", { style: { color: T.text2 }, children: q.explanation }) : null
          ) : null
        );
      })
    )
  );
}
var normAnswer = (s) => String(s == null ? "" : s).trim().toLowerCase().replace(/^[a-d][).]\s*/, "").replace(/[^a-z0-9 ]/g, "").trim();
function SlidesView({ data, htmlUrl }) {
  const deck = data || {};
  const slides = deck.slides || [];
  const [i, setI] = (0, import_react.useState)(0);
  const go = (0, import_react.useCallback)((d) => setI((n) => Math.min(slides.length - 1, Math.max(0, n + d))), [slides.length]);
  (0, import_react.useEffect)(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") {
        go(1);
      } else if (e.key === "ArrowLeft") {
        go(-1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go]);
  if (!slides.length) {
    return el("div", { className: "nb-view-body" }, el("div", { className: "nb-hint", children: "this deck has no slides in its json \u2014 open the html file" }));
  }
  const s = slides[i];
  return el(
    "div",
    { className: "nb-view-body" },
    el(
      "div",
      { className: "nb-stage" },
      el(
        "div",
        {
          className: "nb-screen",
          role: "group",
          "aria-label": `Slide ${i + 1} of ${slides.length}`,
          style: {
            aspectRatio: "16/9",
            padding: "34px 40px",
            placeItems: "stretch",
            background: `linear-gradient(150deg, color-mix(in srgb, ${T.accent} 18%, #0a0b10), #08090d)`,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column"
          },
          onClick: (e) => {
            const box = e.currentTarget.getBoundingClientRect();
            go((e.clientX - box.left) / box.width > 0.5 ? 1 : -1);
          }
        },
        el(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px" } },
          el("span", {
            style: { fontSize: "11.5px", letterSpacing: ".14em", textTransform: "uppercase", color: "#9aa0b5", fontWeight: 700 },
            children: deck.title || "Deck"
          }),
          el("span", { style: { flex: 1 } }),
          el("span", { className: "nb-mono", style: { fontSize: "12px", color: "#9aa0b5" }, children: `${i + 1}/${slides.length}` })
        ),
        el("div", { style: { fontSize: "30px", fontWeight: 680, letterSpacing: "-.02em", color: "#f2f3f8", margin: "18px 0 14px", lineHeight: 1.15 }, children: s.title }),
        el(
          "ul",
          { style: { margin: 0, paddingLeft: "20px", color: "#d6d8e6", fontSize: "17px", lineHeight: 1.6, display: "grid", gap: "9px" } },
          (s.bullets || []).map((b, bi) => el("li", { children: b }, `b${bi}`))
        ),
        s.note ? el("div", { style: { marginTop: "auto", fontSize: "13px", color: "#8b90a3", fontStyle: "italic" }, children: s.note }) : null
      ),
      el(
        "div",
        { style: { display: "flex", gap: "8px", alignItems: "center" } },
        (0, import_jsx_runtime.jsx)(Btn, { icon: "arrowLeft", onClick: () => go(-1), disabled: i === 0, children: "Back" }),
        (0, import_jsx_runtime.jsx)(Btn, { icon: "arrowRight", onClick: () => go(1), disabled: i === slides.length - 1, children: "Next" }),
        el("span", { style: { flex: 1 } }),
        el(
          "div",
          { style: { display: "flex", gap: "4px" }, role: "tablist", "aria-label": "Slides" },
          slides.map((_, si) => el("button", {
            key: `d${si}`,
            type: "button",
            role: "tab",
            "aria-selected": si === i,
            "aria-label": `Slide ${si + 1}`,
            onClick: () => setI(si),
            style: {
              width: "22px",
              height: "22px",
              border: 0,
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              display: "grid",
              placeItems: "center"
            },
            children: el("span", {
              style: {
                width: "8px",
                height: "8px",
                borderRadius: "99px",
                background: si === i ? T.accent : `color-mix(in srgb, ${T.text} 22%, transparent)`
              }
            })
          }, `dot${si}`))
        )
      )
    )
  );
}
function InfographicView({ src, data }) {
  const [zoom, setZoom] = (0, import_react.useState)(1);
  return el(
    "div",
    { className: "nb-view-body" },
    el(
      "div",
      { className: "nb-stage" },
      el(
        "div",
        {
          style: {
            border: `1px solid ${T.line}`,
            borderRadius: "14px",
            overflow: "auto",
            background: "#08090d",
            maxHeight: "62vh"
          }
        },
        src ? el("img", {
          src,
          alt: data && data.title || "infographic",
          style: { display: "block", width: `${Math.round(zoom * 100)}%`, height: "auto" }
        }) : el("div", { className: "nb-hint", style: { padding: "20px" }, children: "the image did not load" })
      ),
      el(
        "div",
        { style: { display: "flex", gap: "8px", alignItems: "center" } },
        (0, import_jsx_runtime.jsx)(Btn, { size: "sm", onClick: () => setZoom((z) => Math.max(0.5, z - 0.15)), children: "\u2212" }),
        (0, import_jsx_runtime.jsx)(Btn, { size: "sm", onClick: () => setZoom((z) => Math.min(2, z + 0.15)), children: "+" }),
        el("span", { className: "nb-hint", children: `${Math.round(zoom * 100)}%` }),
        el("span", { style: { flex: 1 } }),
        data && data.takeaway ? el("span", { className: "nb-chip", "data-tone": "accent", children: data.takeaway }) : null
      )
    )
  );
}
function TimelineView({ text, onCite }) {
  const rows = (0, import_react.useMemo)(() => {
    const out = [];
    for (const line of String(text || "").split("\n")) {
      const m = /^\s*[-*]\s*(?:\*\*)?([0-9]{3,4}[^—\-:\*]*|[A-Z][a-z]{2,8}\.?\s+[0-9]{1,2},?\s+[0-9]{4})(?:\*\*)?\s*[—\-:]\s*(.+)$/.exec(line);
      if (m) out.push({ when: m[1].trim().replace(/\*\*/g, ""), what: m[2].trim() });
    }
    return out;
  }, [text]);
  if (rows.length < 3) {
    return el("div", { className: "nb-view-body" }, el("div", { className: "nb-doc" }, (0, import_jsx_runtime.jsx)(Markdown, { text, onCite })));
  }
  return el(
    "div",
    { className: "nb-view-body" },
    el(
      "div",
      { style: { maxWidth: "72ch" } },
      el(
        "ol",
        { className: "nb-timeline", "aria-label": "Timeline" },
        rows.map((r, i) => el(
          "li",
          { className: "nb-tl", key: `t${i}` },
          el("span", { className: "nb-tl-when", children: r.when }),
          el("span", { className: "nb-tl-what", children: (0, import_jsx_runtime.jsx)(Markdown, { text: r.what, onCite }) })
        ))
      )
    )
  );
}
var OPS_TABS = [
  { id: "services", label: "Services", icon: "server" },
  { id: "terminal", label: "Terminal", icon: "terminal" },
  { id: "files", label: "Files", icon: "folder" },
  { id: "snapshots", label: "Snapshots", icon: "camera" },
  { id: "audit", label: "Audit", icon: "shield" }
];
function OpsDeck({ onSay, onStats }) {
  const [state, setState] = (0, import_react.useState)({ loading: true, hosts: [], error: "", measured_at: "" });
  const [sel, setSel] = (0, import_react.useState)("local");
  const [tab, setTab] = (0, import_react.useState)("services");
  const load = (0, import_react.useCallback)(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const out = await api("/ops/fleet", { timeoutMs: 12e4 });
      setState({ loading: false, hosts: out.hosts || [], error: "", measured_at: out.measured_at || "" });
    } catch (e) {
      setState({ loading: false, hosts: [], error: e.message || String(e), measured_at: "" });
    }
  }, []);
  (0, import_react.useEffect)(() => {
    load();
  }, [load]);
  const hosts = state.hosts;
  (0, import_react.useEffect)(() => {
    if (onStats && hosts.length) {
      onStats({
        hosts: hosts.length,
        patched: hosts.filter((h) => h.patch_state === "patched").length,
        exposed: hosts.filter((h) => h.patch_state === "vulnerable").length,
        down: hosts.filter((h) => h.reachable === false).length,
        measured_at: state.measured_at
      });
    }
  }, [hosts, onStats, state.measured_at]);
  const host2 = hosts.find((h) => h.id === sel) || hosts[0] || null;
  (0, import_react.useEffect)(() => {
    if (hosts.length && !hosts.some((h) => h.id === sel)) setSel(hosts[0].id);
  }, [hosts, sel]);
  const patched = hosts.filter((h) => h.patch_state === "patched").length;
  const vulnerable = hosts.filter((h) => h.patch_state === "vulnerable").length;
  const down = hosts.filter((h) => h.reachable === false).length;
  return el(
    "div",
    {
      className: "nb-body",
      role: "main",
      "aria-label": "Lab operations",
      style: {
        gridTemplateColumns: "330px minmax(0,1fr)",
        background: "transparent"
      }
    },
    el(
      "aside",
      { className: "nb-col", style: { borderRight: `1px solid ${T.line}`, background: `color-mix(in srgb, ${T.text} 2%, transparent)` } },
      el(
        "div",
        { className: "nb-pane-head" },
        el("span", { className: "nb-meta", children: `Fleet \xB7 ${hosts.length}` }),
        (0, import_jsx_runtime.jsx)(IconBtn, { icon: "refresh", label: "Re-measure the fleet", onClick: load })
      ),
      el(
        "div",
        { className: "nb-pad", style: { paddingBottom: "8px" } },
        state.error ? el("div", { style: { color: T.danger, fontSize: "13.5px", lineHeight: 1.5 }, children: state.error }) : el(
          "div",
          { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
          (0, import_jsx_runtime.jsx)(Chip, { tone: "ok", children: `${patched} patched` }),
          vulnerable ? (0, import_jsx_runtime.jsx)(Chip, { tone: "warn", children: `${vulnerable} fix available` }) : null,
          down ? (0, import_jsx_runtime.jsx)(Chip, { tone: "danger", children: `${down} unreachable` }) : null,
          state.loading ? (0, import_jsx_runtime.jsx)(Chip, { children: "measuring\u2026" }) : null
        )
      ),
      el(
        "div",
        { className: "nb-scroll" },
        el(
          "div",
          { className: "nb-fleet", role: "list" },
          hosts.map((h) => el(
            "button",
            {
              key: h.id,
              type: "button",
              className: "nb-frow",
              role: "listitem",
              "aria-current": host2 && h.id === host2.id ? "true" : "false",
              onClick: () => setSel(h.id),
              title: h.error || `${h.name} \xB7 ${h.dial || ""}`
            },
            (0, import_jsx_runtime.jsx)("span", {
              className: "nb-sdot",
              style: {
                background: h.reachable ? h.patch_state === "patched" ? T.ok : T.warn : T.danger,
                boxShadow: h.reachable ? `0 0 6px ${h.patch_state === "patched" ? T.ok : T.warn}` : "none",
                margin: 0
              }
            }),
            el(
              "span",
              { style: { minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" } },
              el(
                "span",
                { style: { display: "flex", alignItems: "baseline", gap: "7px", minWidth: 0 } },
                (0, import_jsx_runtime.jsx)("span", { className: "nb-fname", children: h.name }),
                (0, import_jsx_runtime.jsx)("span", { className: "nb-frole", children: h.role })
              ),
              (0, import_jsx_runtime.jsx)("span", {
                className: "nb-mono",
                style: { fontSize: "11.5px", color: T.text4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
                children: h.reachable ? `${(h.kernel || "").replace(/-generic$/, "")} \xB7 ${Math.round((h.mem || {}).pct || 0)}% mem` : (h.error || "no route").replace(/^ssh: /, "")
              })
            ),
            (0, import_jsx_runtime.jsx)("span", {
              className: "nb-chip",
              "data-tone": h.reachable ? h.patch_state === "patched" ? "ok" : "warn" : "danger",
              children: h.reachable ? h.patch_state === "patched" ? "patched" : "fix avail" : "no route"
            })
          )),
          !hosts.length && !state.loading ? el("div", { className: "nb-hint", style: { padding: "12px" }, children: "no hosts in the inventory" }) : null
        )
      ),
      el(
        "div",
        { style: { borderTop: `1px solid ${T.lineSoft}`, padding: "10px 14px" } },
        el("div", {
          className: "nb-hint",
          style: { lineHeight: 1.5 },
          children: state.measured_at ? `measured ${clock(state.measured_at)} \xB7 ssh, audited` : "ssh \xB7 audited transport"
        })
      )
    ),
    el(
      "section",
      { className: "nb-col", "aria-label": "Selected host" },
      host2 ? (0, import_jsx_runtime.jsx)(HostView, { host: host2, tab, setTab, onSay, key: host2.id }) : el(
        "div",
        { className: "nb-void" },
        el(
          "div",
          null,
          el("h3", { children: state.loading ? "Measuring the fleet" : "No host selected" }),
          el("p", { children: state.loading ? "Probing eight hosts over ssh \u2014 kernel, memory, disk, failed units, patch posture." : "Pick a machine on the left. Controls appear only for hosts that answer." })
        )
      )
    )
  );
}
function HostView({ host: host2, tab, setTab, onSay }) {
  const ok = host2.reachable;
  return el(
    "div",
    { className: "nb-col", style: { minHeight: 0 } },
    el(
      "div",
      { className: "nb-main-head" },
      el(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        el("h1", { className: "nb-h1", children: host2.name }),
        el("span", { className: "nb-chip", children: host2.role }),
        ok ? el("span", {
          className: "nb-chip",
          "data-tone": host2.patch_state === "patched" ? "ok" : "warn",
          children: host2.patch_state === "patched" ? "kernel patched" : `upgrade to ${host2.kernel_fix || "fix"}`
        }) : el("span", { className: "nb-chip", "data-tone": "danger", children: "unreachable" }),
        el("span", { style: { flex: 1 } }),
        el("span", { className: "nb-mono", style: { fontSize: "12px", color: T.text4 }, children: host2.dial || "" })
      ),
      ok ? el("p", { className: "nb-sub", children: `${host2.os || ""} \xB7 kernel ${host2.kernel || "?"} \xB7 up ${fmtUptime(host2.uptime_s)} \xB7 ${host2.cores || "?"} cores \xB7 load ${(host2.load || []).map((n) => Number(n).toFixed(2)).join(" / ")}` }) : el("p", { className: "nb-sub", style: { color: T.danger }, children: host2.error || "this host did not answer" }),
      ok ? el(
        "div",
        { className: "nb-strip", role: "group", "aria-label": "Host measurements" },
        el("div", { className: "nb-cell" }, el("b", { children: `${Math.round((host2.mem || {}).pct || 0)}%` }), el("span", { children: "memory" })),
        el("div", { className: "nb-cell" }, el("b", { children: `${Math.round((host2.disk || {}).pct || 0)}%` }), el("span", { children: "disk" })),
        el("div", { className: "nb-cell" }, el("b", { children: host2.containers_up || 0 }), el("span", { children: "containers" })),
        el("div", { className: "nb-cell" }, el("b", { style: { color: host2.failed_units ? T.danger : T.ok }, children: host2.failed_units || 0 }), el("span", { children: "failed units" })),
        el("div", { className: "nb-cell" }, el("b", { children: `${host2.measured_ms || 0}ms` }), el("span", { children: "probe" }))
      ) : null,
      el(
        "div",
        { className: "nb-tabs", role: "tablist", "aria-label": "Host tools" },
        OPS_TABS.map((t) => el("button", {
          key: t.id,
          type: "button",
          role: "tab",
          className: "nb-tab",
          "aria-selected": tab === t.id,
          onClick: () => setTab(t.id),
          disabled: !ok,
          children: [(0, import_jsx_runtime.jsx)(Glyph, { name: t.icon, size: 15 }), t.label]
        }, t.id))
      )
    ),
    ok ? tab === "services" ? (0, import_jsx_runtime.jsx)(ServicesTab, { host: host2, onSay }) : tab === "terminal" ? (0, import_jsx_runtime.jsx)(TerminalTab, { host: host2, onSay }) : tab === "files" ? (0, import_jsx_runtime.jsx)(FilesTab, { host: host2 }) : tab === "snapshots" ? (0, import_jsx_runtime.jsx)(SnapshotsTab, { host: host2, onSay }) : (0, import_jsx_runtime.jsx)(AuditTab, { onSay }) : el(
      "div",
      { className: "nb-void" },
      el(
        "div",
        null,
        el("h3", { children: "No route to this machine" }),
        el("p", { children: "The probe failed, so there is nothing honest to show and no action to offer. Fixing reachability is the only next step." })
      )
    )
  );
}
var fmtUptime = (s) => {
  const v = Number(s) || 0;
  const d = Math.floor(v / 86400);
  const h = Math.floor(v % 86400 / 3600);
  if (d) return `${d}d ${h}h`;
  return `${h}h ${Math.floor(v % 3600 / 60)}m`;
};
function ServicesTab({ host: host2, onSay }) {
  const [state, setState] = (0, import_react.useState)({ loading: true, units: [], failed: 0, error: "" });
  const [q, setQ] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)("");
  const [result, setResult] = (0, import_react.useState)(null);
  const load = (0, import_react.useCallback)(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const out = await api(`/ops/services?${qs({ host: host2.id })}`, { timeoutMs: 45e3 });
      setState({ loading: false, units: out.units || [], failed: out.failed || 0, error: "" });
    } catch (e) {
      setState({ loading: false, units: [], failed: 0, error: e.message || String(e) });
    }
  }, [host2.id]);
  (0, import_react.useEffect)(() => {
    load();
  }, [load]);
  const op = async (unit, verb) => {
    setBusy(unit);
    setResult(null);
    try {
      const out = await api("/ops/service", {
        method: "POST",
        body: { host: host2.id, unit, op: verb, confirm: verb === "stop" || verb === "mask" ? unit : "" },
        timeoutMs: 6e4
      });
      setResult({ unit, verb, ...out.result || {} });
      await load();
    } catch (e) {
      setResult({ unit, verb, ok: false, err: e.message || String(e) });
      if (onSay) onSay(`${verb} ${unit}: ${e.message || e}`);
    } finally {
      setBusy("");
    }
  };
  const units = state.units.filter((u) => !q.trim() || u.unit.toLowerCase().includes(q.toLowerCase()));
  return el(
    "div",
    { className: "nb-view" },
    el(
      "div",
      { className: "nb-view-head" },
      el("span", { className: "nb-meta", children: `${state.units.length} units` }),
      state.failed ? el("span", { className: "nb-chip", "data-tone": "danger", children: `${state.failed} failed` }) : null,
      el("span", { style: { flex: 1 } }),
      el(
        "div",
        { style: { width: "220px" } },
        (0, import_jsx_runtime.jsx)(SearchField, { value: q, onChange: setQ, placeholder: "Filter units", label: "Filter systemd units" })
      ),
      (0, import_jsx_runtime.jsx)(IconBtn, { icon: "refresh", label: "Reload units", onClick: load })
    ),
    result ? el(
      "div",
      { className: "nb-pad", style: { borderBottom: `1px solid ${T.lineSoft}` } },
      el("div", {
        className: "nb-mono",
        style: { fontSize: "12.5px", color: result.ok ? T.ok : T.danger, whiteSpace: "pre-wrap" },
        children: `${result.verb} ${result.unit} \u2192 ${result.ok ? "ok" : "failed"} (exit ${result.code ?? "?"})
${(result.out || result.err || "").trim().slice(0, 400)}`
      })
    ) : null,
    el(
      "div",
      { className: "nb-scroll" },
      state.error ? el("div", { className: "nb-pad", style: { color: T.danger }, children: state.error }) : state.loading ? el("div", { className: "nb-pad", children: el("span", { className: "nb-hint", children: "asking systemd\u2026" }) }) : el(
        "div",
        { className: "nb-pad", style: { display: "flex", flexDirection: "column", gap: "2px" } },
        units.slice(0, 120).map((u) => el(
          "div",
          {
            key: u.unit,
            style: {
              display: "grid",
              gridTemplateColumns: "10px 1fr 84px 96px",
              gap: "10px",
              alignItems: "center",
              padding: "7px 8px",
              borderRadius: "8px",
              borderTop: `1px solid ${T.lineSoft}`
            }
          },
          el("span", { className: "nb-sdot", style: { margin: 0, background: u.failed ? T.danger : u.active === "active" ? T.ok : T.text4 } }),
          el(
            "span",
            { style: { minWidth: 0 } },
            el("span", { style: { display: "block", fontSize: "14px", fontWeight: 550, color: T.text }, children: u.unit }),
            el("span", { style: { display: "block", fontSize: "12.5px", color: T.text4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: u.description })
          ),
          el("span", {
            className: "nb-chip",
            "data-tone": u.failed ? "danger" : u.active === "active" ? "ok" : void 0,
            children: u.active
          }),
          (0, import_jsx_runtime.jsx)(Btn, {
            size: "sm",
            variant: "ghost",
            disabled: busy === u.unit,
            onClick: () => op(u.unit, "restart"),
            children: busy === u.unit ? "\u2026" : "Restart"
          })
        ))
      )
    )
  );
}
function TerminalTab({ host: host2, onSay }) {
  const [lines, setLines] = (0, import_react.useState)([]);
  const [cmd, setCmd] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const boxRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    const n = boxRef.current;
    if (n) n.scrollTop = n.scrollHeight;
  }, [lines.length]);
  const run = async () => {
    const c = cmd.trim();
    if (!c || busy) return;
    setBusy(true);
    setCmd("");
    setLines((l) => [...l, { kind: "cmd", text: c, at: Date.now() }]);
    try {
      const out = await api("/ops/exec", {
        method: "POST",
        body: { host: host2.id, cmd: c },
        timeoutMs: 9e4
      });
      const r = out.result || {};
      setLines((l) => [...l, {
        kind: "out",
        ok: !!r.ok,
        code: r.code,
        ms: r.ms,
        text: (r.out || "") + (r.err ? `
${r.err}` : ""),
        at: Date.now()
      }]);
    } catch (e) {
      setLines((l) => [...l, { kind: "out", ok: false, text: e.message || String(e), at: Date.now() }]);
      if (onSay) onSay(e.message || "exec failed");
    } finally {
      setBusy(false);
    }
  };
  return el(
    "div",
    { className: "nb-view" },
    el(
      "div",
      { className: "nb-view-body", style: { display: "flex", flexDirection: "column", gap: "10px" } },
      el(
        "div",
        { className: "nb-term", ref: boxRef, role: "log", "aria-live": "polite", "aria-label": "Command output" },
        lines.length === 0 ? el("span", { style: { color: "#6f7488" }, children: `# ${host2.name} \u2014 commands run over ssh, every call lands in the audit log
# try: uptime; df -h / ; docker ps --format '{{.Names}}\\t{{.Status}}'` }) : lines.map((l, i) => l.kind === "cmd" ? el("div", { key: `c${i}`, style: { marginTop: i ? "10px" : 0, color: "#8fd4a8" }, children: `\u276F ${l.text}` }) : el(
          "div",
          { key: `o${i}`, style: { color: l.ok ? "#d6d8e6" : "#ff8b8b", whiteSpace: "pre-wrap" } },
          l.text || "(no output)",
          el("span", { style: { color: "#6f7488" }, children: `
[exit ${l.code === void 0 ? "?" : l.code}${l.ms ? ` \xB7 ${l.ms}ms` : ""}]` })
        ))
      ),
      el(
        "div",
        { className: "nb-term-in" },
        el("span", { className: "nb-mono", style: { color: T.accent, fontSize: "14px" }, children: "\u276F" }),
        el("input", {
          value: cmd,
          onChange: (e) => setCmd(e.target.value),
          spellCheck: false,
          onKeyDown: (e) => {
            if (e.key === "Enter") run();
          },
          placeholder: `run a command on ${host2.name}`,
          "aria-label": "Command to run"
        }),
        (0, import_jsx_runtime.jsx)(Btn, {
          variant: "primary",
          icon: "bolt",
          onClick: run,
          disabled: busy || !cmd.trim(),
          children: busy ? "Running\u2026" : "Run"
        })
      ),
      el("div", {
        className: "nb-hint",
        style: { lineHeight: 1.5 },
        children: "Every command runs over ssh on that host. The output and exit code above are the real ones, and each call is appended to the audit log."
      })
    )
  );
}
function FilesTab({ host: host2 }) {
  const [path, setPath] = (0, import_react.useState)("/home");
  const [state, setState] = (0, import_react.useState)({ loading: true, entries: [], parent: "/", error: "" });
  const [open, setOpen] = (0, import_react.useState)(null);
  const load = (0, import_react.useCallback)(async (p) => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const out = await api(`/ops/files?${qs({ host: host2.id, path: p })}`, { timeoutMs: 45e3 });
      setState({ loading: false, entries: out.entries || [], parent: out.parent || "/", error: "" });
      setPath(out.path || p);
    } catch (e) {
      setState({ loading: false, entries: [], parent: "/", error: e.message || String(e) });
    }
  }, [host2.id]);
  (0, import_react.useEffect)(() => {
    load(path);
  }, [load]);
  const readFile = async (name) => {
    const full = path.endsWith("/") ? path + name : `${path}/${name}`;
    try {
      const out = await api(`/ops/file?${qs({ host: host2.id, path: full, bytes: 6e4 })}`, { timeoutMs: 45e3 });
      setOpen({ name, text: out.text || "", size: out.size, truncated: out.truncated });
    } catch (e) {
      setOpen({ name, text: e.message || String(e), error: true });
    }
  };
  return el(
    "div",
    { className: "nb-view" },
    el(
      "div",
      { className: "nb-view-head" },
      (0, import_jsx_runtime.jsx)(IconBtn, { icon: "arrowLeft", label: "Parent directory", onClick: () => load(state.parent) }),
      el(
        "div",
        { className: "nb-field", style: { flex: 1, height: "32px" } },
        (0, import_jsx_runtime.jsx)(Glyph, { name: "folder", size: 13 }),
        el("input", {
          value: path,
          onChange: (e) => setPath(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") load(path);
          },
          "aria-label": "Directory path",
          spellCheck: false
        })
      ),
      (0, import_jsx_runtime.jsx)(IconBtn, { icon: "refresh", label: "Reload directory", onClick: () => load(path) })
    ),
    el(
      "div",
      { className: "nb-scroll" },
      state.error ? el("div", { className: "nb-pad", style: { color: T.danger }, children: state.error }) : el(
        "div",
        { className: "nb-pad" },
        el(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "1px" } },
          state.entries.map((e) => el("button", {
            type: "button",
            onClick: () => e.dir ? load(path.endsWith("/") ? path + e.name : `${path}/${e.name}`) : readFile(e.name),
            style: {
              display: "grid",
              gridTemplateColumns: "18px 1fr 76px 96px",
              gap: "10px",
              alignItems: "center",
              minHeight: "30px",
              padding: "4px 8px",
              borderRadius: "7px",
              border: 0,
              background: "transparent",
              color: T.text,
              cursor: "pointer",
              textAlign: "left",
              fontSize: "14px"
            },
            children: [
              el(
                "span",
                { style: { color: e.dir ? T.accent : T.text4, display: "grid", placeItems: "center" } },
                (0, import_jsx_runtime.jsx)(Glyph, { name: e.dir ? "folder" : "file", size: 13 })
              ),
              el("span", { style: { color: e.dir ? T.text : T.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: e.name }),
              el("span", {
                className: "nb-mono",
                style: { fontSize: "11.5px", color: T.text4, textAlign: "right" },
                children: e.dir ? "dir" : nfmt(e.size)
              }),
              el("span", {
                className: "nb-mono",
                style: { fontSize: "11.5px", color: T.text4, textAlign: "right" },
                children: e.mtime ? ago(new Date(e.mtime * 1e3).toISOString()) : ""
              })
            ]
          }, e.name))
        )
      )
    ),
    open ? el(
      "div",
      { style: { borderTop: `1px solid ${T.line}`, padding: "12px 16px", maxHeight: "38%", overflow: "auto" } },
      el(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" } },
        el("span", { className: "nb-chip", "data-tone": open.error ? "danger" : void 0, children: open.name }),
        open.size ? el("span", { className: "nb-hint", children: `${nfmt(open.size)} bytes${open.truncated ? " \xB7 truncated" : ""}` }) : null,
        el("span", { style: { flex: 1 } }),
        (0, import_jsx_runtime.jsx)(IconBtn, { icon: "close", label: "Close file", onClick: () => setOpen(null) })
      ),
      el("pre", {
        className: "nb-mono",
        style: { whiteSpace: "pre-wrap", fontSize: "13px", lineHeight: 1.55, color: T.text2, margin: 0 },
        children: open.text
      })
    ) : null
  );
}
function SnapshotsTab({ host: host2, onSay }) {
  const [vmid, setVmid] = (0, import_react.useState)("100");
  const [state, setState] = (0, import_react.useState)({ loading: false, list: [], raw: "", error: "" });
  const [name, setName] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const load = (0, import_react.useCallback)(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const out = await api(`/ops/snapshots?${qs({ host: host2.id, vmid })}`, { timeoutMs: 6e4 });
      setState({ loading: false, list: out.snapshots || [], raw: out.raw || "", error: out.ok ? "" : out.raw || "qm refused" });
    } catch (e) {
      setState({ loading: false, list: [], raw: "", error: e.message || String(e) });
    }
  }, [host2.id, vmid]);
  const create = async () => {
    setBusy(true);
    try {
      const out = await api("/ops/snapshot", { method: "POST", body: { host: host2.id, vmid, name }, timeoutMs: 2e5 });
      if (onSay) onSay(`snapshot ${out.label} ${out.ok ? "created" : "failed"}`);
      await load();
    } catch (e) {
      if (onSay) onSay(e.message || "snapshot failed");
      setState((s) => ({ ...s, error: e.message || String(e) }));
    } finally {
      setBusy(false);
    }
  };
  return el(
    "div",
    { className: "nb-view" },
    el(
      "div",
      { className: "nb-view-head" },
      el("span", { className: "nb-meta", children: "VMID" }),
      el(
        "div",
        { className: "nb-field", style: { width: "110px", height: "32px" } },
        el("input", { value: vmid, onChange: (e) => setVmid(e.target.value.replace(/\D/g, "")), "aria-label": "VM id" })
      ),
      (0, import_jsx_runtime.jsx)(Btn, { size: "sm", icon: "refresh", onClick: load, children: "List" }),
      el("div", { style: { flex: 1 } }),
      el(
        "div",
        { className: "nb-field", style: { width: "200px", height: "32px" } },
        el("input", { value: name, onChange: (e) => setName(e.target.value), placeholder: "snapshot name", "aria-label": "Snapshot name" })
      ),
      (0, import_jsx_runtime.jsx)(Btn, {
        size: "sm",
        variant: "primary",
        icon: "camera",
        onClick: create,
        disabled: busy,
        children: busy ? "Snapshotting\u2026" : "Create"
      })
    ),
    el(
      "div",
      { className: "nb-scroll" },
      state.error ? el("div", { className: "nb-pad", style: { color: T.danger, fontSize: "13.5px" }, children: state.error }) : el(
        "div",
        { className: "nb-pad" },
        state.loading ? el("span", { className: "nb-hint", children: "asking qm\u2026" }) : state.list.length ? el(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "4px" } },
          state.list.map((s) => el(
            "div",
            {
              key: s,
              style: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", border: `1px solid ${T.lineSoft}`, borderRadius: "9px", background: T.card }
            },
            (0, import_jsx_runtime.jsx)(Glyph, { name: "camera", size: 14 }),
            el("span", { style: { fontSize: "14.5px", fontWeight: 560 }, children: s }),
            el("span", { style: { flex: 1 } }),
            el("span", { className: "nb-chip", children: `vm ${vmid}` })
          ))
        ) : el("div", { className: "nb-hint", children: "no snapshots for this VM \u2014 name one above and create it" })
      ),
      state.raw ? el("pre", { className: "nb-mono", style: { marginTop: "12px", fontSize: "12px", color: T.text4, whiteSpace: "pre-wrap" }, children: state.raw }) : null
    )
  );
}
function AuditTab({ onSay }) {
  const [state, setState] = (0, import_react.useState)({ loading: true, entries: [], error: "" });
  const load = (0, import_react.useCallback)(async () => {
    try {
      const out = await api("/ops/audit?limit=40", { timeoutMs: 3e4 });
      setState({ loading: false, entries: out.entries || [], error: "" });
    } catch (e) {
      setState({ loading: false, entries: [], error: e.message || String(e) });
    }
  }, []);
  (0, import_react.useEffect)(() => {
    load();
  }, [load]);
  return el(
    "div",
    { className: "nb-view" },
    el(
      "div",
      { className: "nb-view-head" },
      el("span", { className: "nb-meta", children: "Action log" }),
      el("span", { className: "nb-chip", children: `${state.entries.length} entries` }),
      el("span", { style: { flex: 1 } }),
      (0, import_jsx_runtime.jsx)(IconBtn, { icon: "refresh", label: "Reload the audit log", onClick: load })
    ),
    el(
      "div",
      { className: "nb-scroll" },
      state.error ? el("div", { className: "nb-pad", style: { color: T.danger }, children: state.error }) : el(
        "div",
        { className: "nb-pad", style: { display: "flex", flexDirection: "column", gap: "6px" } },
        state.entries.map((e, i) => el(
          "div",
          {
            key: `e${i}`,
            style: { border: `1px solid ${T.lineSoft}`, borderRadius: "9px", padding: "9px 11px", background: T.card }
          },
          el(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
            el("span", { className: "nb-chip", "data-tone": e.ok ? "ok" : "danger", children: e.ok ? "ok" : "failed" }),
            el("span", { className: "nb-chip", children: e.action }),
            el("span", { className: "nb-chip", children: e.host }),
            el("span", { className: "nb-mono", style: { fontSize: "11.5px", color: T.text4 }, children: e.at }),
            el("span", { style: { flex: 1 } }),
            el("span", { className: "nb-mono", style: { fontSize: "11.5px", color: T.text4 }, children: `exit ${e.code ?? "?"} \xB7 ${e.ms || 0}ms` })
          ),
          el("div", {
            className: "nb-mono",
            style: { marginTop: "6px", fontSize: "12.5px", color: T.text2, whiteSpace: "pre-wrap", maxHeight: "90px", overflow: "hidden" },
            children: `$ ${e.cmd || e.target}
${(e.out || e.err || "").slice(0, 500)}`
          })
        ))
      )
    )
  );
}
function contribute(ctx, id, area, payload) {
  try {
    if (typeof ctx.register === "function") {
      const out = ctx.register({ id, area, data: payload, render: payload.render });
      return out;
    }
    if (typeof ctx.contribution === "function") return ctx.contribution(area, payload);
  } catch (e) {
    try {
      console.warn(`[${ID}] area ${area} failed:`, e && e.message ? e.message : e);
    } catch {
    }
  }
  return void 0;
}
function StatusChip() {
  const [counts, setCounts] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    let live = true;
    api("/state").then((d) => {
      if (!live) return;
      const nb = d.notebook;
      setCounts(nb ? { sources: nb.stats.sources, artifacts: nb.stats.artifacts } : null);
    }).catch(() => {
      if (live) setCounts(null);
    });
    return () => {
      live = false;
    };
  }, []);
  return el("button", {
    type: "button",
    title: counts ? `${counts.sources} sources \xB7 ${counts.artifacts} artifacts` : "Hermes Notebook",
    "aria-label": "Open Hermes Notebook",
    onClick: () => host.navigate(ROUTE),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      minHeight: "24px",
      padding: "0 6px",
      border: 0,
      background: "transparent",
      cursor: "pointer",
      color: "var(--ui-text-tertiary)",
      fontSize: "11.5px",
      fontFamily: "var(--ui-font-mono, ui-monospace, monospace)"
    },
    children: [
      el("span", {
        style: {
          width: "6px",
          height: "6px",
          borderRadius: "99px",
          background: counts ? "var(--ui-success, #3fb950)" : "var(--ui-text-quaternary)"
        }
      }),
      counts ? `nb ${counts.sources}/${counts.artifacts}` : "notebook"
    ]
  });
}
function SettingsPage() {
  const [surface, setSurface] = (0, import_react.useState)(() => persist.get("mode", "studio"));
  const [chip, setChip] = (0, import_react.useState)(() => persist.get("statusChip", true));
  const [state, setState] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    api("/health").then(setState).catch(() => setState(null));
  }, []);
  const rows = [];
  if (ListRow) {
    rows.push((0, import_jsx_runtime.jsx)(ListRow, {
      key: "surface",
      title: "Default surface",
      description: "Which half of the plugin opens first: the research studio, or the lab deck.",
      action: SegmentedControl ? (0, import_jsx_runtime.jsx)(SegmentedControl, {
        value: surface,
        onChange: (v) => {
          setSurface(v);
          persist.set("mode", v);
        },
        items: [{ value: "studio", label: "Studio" }, { value: "ops", label: "Lab Ops" }]
      }) : null
    }));
  }
  if (ToggleRow) {
    rows.push((0, import_jsx_runtime.jsx)(ToggleRow, {
      key: "chip",
      label: "Status-bar chip",
      description: "Show the active notebook\u2019s source and artifact counts in the status bar.",
      checked: chip,
      onChange: (on) => {
        setChip(on);
        persist.set("statusChip", on);
      }
    }));
  }
  if (ListRow) {
    rows.push((0, import_jsx_runtime.jsx)(ListRow, {
      key: "data",
      title: "Notebook store",
      description: state && state.data_root ? el("span", { className: "nb-mono", style: { fontSize: "12px" }, children: state.data_root }) : "backend not reachable from this window",
      hint: state && state.model_ready ? "model bound \u2014 answers and artifacts run through your provider" : "the agent half is not registered in this process (enable the plugin, restart the gateway)"
    }));
    rows.push((0, import_jsx_runtime.jsx)(ListRow, {
      key: "kinds",
      title: "Studio outputs",
      description: (state && state.kinds ? state.kinds : KINDS_FALLBACK).map((k) => String(k).replace(/_/g, " ")).join(" \xB7 ")
    }));
  }
  return el("div", { style: { display: "flex", flexDirection: "column" } }, rows);
}
var KINDS_FALLBACK = [
  "video_overview",
  "audio_overview",
  "summary",
  "briefing_doc",
  "study_guide",
  "faq",
  "timeline",
  "mind_map",
  "flashcards",
  "quiz",
  "slides",
  "infographic"
];
function NotebookDirective({ attrs }) {
  const name = String(attrs && (attrs.name || attrs.notebook) || "").slice(0, 120);
  if (!name) return null;
  return el(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        margin: "8px 0",
        padding: "10px 12px",
        borderRadius: "10px",
        border: `1px solid ${T.line}`,
        background: T.card
      }
    },
    el("span", { className: "nb-mark", style: { width: "24px", height: "24px" } }, (0, import_jsx_runtime.jsx)(Glyph, { name: "notebook", size: 13 })),
    el(
      "div",
      { style: { minWidth: 0, flex: 1 } },
      el("div", { style: { fontSize: "14px", fontWeight: 600 }, children: name }),
      el("div", { style: { fontSize: "12.5px", color: T.text3 }, children: "notebook \xB7 open the studio" })
    ),
    el("button", {
      type: "button",
      className: "nb-btn",
      "data-size": "sm",
      onClick: () => host.navigate(ROUTE),
      children: "Open"
    })
  );
}
var plugin = {
  id: ID,
  name: "Notebook",
  description: "Ground sources into cited answers and study artifacts, and drive the lab fleet from the same window.",
  defaultEnabled: false,
  register(ctx) {
    setCtx(ctx);
    const shells = [
      ["route", ROUTES_AREA, { path: ROUTE }, () => (0, import_jsx_runtime.jsx)(App, {})],
      ["nav", SIDEBAR_NAV_AREA, { path: ROUTE, label: "Notebook", codicon: "notebook" }, void 0],
      [
        "status",
        STATUSBAR_AREAS ? STATUSBAR_AREAS.right : "statusBar.right",
        { order: 118 },
        () => (0, import_jsx_runtime.jsx)(StatusChip, {})
      ],
      ["palette-studio", PALETTE_AREA, {
        id: "notebook.open",
        label: "Notebook: open the studio",
        keywords: ["notebook", "studio", "sources", "research"],
        run: () => host.navigate(ROUTE)
      }, void 0],
      ["palette-ops", PALETTE_AREA, {
        id: "notebook.ops",
        label: "Notebook: open the lab deck",
        keywords: ["lab", "fleet", "ops", "homelab", "servers"],
        run: () => host.navigate(`${ROUTE}?surface=ops`)
      }, void 0],
      ["palette-ask", PALETTE_AREA, {
        id: "notebook.ask",
        label: "Notebook: ask the active notebook",
        keywords: ["ask", "notebook", "citation", "grounded"],
        run: () => {
          host.navigate(ROUTE);
          if (host.composer && host.composer.setDraft) {
            host.composer.setDraft(null, "Ask my active Hermes notebook a question grounded in its sources");
          }
        }
      }, void 0]
    ];
    for (const [id, area, data, render] of shells) {
      contribute(ctx, id, area, render ? { ...data, render } : data);
    }
    contribute(ctx, "directive", "transcript.directives", {
      name: "notebook",
      render: ({ attrs }) => (0, import_jsx_runtime.jsx)(NotebookDirective, { attrs })
    });
    try {
      if (typeof ctx.registerSettingsPage === "function") {
        ctx.registerSettingsPage({
          id: "notebook.settings",
          title: "Notebook",
          description: "Sources, studio outputs and the lab deck.",
          render: () => (0, import_jsx_runtime.jsx)(SettingsPage, {})
        });
      }
    } catch (e) {
      try {
        console.warn("[hermes-notebook] settings page not registered:", e);
      } catch {
      }
    }
  }
};
var entry_default = plugin;
export {
  App,
  CSS,
  KIND_ICON,
  Markdown,
  OpsDeck,
  Rail,
  StudioPanel,
  Viewer,
  entry_default as default
};
/*! Bundled license information:

react/cjs/react.development.js:
  (**
   * @license React
   * react.development.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react-jsx-runtime.development.js:
  (**
   * @license React
   * react-jsx-runtime.development.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/

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

// ../hermes-webapp/node_modules/react/cjs/react.development.js
var require_react_development = __commonJS({
  "../hermes-webapp/node_modules/react/cjs/react.development.js"(exports, module) {
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
          var ioInfo = payload._ioInfo;
          null != ioInfo && (ioInfo.start = ioInfo.end = performance.now());
          ioInfo = payload._result;
          var thenable = ioInfo();
          thenable.then(
            function(moduleObject) {
              if (0 === payload._status || -1 === payload._status) {
                payload._status = 1;
                payload._result = moduleObject;
                var _ioInfo = payload._ioInfo;
                null != _ioInfo && (_ioInfo.end = performance.now());
                void 0 === thenable.status && (thenable.status = "fulfilled", thenable.value = moduleObject);
              }
            },
            function(error) {
              if (0 === payload._status || -1 === payload._status) {
                payload._status = 2;
                payload._result = error;
                var _ioInfo2 = payload._ioInfo;
                null != _ioInfo2 && (_ioInfo2.end = performance.now());
                void 0 === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            }
          );
          ioInfo = payload._ioInfo;
          if (null != ioInfo) {
            ioInfo.value = thenable;
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
      var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo"), REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = /* @__PURE__ */ Symbol.for("react.activity"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, didWarnStateUpdateForUnmountedComponent = {}, ReactNoopUpdateQueue = {
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
        var propName = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        return ReactElement(
          type,
          key,
          i,
          getOwner(),
          propName ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
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
      exports.startTransition = function(scope) {
        var prevTransition = ReactSharedInternals.T, currentTransition = {};
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
      };
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
      exports.version = "19.2.7";
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
    })();
  }
});

// ../hermes-webapp/node_modules/react/index.js
var require_react = __commonJS({
  "../hermes-webapp/node_modules/react/index.js"(exports, module) {
    "use strict";
    if (false) {
      module.exports = null;
    } else {
      module.exports = require_react_development();
    }
  }
});

// ../hermes-webapp/node_modules/react/cjs/react-jsx-runtime.development.js
var require_react_jsx_runtime_development = __commonJS({
  "../hermes-webapp/node_modules/react/cjs/react-jsx-runtime.development.js"(exports) {
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
      var React2 = require_react(), REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo"), REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = /* @__PURE__ */ Symbol.for("react.activity"), REACT_CLIENT_REFERENCE = /* @__PURE__ */ Symbol.for("react.client.reference"), ReactSharedInternals = React2.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
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
        return jsxDEVImpl(
          type,
          config,
          maybeKey,
          false,
          trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
          trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask
        );
      };
      exports.jsxs = function(type, config, maybeKey) {
        var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        return jsxDEVImpl(
          type,
          config,
          maybeKey,
          true,
          trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
          trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask
        );
      };
    })();
  }
});

// ../hermes-webapp/node_modules/react/jsx-runtime.js
var require_jsx_runtime = __commonJS({
  "../hermes-webapp/node_modules/react/jsx-runtime.js"(exports, module) {
    "use strict";
    if (false) {
      module.exports = null;
    } else {
      module.exports = require_react_jsx_runtime_development();
    }
  }
});

// tests/tmp/load-WdK5rH/sdk.mjs
var ROUTES_AREA = "routes";
var SIDEBAR_NAV_AREA = "sidebar.nav";
var PALETTE_AREA = "palette";
var STATUSBAR_AREAS = { left: "statusBar.left", right: "statusBar.right" };
var ListRow = () => null;
var ToggleRow = () => null;
var SegmentedControl = () => null;
var host = { navigate: () => {
}, request: async () => ({}), composer: {} };

// tests/tmp/load-WdK5rH/entry.mjs
var import_react = __toESM(require_react(), 1);
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
var host2 = host;
var ROUTES_AREA2 = ROUTES_AREA || "routes";
var SIDEBAR_NAV_AREA2 = SIDEBAR_NAV_AREA || "sidebar.nav";
var PALETTE_AREA2 = PALETTE_AREA || "palette";
var STATUSBAR_AREAS2 = STATUSBAR_AREAS || { left: "statusBar.left", right: "statusBar.right" };
var TRANSCRIPT_DIRECTIVE_AREA2 = void 0 || "transcript.directives";
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
/* ============================================================================
   SYSTEM: "Studio" \u2014 NotebookLM-soft.
   Cards, pills and previews instead of rules and plates: every surface is a
   rounded, softly-elevated card; controls are pills; the twelve studio outputs
   each carry their own colour (--kc) and show a real thumbnail once generated.
   Values resolve through the app's theme variables so the page follows the
   user's light/dark theme and accent; media stages and the terminal pin a dark
   surface in both themes, the way a player does.
   ========================================================================== */

.nb-root{
  --nb-rail: 300px; --nb-studio: 396px;
  --nb-hair: color-mix(in srgb, ${T.text} 10%, transparent);
  --nb-hair-soft: color-mix(in srgb, ${T.text} 6%, transparent);
  --nb-wash: color-mix(in srgb, ${T.text} 4%, transparent);
  --nb-wash-2: color-mix(in srgb, ${T.text} 7.5%, transparent);
  --nb-card: ${T.card};
  --nb-shadow: 0 1px 2px rgba(8,10,18,.05), 0 14px 34px -20px rgba(8,10,18,.30);
  --nb-shadow-lift: 0 2px 6px rgba(8,10,18,.07), 0 20px 44px -18px rgba(8,10,18,.38);
  --nb-media: linear-gradient(155deg,#20243a 0%,#12151f 100%);
  display:flex; flex-direction:column; height:100%; min-height:0;
  color:${T.text}; font-size:16px; line-height:1.5;
  font-variant-numeric: tabular-nums;
}
.nb-root *{box-sizing:border-box}
.nb-root :focus-visible{outline:2px solid ${T.accent}; outline-offset:2px; border-radius:8px}
.nb-mono{font-family:var(--ui-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-variant-ligatures:none}
.nb-num{font-family:var(--ui-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-variant-numeric:tabular-nums}

/* quiet section label \u2014 small and calm, never telemetry */
.nb-meta{font-size:12px;letter-spacing:0;text-transform:none;color:${T.text3};font-weight:600}
.nb-hint{font-size:11.5px;color:${T.text3};letter-spacing:.01em;line-height:1.5}

/* ------------------------------------------------------------------ app bar */
.nb-bar{display:flex;align-items:center;gap:14px;height:56px;flex:0 0 56px;
  padding:0 18px;border-bottom:1px solid var(--nb-hair-soft)}
.nb-brand{display:flex;align-items:center;gap:11px;min-width:0}
.nb-mark{width:27px;height:27px;display:grid;place-items:center;flex:0 0 auto;border-radius:9px;
  background:color-mix(in srgb,${T.accent} 15%, transparent);color:${T.accent}}
.nb-brandname{font-size:14.5px;font-weight:700;letter-spacing:-.01em;color:${T.text}}
.nb-crumb{font-size:12.5px;color:${T.text3};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42ch}
.nb-crumb b{color:${T.text2};font-weight:600}
.nb-spacer{flex:1 1 auto}
.nb-actions{display:flex;align-items:center;gap:8px}

/* ---------------------------------------------------------------- controls */
.nb-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:36px;padding:0 18px;border-radius:99px;cursor:pointer;
  font-size:13px;font-weight:600;letter-spacing:0;text-transform:none;font-family:inherit;
  border:1px solid var(--nb-hair);background:var(--nb-wash);color:${T.text};
  transition:background .14s ease,border-color .14s ease,box-shadow .14s ease,transform .1s ease}
.nb-btn:hover{background:var(--nb-wash-2);border-color:color-mix(in srgb,${T.text} 22%, transparent)}
.nb-btn:active{transform:translateY(1px)}
.nb-btn[disabled]{opacity:.45;cursor:not-allowed}
.nb-btn[data-variant=primary]{background:${T.accent};border-color:transparent;color:#0d0e15;font-weight:650;
  box-shadow:0 6px 18px -8px color-mix(in srgb,${T.accent} 80%, transparent)}
.nb-btn[data-variant=primary]:hover{background:color-mix(in srgb,${T.accent} 88%, ${T.text})}
.nb-btn[data-variant=primary][disabled]{background:var(--nb-wash);border-color:var(--nb-hair);color:${T.text3};box-shadow:none}
.nb-btn[data-variant=ghost]{background:transparent;border-color:transparent;color:${T.text2}}
.nb-btn[data-variant=ghost]:hover{background:var(--nb-wash-2);color:${T.text}}
.nb-btn[data-size=sm]{min-height:32px;padding:0 12px;font-size:12.5px;border-radius:9px}
.nb-icon{width:36px;height:36px;min-height:36px;padding:0;border-radius:99px;display:grid;place-items:center;
  cursor:pointer;border:1px solid transparent;background:transparent;color:${T.text3};
  transition:background .13s ease,color .13s ease,border-color .13s ease}
.nb-icon:hover{background:var(--nb-wash-2);color:${T.text}}
.nb-icon[data-active=true]{background:color-mix(in srgb,${T.accent} 14%, transparent);color:${T.accent}}

/* segmented control \u2014 a pill track with a lifted thumb */
.nb-seg{display:inline-flex;gap:2px;padding:3px;border-radius:13px;
  border:1px solid var(--nb-hair);background:var(--nb-wash)}
.nb-seg[data-fill="true"]{display:flex;width:100%}
.nb-seg[data-fill="true"] > button{flex:1;justify-content:center}
.nb-seg > button{min-height:32px;padding:0 14px;border:0;border-radius:10px;background:transparent;
  color:${T.text3};cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;letter-spacing:0;
  display:inline-flex;align-items:center;justify-content:center;gap:7px;
  transition:background .13s ease,color .13s ease,box-shadow .13s ease}
.nb-seg > button:hover{color:${T.text};background:color-mix(in srgb,${T.text} 6%, transparent)}
.nb-seg > button[aria-selected=true]{background:${T.card};color:${T.text};box-shadow:var(--nb-shadow)}

.nb-field{display:flex;align-items:center;gap:9px;height:38px;padding:0 12px;border-radius:12px;
  border:1px solid var(--nb-hair);background:var(--nb-wash);color:${T.text3}}
.nb-field:focus-within{border-color:color-mix(in srgb,${T.accent} 55%, transparent);
  box-shadow:0 0 0 3px color-mix(in srgb,${T.accent} 16%, transparent)}
.nb-field input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;
  color:${T.text};font-size:14px;font-family:inherit}
.nb-field input::placeholder{color:${T.text4}}

/* ------------------------------------------------------------------- body */
/* NotebookLM's spatial model: the canvas stays dark, the three surfaces are
   floating rounded panels with real gaps between them. */
.nb-body{flex:1 1 auto;display:flex;gap:12px;min-height:0;overflow:hidden;
  padding:12px}
.nb-col{min-width:0;min-height:0;display:flex;flex-direction:column;position:relative}
.nb-body > .nb-col{background:var(--nb-card);border:1px solid var(--nb-hair-soft);
  border-radius:24px;overflow:hidden}
.nb-rail{flex:0 0 var(--nb-rail)}
.nb-main-col{flex:1 1 auto}
.nb-studio{flex:0 0 var(--nb-studio)}
.nb-fade{position:absolute;left:0;right:0;bottom:0;height:44px;pointer-events:none;
  background:linear-gradient(to top, color-mix(in srgb, ${T.text} 6%, ${T.card}), transparent)}
.nb-pane-head{display:flex;align-items:center;gap:8px;height:52px;flex:0 0 52px;padding:0 18px}
.nb-pane-title{font-size:15px;font-weight:650;letter-spacing:-.01em;color:${T.text}}
.nb-pane-head .nb-meta{flex:1}
.nb-scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin}
.nb-pad{padding:12px 14px}

/* ------------------------------------------------------------------- rail */
.nb-nbrow{display:flex;align-items:center;gap:12px;width:100%;
  text-align:left;cursor:pointer;border:0;border-radius:13px;background:transparent;
  padding:9px 10px;color:${T.text};transition:background .12s ease}
.nb-nbrow:hover{background:var(--nb-wash-2)}
.nb-nbrow[aria-current=true]{background:color-mix(in srgb,${T.accent} 11%, transparent)}
.nb-nbtitle{font-size:13.5px;font-weight:600;line-height:1.32;color:${T.text2};letter-spacing:-.005em;
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.nb-nbrow[aria-current=true] .nb-nbtitle{color:${T.text}}
.nb-nbsub{font-size:11.5px;color:${T.text3};margin-top:2px;display:block}
.nb-avatar{width:36px;height:36px;flex:0 0 auto;display:grid;place-items:center;border-radius:11px;
  background:var(--nb-wash-2);color:${T.text2};font-size:13px;font-weight:700}
.nb-nbrow[aria-current=true] .nb-avatar{background:color-mix(in srgb,${T.accent} 20%, transparent);color:${T.accent}}

.nb-src{display:flex;align-items:center;gap:4px;width:100%;border-radius:13px;
  padding:5px 8px 5px 5px;position:relative;transition:background .12s ease}
.nb-src:hover{background:var(--nb-wash-2)}
.nb-src[data-on=true]{background:color-mix(in srgb,${T.accent} 10%, transparent)}
.nb-src[data-off=true]{opacity:.55}
.nb-src-open{flex:1;min-width:0;display:grid;grid-template-columns:36px minmax(0,1fr);gap:11px;
  align-items:center;text-align:left;background:transparent;border:0;padding:4px;border-radius:11px;
  color:${T.text};cursor:pointer;font-family:inherit}
.nb-src-ico{position:relative;width:36px;height:36px;border-radius:11px;display:grid;place-items:center;
  background:var(--nb-wash-2);color:${T.text2};flex:0 0 auto}
.nb-src[data-on=true] .nb-src-ico{background:color-mix(in srgb,${T.accent} 18%, transparent);color:${T.accent}}
/* the citation number rides the icon's corner, like a source badge */
.nb-cite{position:absolute;right:-6px;bottom:-6px;min-width:18px;height:18px;padding:0 5px;
  border-radius:99px;display:grid;place-items:center;background:${T.accent};color:#0d0e15;
  font-size:10px;font-weight:700;
  box-shadow:0 1px 4px rgba(8,10,18,.4)}
.nb-src-title{font-size:13px;font-weight:600;line-height:1.35;color:${T.text};
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.nb-src-meta{display:flex;align-items:center;gap:6px;margin-top:5px;flex-wrap:wrap}
/* NotebookLM's per-source checkbox: a rounded box at the row's right edge */
.nb-srccheck{width:32px;height:32px;flex:0 0 auto;border-radius:10px;cursor:pointer;
  border:1.5px solid var(--nb-hair);background:transparent;color:#0d0e15;
  display:grid;place-items:center;padding:0;transition:all .13s ease}
.nb-srccheck:hover{border-color:color-mix(in srgb,${T.accent} 55%, transparent)}
.nb-srccheck[aria-checked=true]{background:${T.accent};border-color:${T.accent}}
.nb-selall{display:flex;align-items:center;gap:9px;padding:2px 6px}
.nb-selall .nb-srccheck{width:32px;height:32px;border-radius:10px}
.nb-srcgroup{display:flex;align-items:center;gap:8px;width:100%;text-align:left;
  padding:9px 10px;border:0;border-radius:11px;background:transparent;color:${T.text3};
  font-size:12px;font-weight:650;letter-spacing:.01em;cursor:pointer;font-family:inherit}
.nb-srcgroup:hover{background:var(--nb-wash-2);color:${T.text2}}
.nb-srcgroup svg{transition:transform .15s ease}
.nb-srcgroup[data-closed=true] svg{transform:rotate(-90deg)}
.nb-srcgroup em{margin-left:auto;font-style:normal;font-weight:500;color:${T.text4};font-size:11px}
.nb-srcgroup-list{display:flex;flex-direction:column;gap:2px;padding-left:14px}

/* the web-research box inside the sources panel */
.nb-finder{margin:0 14px 10px;border-radius:16px;border:1px solid var(--nb-hair-soft);
  background:var(--nb-wash);padding:10px}
.nb-finder-row{display:flex;align-items:center;gap:8px}
.nb-finder-row input{flex:1;min-width:0;height:34px;border:0;outline:0;background:transparent;
  color:${T.text};font-size:13px;font-family:inherit}
.nb-finder-row input::placeholder{color:${T.text4}}
.nb-finder-go{width:32px;height:32px;flex:0 0 auto;border-radius:99px;border:0;cursor:pointer;
  background:${T.accent};color:#0d0e15;display:grid;place-items:center;padding:0}
.nb-addsrc{width:100%;justify-content:flex-start}
.nb-paneltog{flex:0 0 44px;display:flex;flex-direction:column;align-items:center;
  gap:10px;padding-top:16px}
.nb-finder-go[disabled]{opacity:.45;cursor:not-allowed}
.nb-fcand[disabled]{cursor:default}
.nb-fcand[disabled]:not([data-added=true]){opacity:.55}
.nb-fcand{display:flex;align-items:center;gap:10px;width:100%;text-align:left;
  padding:9px 10px;border-radius:12px;border:0;background:transparent;color:${T.text};
  cursor:pointer;font-family:inherit}
.nb-fcand:hover{background:var(--nb-wash-2)}
.nb-fcand-main{flex:1;min-width:0}
.nb-fcand-title{display:block;font-size:12.5px;font-weight:600;line-height:1.35;color:${T.text};
  overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.nb-fcand-sub{display:block;font-size:11px;color:${T.text3};margin-top:2px;
  overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.nb-fcand-add{width:28px;height:28px;flex:0 0 auto;border-radius:99px;cursor:pointer;
  border:1.5px solid var(--nb-hair);background:transparent;color:${T.text2};
  display:grid;place-items:center;padding:0}
.nb-fcand-add:hover{border-color:${T.accent};color:${T.accent}}
.nb-fcand-add[data-added=true]{background:color-mix(in srgb,${T.ok} 15%, transparent);
  border-color:color-mix(in srgb,${T.ok} 50%, transparent);color:${T.ok};cursor:default}

/* chips are soft pills; clickable ones are full 32px targets */
.nb-chip{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:99px;
  font-size:11px;font-weight:600;letter-spacing:.01em;color:${T.text3};
  background:var(--nb-wash-2);border:1px solid transparent;white-space:nowrap;font-family:inherit}
.nb-chip[data-tone=accent]{color:${T.accent};background:color-mix(in srgb,${T.accent} 13%, transparent)}
.nb-chip[data-tone=ok]{color:${T.ok};background:color-mix(in srgb,${T.ok} 13%, transparent)}
.nb-chip[data-tone=warn]{color:${T.warn};background:color-mix(in srgb,${T.warn} 14%, transparent)}
.nb-chip[data-tone=danger]{color:${T.danger};background:color-mix(in srgb,${T.danger} 13%, transparent)}
.nb-citechip{height:32px;min-height:32px;padding:0 7px 0 9px;border-radius:99px;gap:7px;
  background:var(--nb-card);border-color:var(--nb-hair);color:${T.text2};font-size:12px;font-weight:500}
.nb-citechip:hover{border-color:color-mix(in srgb,${T.accent} 50%, transparent)}
.nb-citechip b{font-family:var(--ui-font-mono,ui-monospace,monospace);color:${T.accent};font-weight:700;
  font-size:10.5px;background:color-mix(in srgb,${T.accent} 14%, transparent);border-radius:99px;
  padding:3px 7px;flex:0 0 auto}
.nb-citechip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:300px}
.nb-chip[data-click=true]{cursor:pointer;min-height:32px;height:32px;padding:0 13px;font-size:12px;
  background:var(--nb-card);border-color:var(--nb-hair)}
.nb-chip[data-click=true]:hover{background:var(--nb-wash-2);color:${T.text};
  border-color:color-mix(in srgb,${T.text} 20%, transparent)}
.nb-chip[data-click=true][aria-pressed=true]{background:color-mix(in srgb,${T.accent} 14%, transparent);
  color:${T.accent};border-color:color-mix(in srgb,${T.accent} 45%, transparent)}

/* discover candidates \u2014 the "find for me" picker inside the add-source sheet */
.nb-cand-list{display:flex;flex-direction:column;gap:8px;max-height:308px;overflow:auto;padding:2px}
.nb-cand{display:flex;gap:11px;align-items:flex-start;width:100%;text-align:left;
  padding:11px 12px;border-radius:13px;border:1px solid var(--nb-hair-soft);
  background:var(--nb-card);cursor:pointer;font-family:inherit;color:inherit}
.nb-cand:hover{border-color:color-mix(in srgb,${T.text} 20%, transparent);background:var(--nb-wash-2)}
.nb-cand[data-on=true]{border-color:color-mix(in srgb,${T.accent} 45%, transparent);
  background:color-mix(in srgb,${T.accent} 8%, transparent)}
.nb-cand-check{width:20px;height:20px;flex:0 0 auto;margin-top:2px;border-radius:7px;
  border:1.5px solid var(--nb-hair);display:grid;place-items:center;color:#0d0e15}
.nb-cand[data-on=true] .nb-cand-check{background:${T.accent};border-color:${T.accent}}
.nb-cand-title{display:block;font-size:13.5px;font-weight:600;line-height:1.35;color:${T.text}}
.nb-cand-sub{display:flex;gap:7px;align-items:flex-start;margin-top:5px;font-size:12px;
  color:${T.text3};line-height:1.5}
.nb-cand-sub .nb-chip{flex:0 0 auto;margin-top:1px}
.nb-cand-sub > span:last-child{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  overflow:hidden;min-width:0}

/* ------------------------------------------------------- title block (main) */
.nb-main-head{padding:24px 30px 0;border-bottom:1px solid var(--nb-hair-soft);flex:0 0 auto;position:relative}
.nb-hero{display:flex;align-items:flex-start;gap:16px;margin-bottom:16px}
.nb-hero-emoji{width:52px;height:52px;flex:0 0 auto;display:grid;place-items:center;font-size:30px;
  border-radius:16px;background:var(--nb-wash-2);border:1px solid var(--nb-hair-soft)}
.nb-hero-main{min-width:0;flex:1}
.nb-hero-main .nb-h1{margin-bottom:6px}
.nb-h1{font-size:27px;font-weight:700;letter-spacing:-.025em;line-height:1.15;margin:0;max-width:30ch;
  text-wrap:balance}
.nb-sub{color:${T.text2};font-size:14px;line-height:1.55;margin:0;max-width:70ch}
.nb-hero-side{display:flex;align-items:center;gap:8px;flex:0 0 auto;padding-top:6px}
/* ops host-measurement strip (Lab Ops only) */
.nb-strip{display:flex;align-items:stretch;gap:8px;margin:14px 0 0;flex-wrap:wrap}
.nb-cell{flex:1;min-width:90px;padding:10px 14px 11px;border-radius:12px;
  border:1px solid var(--nb-hair-soft);background:var(--nb-wash)}
.nb-cell b{display:block;font-size:17px;font-weight:650;letter-spacing:-.02em;
  line-height:1.1;font-variant-numeric:tabular-nums}
.nb-cell span{display:block;font-size:11px;color:${T.text3};margin-top:6px;font-weight:600}
.nb-tabs{display:flex;gap:4px;align-items:flex-end;margin:16px 0 0;position:relative;bottom:-1px}
.nb-tab{min-height:38px;padding:0 14px 11px;border:0;border-bottom:2px solid transparent;
  border-radius:10px 10px 0 0;background:transparent;color:${T.text2};font-size:13.5px;
  font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px;letter-spacing:0;
  font-family:inherit;transition:background .12s ease,color .12s ease}
.nb-tab:hover{color:${T.text};background:var(--nb-wash)}
.nb-tab[aria-selected=true]{color:${T.text};border-bottom-color:${T.accent};background:var(--nb-wash)}
.nb-tab[disabled]{opacity:.45;cursor:default}

/* ------------------------------------------------------------------- chat */
.nb-chat{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
/* conversation bar: the open thread is the page's subject, so it gets the top row */
.nb-chatbar{display:flex;align-items:center;gap:8px;padding:10px 16px 8px;
  border-bottom:1px solid ${T.lineSoft};flex-wrap:nowrap}
.nb-threadpick{display:flex;align-items:center;gap:8px;min-width:0;max-width:min(56ch,72%);
  min-height:34px;padding:4px 8px;border-radius:10px;border:1px solid transparent;
  background:transparent;color:${T.text};font:inherit;font-size:14px;font-weight:600;
  cursor:pointer}
.nb-threadpick:hover{background:${T.inset};border-color:${T.lineSoft}}
.nb-threadpick:focus-visible{outline:2px solid ${T.accent};outline-offset:1px}
.nb-threadpick svg{color:${T.text4};flex:0 0 auto}
.nb-threadpick-title{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nb-newthread{display:flex;gap:8px;align-items:center}
.nb-newthread .nb-genopt-text{flex:1;min-width:0}
.nb-threadlist{display:flex;flex-direction:column;gap:6px;max-height:min(48vh,380px);
  overflow:auto;overscroll-behavior:contain}
.nb-threadrow{display:flex;align-items:center;gap:6px;padding:2px;border-radius:12px;
  border:1px solid ${T.lineSoft};background:${T.card}}
.nb-threadrow[data-on="true"]{border-color:${T.accent};
  background:color-mix(in srgb,${T.accent} 9%,transparent)}
.nb-threadrow-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;
  align-items:flex-start;text-align:left;background:transparent;border:0;cursor:pointer;
  padding:8px 10px;border-radius:10px;color:${T.text};font:inherit;min-height:48px}
.nb-threadrow-main:hover{background:${T.inset}}
.nb-threadrow-main:focus-visible{outline:2px solid ${T.accent};outline-offset:-2px}
.nb-threadrow-title{display:block;font-size:14px;font-weight:600;max-width:100%;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nb-threadrow-meta{display:block;font-size:11.5px;color:${T.text4};line-height:1.2}
.nb-threadrow-acts{display:flex;align-items:center;gap:4px;padding-right:6px}
.nb-threadrow-acts .nb-btn{height:32px}
.nb-threadrow-edit{display:flex;gap:6px;align-items:center;padding-right:8px;flex:1}
.nb-threadrow-edit .nb-genopt-text{flex:1;min-width:0}
.nb-thread{flex:1;min-height:0;overflow:auto;padding:28px 28px 12px;display:flex;flex-direction:column;gap:24px}
.nb-msg{max-width:72ch}
.nb-msg[data-role=assistant]{display:grid;grid-template-columns:30px minmax(0,1fr);gap:14px;align-self:flex-start}
.nb-msg[data-role=user]{align-self:flex-end;max-width:62ch}
.nb-msg-body{min-width:0}
.nb-msg[data-role=user] .nb-bubble{background:var(--nb-wash-2);border:1px solid var(--nb-hair-soft);
  border-radius:18px;padding:11px 17px;font-size:15px;line-height:1.55;color:${T.text}}
.nb-msg[data-role=assistant] .nb-bubble{font-size:16px;line-height:1.66;color:${T.text}}
.nb-msg[data-role=assistant] .nb-avatar{width:30px;height:30px;margin-top:2px}
.nb-avatar{width:36px;height:36px;flex:0 0 auto;display:grid;place-items:center;border-radius:11px;
  background:var(--nb-wash-2);color:${T.text2};font-size:13px;font-weight:700}
.nb-nbrow[aria-current=true] .nb-avatar{background:color-mix(in srgb,${T.accent} 20%, transparent);color:${T.accent}}
.nb-msg .nb-avatar{width:30px;height:30px;border-radius:99px;
  background:color-mix(in srgb,${T.accent} 16%, transparent);color:${T.accent};font-size:11px;letter-spacing:.02em}
.nb-who{font-size:11.5px;letter-spacing:.02em;color:${T.text3};font-weight:600;margin-bottom:8px}
.nb-msg[data-role=user] .nb-who{color:${T.text4}}
.nb-md p{margin:0 0 11px}
.nb-md p:last-child{margin-bottom:0}
.nb-md h2{font-size:17px;margin:20px 0 8px;letter-spacing:-.015em}
.nb-md h3{font-size:15px;margin:16px 0 6px;color:${T.text2};font-weight:700}
.nb-md ul{margin:0 0 11px;padding-left:20px}
.nb-md li{margin:5px 0}
.nb-md li::marker{color:${T.accent}}
.nb-md code{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:12.5px;
  background:var(--nb-wash-2);padding:1.5px 6px;border-radius:6px}
.nb-md strong{font-weight:650;color:${T.text}}
.nb-md blockquote{margin:12px 0;padding:10px 16px;border-radius:12px;color:${T.text2};
  background:var(--nb-wash);border-left:3px solid color-mix(in srgb,${T.accent} 55%, transparent)}
/* inline citations are quiet accent pills with the source number */
.nb-inline-cite{display:inline-flex;align-items:center;min-height:20px;padding:0 8px;margin:0 2px;
  border-radius:99px;border:1px solid color-mix(in srgb,${T.accent} 30%, transparent);
  background:color-mix(in srgb,${T.accent} 10%, transparent);
  font-size:11px;font-weight:700;letter-spacing:.01em;
  color:${T.accent};cursor:pointer;vertical-align:1px;line-height:1}
.nb-inline-cite:hover{background:color-mix(in srgb,${T.accent} 20%, transparent)}
.nb-composer{flex:0 0 auto;padding:14px 30px 20px}
.nb-askbox{display:flex;flex-direction:column;gap:10px;border:1px solid var(--nb-hair);
  border-radius:26px;background:var(--nb-card);padding:14px 16px;box-shadow:var(--nb-shadow);
  transition:border-color .15s ease,box-shadow .15s ease}
.nb-askbox:focus-within{border-color:color-mix(in srgb,${T.accent} 55%, transparent);
  box-shadow:0 0 0 4px color-mix(in srgb,${T.accent} 15%, transparent), var(--nb-shadow)}
.nb-askbox textarea{width:100%;min-height:44px;max-height:150px;resize:none;border:0;outline:0;
  background:transparent;color:${T.text};font-size:15px;line-height:1.5;font-family:inherit}
.nb-askbox textarea::placeholder{color:${T.text3}}
.nb-askfoot{display:flex;align-items:center;gap:8px}
.nb-sendbtn{width:38px;height:38px;flex:0 0 auto;border-radius:99px;border:0;cursor:pointer;
  background:${T.accent};color:#0d0e15;display:grid;place-items:center;padding:0;
  transition:opacity .13s ease,transform .1s ease}
.nb-sendbtn:hover{transform:scale(1.05)}
.nb-sendbtn[disabled]{opacity:.4;cursor:not-allowed;transform:none}
.nb-disclaimer{font-size:11px;color:${T.text3};text-align:center;margin-top:9px}

/* ------------------------------------------------- overview + suggestions */
.nb-overview{border:1px solid var(--nb-hair-soft);border-radius:18px;background:var(--nb-card);
  padding:18px 20px;display:grid;gap:10px}
.nb-overview-head{display:flex;align-items:center;gap:8px}
.nb-overview-head .nb-meta{flex:1}
.nb-overview-body{font-size:14.5px;line-height:1.66;color:${T.text2}}
.nb-overview-body .nb-md strong{color:${T.text}}
.nb-suggest-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.nb-suggest{display:flex;flex-direction:column;justify-content:space-between;gap:10px;
  min-height:104px;text-align:left;padding:14px;border-radius:16px;cursor:pointer;
  border:1px solid var(--nb-hair-soft);background:var(--nb-card);color:${T.text};
  font-family:inherit;font-size:13px;line-height:1.45;transition:border-color .14s ease,
  background .14s ease,transform .14s ease}
.nb-suggest:hover{border-color:color-mix(in srgb,${T.accent} 45%, transparent);
  background:var(--nb-wash-2);transform:translateY(-1px)}
.nb-suggest-q{font-weight:550}
.nb-suggest-go{color:${T.text4};display:flex;justify-content:flex-end}
.nb-gaprow{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.nb-gaprow .nb-chip[data-click=true]{border-style:dashed}

/* --------------------------------------------------------- studio (index) */
.nb-grid{display:flex;flex-direction:column;gap:10px;padding:12px 14px 26px}
/* the generator bento: compact 2-col pills, each tinted by its kind colour */
.nb-gen-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}

/* each output pill carries its own colour (--kc) */
.nb-card{--kc:${T.accent};
  display:flex;align-items:center;gap:10px;width:100%;padding:11px 12px;
  border:1px solid var(--nb-hair-soft);border-radius:14px;
  background:var(--nb-card);cursor:pointer;text-align:left;color:${T.text};
  transition:background .13s ease,border-color .13s ease,transform .13s ease}
.nb-card:hover{background:var(--nb-wash-2);border-color:color-mix(in srgb,var(--kc) 42%, var(--nb-hair));
  transform:translateY(-1px)}
.nb-card[data-ready=true]{border-color:color-mix(in srgb,var(--kc) 30%, var(--nb-hair-soft))}
.nb-card[data-busy=true]{border-color:color-mix(in srgb,var(--kc) 50%, transparent);
  background:color-mix(in srgb,var(--kc) 6%, var(--nb-card))}
.nb-card-ico{width:32px;height:32px;flex:0 0 auto;border-radius:10px;display:grid;place-items:center;
  background:color-mix(in srgb,var(--kc) 14%, transparent);color:var(--kc)}
.nb-card[data-kind=video_overview],.nb-art[data-kind=video_overview]{--kc:#81c995}
.nb-card[data-kind=audio_overview],.nb-art[data-kind=audio_overview]{--kc:#a8c7fa}
.nb-card[data-kind=summary],.nb-art[data-kind=summary]{--kc:#aecbfa}
.nb-card[data-kind=briefing_doc],.nb-art[data-kind=briefing_doc]{--kc:#f28b82}
.nb-card[data-kind=study_guide],.nb-art[data-kind=study_guide]{--kc:#81c995}
.nb-card[data-kind=faq],.nb-art[data-kind=faq]{--kc:#fde293}
.nb-card[data-kind=timeline],.nb-art[data-kind=timeline]{--kc:#c58af9}
.nb-card[data-kind=mind_map],.nb-art[data-kind=mind_map]{--kc:#c58af9}
.nb-card[data-kind=flashcards],.nb-art[data-kind=flashcards]{--kc:#fde293}
.nb-card[data-kind=quiz],.nb-art[data-kind=quiz]{--kc:#c58af9}
.nb-card[data-kind=slides],.nb-art[data-kind=slides]{--kc:#f28b82}
.nb-card[data-kind=infographic],.nb-art[data-kind=infographic]{--kc:#fde293}
.nb-card-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}
.nb-card-name{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;
  letter-spacing:0;line-height:1.25;color:${T.text}}
.nb-card-name svg{color:var(--kc);flex:0 0 auto}
.nb-card-blurb{display:block;font-size:11px;line-height:1.4;color:${T.text3};
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.nb-card-foot{display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:5px}
.nb-card-state{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;
  font-size:10.5px;font-weight:600;color:${T.text3}}
.nb-card[data-ready=true] .nb-card-state{color:${T.ok};background:color-mix(in srgb,${T.ok} 13%, transparent)}
.nb-card[data-busy=true] .nb-card-state{color:var(--kc);background:color-mix(in srgb,var(--kc) 13%, transparent)}
.nb-dot{width:6px;height:6px;border-radius:99px;background:${T.text4};display:inline-block;flex:0 0 auto}
.nb-card[data-ready=true] .nb-dot{background:${T.ok}}
.nb-card[data-busy=true] .nb-dot{background:var(--kc);animation:nb-pulse 1.2s ease-in-out infinite}
.nb-bar-track{height:4px;margin-top:2px;background:var(--nb-wash-2);border-radius:99px;overflow:hidden;display:block;flex:1;max-width:120px}
.nb-bar-fill{height:100%;background:var(--kc);border-radius:99px;transition:width .4s ease}
@keyframes nb-pulse{0%,100%{opacity:1}50%{opacity:.35}}

/* the generated-artifacts list: tinted icon tile + title + meta */
.nb-artlist{display:flex;flex-direction:column;gap:4px}
.nb-art{display:flex;align-items:center;gap:11px;width:100%;text-align:left;
  padding:8px 10px;border-radius:13px;border:0;background:transparent;color:${T.text};
  cursor:pointer;font-family:inherit;transition:background .12s ease}
.nb-art:hover{background:var(--nb-wash-2)}
.nb-art-ico{width:40px;height:40px;flex:0 0 auto;border-radius:12px;position:relative;overflow:hidden;
  display:grid;place-items:center;
  background:color-mix(in srgb,var(--kc) 13%, transparent);
  color:color-mix(in srgb,var(--kc) 70%, ${T.text});
  border:1px solid color-mix(in srgb,var(--kc) 22%, transparent)}
.nb-art-ico svg{opacity:.9}
.nb-art-main{flex:1;min-width:0}
.nb-art-title{display:block;font-size:13px;font-weight:600;line-height:1.3;color:${T.text};
  overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.nb-art-sub{display:block;font-size:11px;color:${T.text3};margin-top:2px;
  overflow:hidden;white-space:nowrap;text-overflow:ellipsis}

/* thumb content inside the artifact icon tile */
.nb-art-ico .nb-thumb-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.nb-art-ico .nb-thumb-wave{display:flex;align-items:center;gap:1.5px;height:70%;width:80%}
.nb-art-ico .nb-thumb-wave i{flex:1 1 0;min-width:1.5px;border-radius:99px;background:var(--kc);opacity:.8}

/* ----------------------------------------------------------------- viewer */
.nb-view{flex:1;min-height:0;display:flex;flex-direction:column}
.nb-view-head{display:flex;align-items:center;gap:12px;padding:12px 24px;
  border-bottom:1px solid var(--nb-hair-soft)}
.nb-view-title{font-size:15.5px;font-weight:650;letter-spacing:-.01em}
.nb-view-body{flex:1;min-height:0;overflow:auto;padding:26px}
.nb-doc{max-width:70ch;font-size:15.5px;line-height:1.68}
.nb-doc h1{font-size:23px;line-height:1.2;letter-spacing:-.025em;margin:0 0 14px;text-wrap:balance}
.nb-doc em{color:${T.text2}}
.nb-doc hr{border:0;border-top:1px solid var(--nb-hair-soft);margin:22px 0}
.nb-doc h2{font-size:19px;margin:26px 0 10px;letter-spacing:-.02em}
.nb-doc h2:first-child{margin-top:0}
.nb-doc h3{font-size:15px;margin:20px 0 6px;color:${T.text2};font-weight:700}
.nb-doc ul,.nb-doc ol{padding-left:22px;margin:0 0 12px}
.nb-doc li{margin:5px 0}
.nb-doc table{border-collapse:separate;border-spacing:0;width:100%;font-size:14px;margin:14px 0;
  border:1px solid var(--nb-hair-soft);border-radius:12px;overflow:hidden}
.nb-doc th,.nb-doc td{border-bottom:1px solid var(--nb-hair-soft);padding:9px 12px;text-align:left}
.nb-doc td+td,.nb-doc th+th{border-left:1px solid var(--nb-hair-soft)}
.nb-doc tr:last-child td{border-bottom:0}
.nb-doc th{background:var(--nb-wash-2);font-size:11px;letter-spacing:.05em;text-transform:uppercase;
  font-weight:700;color:${T.text2}}
.nb-doc pre{background:var(--nb-wash);border:1px solid var(--nb-hair-soft);border-radius:12px;
  padding:14px;overflow:auto;font-size:13px}

/* -------------------------------------------------------------- stage/media */
.nb-stage{display:flex;flex-direction:column;gap:16px}
.nb-screen{position:relative;overflow:hidden;border-radius:18px;border:1px solid var(--nb-hair);
  background:var(--nb-media);aspect-ratio:16/9;display:grid;place-items:center;box-shadow:var(--nb-shadow)}
.nb-screen video,.nb-screen iframe{width:100%;height:100%;border:0;display:block;background:#000}
.nb-screen-audio{aspect-ratio:auto;padding:22px;display:flex;flex-direction:column;gap:16px;
  place-items:stretch;width:100%}
.nb-wave{display:flex;align-items:center;gap:2.5px;height:72px;width:100%}
.nb-wave i{flex:1 1 0;min-width:2px;height:100%;border-radius:99px;background:rgba(235,238,245,.42)}
.nb-wave i[data-past=true]{background:${T.accent};opacity:1}
.nb-ctrl{display:flex;align-items:center;gap:10px}
.nb-timeline{display:flex;flex-direction:column;gap:0;margin:0;padding:0;list-style:none;position:relative}
.nb-timeline::before{content:'';position:absolute;left:7px;top:10px;bottom:10px;width:2px;
  border-radius:2px;background:var(--nb-hair-soft)}
.nb-tl{display:grid;grid-template-columns:110px 1fr;gap:16px;padding:13px 0 13px 24px;
  border-top:1px solid var(--nb-hair-soft);position:relative}
.nb-tl:first-child{border-top:0}
.nb-tl::before{content:'';position:absolute;left:2px;top:20px;width:11px;height:11px;border-radius:99px;
  background:${T.accent};box-shadow:0 0 0 3px color-mix(in srgb,${T.accent} 18%, transparent)}
.nb-tl-when{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10.5px;font-weight:700;
  color:${T.accent};letter-spacing:.06em;text-transform:uppercase;padding-top:3px}
.nb-tl-what{font-size:15px;color:${T.text2}}

/* ---------------------------------------------------------------- mind map */
.nb-map{width:100%;height:100%;min-height:340px;display:block;cursor:grab;border-radius:16px;
  border:1px solid var(--nb-hair-soft);
  background:radial-gradient(circle at 50% 45%, color-mix(in srgb,${T.accent} 9%, transparent), transparent 62%), var(--nb-card)}
.nb-map:active{cursor:grabbing}

/* -------------------------------------------------------------- flashcards */
.nb-deck{display:flex;flex-direction:column;gap:16px;max-width:640px;margin:0 auto;width:100%}
.nb-flip{perspective:1400px;cursor:pointer;border:0;background:transparent;padding:0;width:100%}
.nb-flip-inner{position:relative;width:100%;min-height:310px;transition:transform .5s cubic-bezier(.2,.7,.2,1);
  transform-style:preserve-3d}
.nb-flip[data-flipped=true] .nb-flip-inner{transform:rotateY(180deg)}
.nb-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:20px;
  border:1px solid var(--nb-hair);background:var(--nb-card);box-shadow:var(--nb-shadow);
  padding:30px;display:flex;flex-direction:column;justify-content:center;gap:12px;
  font-size:19px;line-height:1.5}
.nb-face[data-side=back]{transform:rotateY(180deg);border-color:color-mix(in srgb,${T.accent} 45%, transparent);
  background:linear-gradient(160deg, color-mix(in srgb,${T.accent} 14%, var(--nb-card)), var(--nb-card))}
.nb-face .nb-meta{position:absolute;top:17px;left:22px}
.nb-face-hint{font-size:11.5px;color:${T.text4};margin-top:auto;letter-spacing:.02em}

/* -------------------------------------------------------------------- ops */
.nb-fleet{display:flex;flex-direction:column;gap:8px;padding:8px 0}
.nb-frow{display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;gap:12px;
  padding:11px 14px;border:1px solid var(--nb-hair-soft);border-radius:13px;background:var(--nb-card);
  cursor:pointer;text-align:left;color:${T.text};min-height:54px;
  transition:border-color .13s ease,box-shadow .13s ease,transform .13s ease}
.nb-frow:hover{border-color:color-mix(in srgb,${T.text} 20%, transparent);box-shadow:var(--nb-shadow)}
.nb-frow[aria-current=true]{border-color:color-mix(in srgb,${T.accent} 55%, transparent);
  background:color-mix(in srgb,${T.accent} 9%, var(--nb-card))}
.nb-fname{font-size:14px;font-weight:600;line-height:1.25}
.nb-frole{font-size:10.5px;color:${T.text3};text-transform:uppercase;letter-spacing:.06em;font-weight:600}
.nb-term{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:13px;line-height:1.55;flex:1 1 auto;
  background:#101320;color:#c9cede;border-radius:14px;padding:16px;min-height:130px;max-height:none;overflow:auto;
  white-space:pre-wrap;word-break:break-word;border:1px solid rgba(255,255,255,.09);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
.nb-term-in{display:flex;gap:8px;align-items:center;margin-top:10px}
.nb-term-in input{flex:1;height:38px;border-radius:11px;border:1px solid var(--nb-hair);
  background:var(--nb-wash);color:${T.text};padding:0 13px;font-size:13.5px;
  font-family:var(--ui-font-mono,ui-monospace,monospace);outline:0}
.nb-term-in input:focus{border-color:color-mix(in srgb,${T.accent} 55%, transparent)}

/* -------------------------------------------------------------- status bar */
.nb-status{flex:0 0 32px;height:32px;display:flex;align-items:center;gap:18px;padding:0 18px;
  border-top:1px solid var(--nb-hair-soft);background:transparent;
  font-size:11.5px;color:${T.text3}}
.nb-status b{color:${T.text2};font-weight:600}
.nb-sdot{width:8px;height:8px;border-radius:99px;display:inline-block;margin-right:8px;vertical-align:middle}
.nb-void{display:grid;place-items:center;height:100%;padding:40px;text-align:center;color:${T.text3}}
.nb-void h3{color:${T.text};font-size:21px;margin:0 0 10px;letter-spacing:-.02em;font-weight:700}
.nb-void p{margin:0;max-width:48ch;font-size:14px;line-height:1.62}

/* ------------------------------------------------------------ home (directory) */
.nb-home{flex:1;min-height:0;display:flex;flex-direction:column}
.nb-home-scroll{flex:1;min-height:0;overflow:auto;padding:26px 30px 30px;overscroll-behavior:contain}
.nb-home-head{display:flex;align-items:flex-end;gap:16px;margin-bottom:24px;flex-wrap:wrap}
.nb-home-title{font-size:26px;font-weight:700;letter-spacing:-.02em;margin:0;line-height:1.2}
.nb-home-sub{font-size:13.5px;color:${T.text2};margin:5px 0 0}
.nb-home-search{width:260px;margin-left:auto}
.nb-feature-row{display:flex;gap:14px;overflow-x:auto;padding:2px 2px 12px;margin-bottom:26px;
  scrollbar-width:thin}
.nb-feature{flex:0 0 290px;height:170px;border-radius:20px;padding:18px;position:relative;
  overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;
  text-align:left;cursor:pointer;color:${T.text};font-family:inherit;
  border:1px solid var(--nb-hair-soft);
  background:linear-gradient(135deg, color-mix(in srgb,var(--kc) 30%, var(--nb-card)), var(--nb-card) 72%);
  transition:transform .15s ease,box-shadow .15s ease}
.nb-feature:hover{transform:translateY(-2px);box-shadow:var(--nb-shadow-lift)}
.nb-feature::after{content:'';position:absolute;right:-46px;bottom:-58px;width:190px;height:190px;
  border-radius:99px;background:color-mix(in srgb,var(--kc) 22%, transparent);pointer-events:none}
.nb-feature-emoji{font-size:30px;line-height:1}
.nb-feature-title{font-size:15.5px;font-weight:650;line-height:1.3;max-width:24ch;position:relative}
.nb-feature-meta{font-size:11.5px;color:${T.text3};position:relative}
.nb-home-sec{display:flex;align-items:center;gap:12px;margin:0 0 14px}
.nb-home-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:13px;
  align-content:start}
.nb-nbcard-wrap{position:relative;height:170px}
.nb-nbcard{height:100%;position:relative;border-radius:18px;padding:16px;display:flex;
  flex-direction:column;justify-content:space-between;text-align:left;cursor:pointer;
  color:${T.text};font-family:inherit;
  border:1px solid var(--nb-hair-soft);background:var(--nb-card);
  transition:border-color .14s ease,transform .14s ease,box-shadow .14s ease}
.nb-nbcard:hover{border-color:color-mix(in srgb,${T.accent} 42%, var(--nb-hair));
  transform:translateY(-2px);box-shadow:var(--nb-shadow-lift)}
.nb-nbcard-emoji{font-size:32px;line-height:1}
.nb-nbcard-del{position:absolute;top:9px;right:7px}
.nb-nbcard-ren{position:absolute;top:9px;right:32px}
.nb-nbcard-title{font-size:14.5px;font-weight:650;line-height:1.35;padding-right:28px}
.nb-nbcard-meta{font-size:11.5px;color:${T.text3};margin-top:8px}

/* generator options popover + citation hover card + data table */
.nb-gen{position:relative}
.nb-gen-cfg{position:absolute;top:4px;right:4px;width:32px;height:32px;opacity:0;
  transition:opacity .15s}
.nb-gen:hover .nb-gen-cfg,.nb-gen-cfg[data-active="true"]{opacity:1}
.nb-genpop{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:30;
  background:${T.card};border:1px solid ${T.line};border-radius:14px;
  box-shadow:var(--nb-shadow-lift);padding:12px;display:grid;gap:12px}
.nb-genopt-label{font-size:11px;font-weight:600;color:${T.text3};margin-bottom:6px;
  text-transform:uppercase;letter-spacing:.06em}
.nb-genopt .nb-seg{width:100%}
.nb-genopt .nb-seg button{flex:1;justify-content:center}
.nb-genopt-text{width:100%;height:32px;padding:0 10px;border-radius:9px;font-size:13px;
  border:1px solid ${T.line};background:${T.inset};color:${T.text};outline:none}
.nb-genopt-text:focus{border-color:color-mix(in srgb,${T.accent} 55%,transparent)}
/* the infographic look picker: sixteen styles do not fit a segmented control or an
   inline popover, so they open in a dialog as a gallery \u2014 the thumbnail is the real
   renderer drawing the notebook's own last infographic in that style */
.nb-stylegrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;
  max-height:min(64vh,492px);overflow:auto;overscroll-behavior:contain;padding:2px;margin:0 -2px;
  scrollbar-width:thin}
.nb-styleopt{display:flex;flex-direction:column;align-items:stretch;gap:0;min-width:0;
  padding:0;border-radius:11px;border:1px solid ${T.lineSoft};background:${T.card};
  cursor:pointer;overflow:hidden;color:${T.text2};font-family:inherit}
.nb-styleopt:hover{border-color:color-mix(in srgb,${T.accent} 45%,${T.lineSoft})}
.nb-styleopt[data-on="true"]{border-color:${T.accent};box-shadow:0 0 0 1px ${T.accent} inset}
.nb-styleopt:focus-visible{outline:2px solid ${T.accent};outline-offset:1px}
.nb-stylethumb{display:block;position:relative;height:60px;background:${T.inset}}
.nb-stylethumb img{width:100%;height:100%;object-fit:cover;display:block}
.nb-stylethumb[data-empty="true"]::after{content:'';position:absolute;inset:0;
  background:linear-gradient(100deg,transparent 20%,color-mix(in srgb,${T.text} 6%,transparent) 50%,transparent 80%);
  animation:nb-shimmer 1.4s linear infinite}
@keyframes nb-shimmer{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
.nb-stylecheck{position:absolute;top:4px;right:4px;width:18px;height:18px;border-radius:50%;
  display:grid;place-items:center;background:${T.accent};color:#fff;font-size:10px;
  font-weight:700;line-height:1}
/* the picker states where the previews come from, so nobody reads them as the user's
   finished artifact */
.nb-stylehint{margin-top:6px;font-size:11.5px;color:${T.text4}}
.nb-stylelabel{display:block;padding:4px 4px 5px;font-size:11px;font-weight:600;
  text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}


.nb-citepop{position:fixed;z-index:80;width:320px;max-width:calc(100vw - 32px);
  background:${T.card};border:1px solid ${T.line};border-radius:14px;
  box-shadow:var(--nb-shadow-lift);padding:12px 14px;pointer-events:none}
.nb-citepop-head{display:flex;align-items:center;gap:8px;font-size:12.5px;
  color:${T.text3};margin-bottom:6px;flex-wrap:wrap}
.nb-citepop-head b{color:${T.accent};font-weight:700}
.nb-citepop-body{font-size:13px;line-height:1.55;color:${T.text2};
  display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}

.nb-dt-wrap{overflow:auto;border:1px solid ${T.line};border-radius:14px;
  background:${T.card}}
.nb-dt{border-collapse:collapse;width:100%;font-size:13px;min-width:520px}
.nb-dt th{position:sticky;top:0;background:${T.inset};text-align:left;
  font-weight:650;font-size:12px;color:${T.text2};padding:10px 14px;
  border-bottom:1px solid ${T.line};cursor:pointer;user-select:none;white-space:nowrap}
.nb-dt th:hover{color:${T.text}}
.nb-dt-arrow{color:${T.accent};margin-left:5px;font-size:11px}
.nb-dt td{padding:9px 14px;border-bottom:1px solid ${T.lineSoft};color:${T.text2}}
.nb-dt tbody tr:last-child td{border-bottom:0}
.nb-dt tbody tr:hover td{background:color-mix(in srgb,${T.accent} 4%,transparent)}

@media (max-width:1280px){
  .nb-root{--nb-rail:250px; --nb-studio:320px}
  .nb-body{padding:10px;gap:10px}
  .nb-h1{font-size:24px}
}
@media (max-width:1100px){
  .nb-studio{display:none}
  .nb-thread{padding:22px 20px 12px}
  .nb-main-head{padding:20px 20px 0}
  .nb-composer{padding:12px 20px 16px}
  .nb-home-scroll{padding:20px 18px 24px}
}
@media (max-width:820px){
  .nb-rail{display:none}
  .nb-h1{font-size:21px}
  .nb-body{padding:8px;gap:8px}
  .nb-suggest-grid{grid-template-columns:1fr}
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
  stop: "M7 7h10v10H7V7Z",
  tag: "M4 4h6.6L20 13.4a2 2 0 0 1 0 2.8l-3.8 3.8a2 2 0 0 1-2.8 0L4 10.6V4Zm4.6 3.4a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  pin: "M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6Z",
  sliders: "M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6m-6 4v6"
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
function Btn({ children, icon, variant, size, onClick, disabled, title, type = "button", className, style, ...rest }) {
  return el("button", {
    type,
    className: cx("nb-btn", className),
    "data-variant": variant,
    "data-size": size,
    onClick,
    disabled,
    title,
    style,
    "aria-label": rest["aria-label"],
    children: [
      icon ? (0, import_jsx_runtime.jsx)(Glyph, { name: icon, size: size === "sm" ? 14 : 15 }) : null,
      children ? el("span", { children }) : null
    ].filter(Boolean)
  });
}
function IconBtn({ icon, label, onClick, active, size = 16, disabled, className }) {
  return el("button", {
    type: "button",
    className: cx("nb-icon", className),
    onClick,
    title: label,
    "aria-label": label,
    disabled,
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
          borderRadius: "18px",
          padding: "22px",
          boxShadow: "0 24px 70px rgba(0,0,0,.45), 0 4px 14px rgba(0,0,0,.25)"
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
var INLINE = /(\*\*[^*]+\*\*|__[^_\n]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_|\[S\d+\]|\[[^\]]+\]\([^)]+\))/g;
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
    if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push(el("strong", { children: tok.slice(2, -2) }, k));
    } else if (tok.startsWith("`")) {
      out.push(el("code", { children: tok.slice(1, -1) }, k));
    } else if (tok.startsWith("*") || tok.startsWith("_")) {
      out.push(el("em", { children: tok.slice(1, -1) }, k));
    } else if (/^\[S\d+\]$/.test(tok)) {
      const n = Number(tok.slice(2, -1));
      if (onCite) {
        out.push(el("button", {
          type: "button",
          className: "nb-inline-cite",
          title: `Open source S${n}`,
          "data-n": n,
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
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ t: "hr" });
      i += 1;
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
  if (b.t === "hr") return el("hr", { key });
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
function useStudio(nb, thread) {
  const [data, setData] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)("");
  const [loading, setLoading] = (0, import_react.useState)(true);
  const alive = (0, import_react.useRef)(true);
  const load = (0, import_react.useCallback)(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const next = await api(`/state${nb ? `?${qs({ notebook: nb, thread: thread || "" })}` : ""}`);
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
  }, [nb, thread]);
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
  infographic: "chart",
  data_table: "grid"
};
var SRC_ICON = {
  url: "globe",
  youtube: "video",
  file: "file",
  text: "note",
  image: "image",
  pdf: "file",
  note: "note",
  audio: "audio",
  docx: "doc",
  pptx: "slides",
  xlsx: "chart",
  epub: "book",
  ipynb: "notebook",
  code: "terminal",
  markdown: "doc",
  csv: "chart"
};
var KIND_LABEL = {
  url: "web",
  youtube: "youtube",
  note: "note",
  text: "pasted text",
  pdf: "pdf",
  docx: "docx",
  pptx: "slides",
  xlsx: "sheet",
  epub: "ebook",
  ipynb: "notebook",
  image: "image",
  file: "file",
  audio: "audio"
};
var kindLabel = (k) => KIND_LABEL[k] || k || "file";
var NB_EMOJI = [
  "\u{1F4D3}",
  "\u{1F9E0}",
  "\u{1F52C}",
  "\u{1F4DA}",
  "\u{1F6F0}\uFE0F",
  "\u269B\uFE0F",
  "\u{1F331}",
  "\u{1F3DB}\uFE0F",
  "\u{1F3A7}",
  "\u{1F9EA}",
  "\u{1F4C8}",
  "\u{1F5FA}\uFE0F",
  "\u{1F9ED}",
  "\u{1F4A1}",
  "\u{1F3E5}",
  "\u2696\uFE0F"
];
var hashStr = (s) => {
  let h = 0;
  for (const c of String(s)) h = h * 31 + c.charCodeAt(0) >>> 0;
  return h;
};
var emojiFor = (id) => NB_EMOJI[hashStr(id || "nb") % NB_EMOJI.length];
var dshort = (stamp) => {
  const d = stamp ? new Date(stamp) : null;
  return d && !isNaN(d) ? d.toLocaleDateString(void 0, { day: "numeric", month: "short", year: "numeric" }) : "";
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
  const [mode, setMode] = (0, import_react.useState)(() => persist.get("mode", "home"));
  const [nb, setNb] = (0, import_react.useState)(() => persist.get("notebook", ""));
  const [threadName, setThreadName] = (0, import_react.useState)(() => persist.get("thread", ""));
  const studio = useStudio(nb, threadName);
  (0, import_react.useEffect)(() => {
    if (!nb) return;
    const saved = persist.get(`thread.${nb}`, "");
    setThreadName(saved || "");
  }, [nb]);
  const [picked, setPicked] = (0, import_react.useState)(null);
  const [tab, setTab] = (0, import_react.useState)("chat");
  const [busy, setBusy] = (0, import_react.useState)({});
  const [note, setNote] = (0, import_react.useState)("");
  const [askOpen, setAskOpen] = (0, import_react.useState)(0);
  const [srcDialog, setSrcDialog] = (0, import_react.useState)(null);
  const [newNb, setNewNb] = (0, import_react.useState)(false);
  const [filter, setFilter] = (0, import_react.useState)("all");
  const [peek, setPeek] = (0, import_react.useState)(null);
  const [railOpen, setRailOpen] = (0, import_react.useState)(() => persist.get("rail", "1") !== "0");
  const [studioOpen, setStudioOpen] = (0, import_react.useState)(() => persist.get("studio", "1") !== "0");
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
  (0, import_react.useEffect)(() => {
    persist.set("rail", railOpen ? "1" : "0");
  }, [railOpen]);
  (0, import_react.useEffect)(() => {
    persist.set("studio", studioOpen ? "1" : "0");
  }, [studioOpen]);
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
  const generate = (0, import_react.useCallback)(async (kind, opts) => {
    if (!notebook) return;
    setBusy((b) => ({ ...b, [kind]: Date.now() }));
    try {
      await api("/generate", {
        method: "POST",
        body: { notebook: notebook.id, kind, length: "short", ...opts || {} },
        timeoutMs: 24e4
      });
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
  const labelSources = (0, import_react.useCallback)(async () => {
    if (!nb) return;
    try {
      await api("/label", { method: "POST", body: { notebook: nb }, timeoutMs: 18e4 });
      await studio.reload(true);
      say("sources labelled");
    } catch (e) {
      say(`labelling failed: ${e.message || e}`);
    }
  }, [nb, studio, say]);
  const openSource = (0, import_react.useCallback)((s) => {
    setPeek(s);
    setTab("peek");
  }, []);
  const openAddSource = (0, import_react.useCallback)((opts) => setSrcDialog(opts || { mode: "find" }), []);
  const toggleSource = (0, import_react.useCallback)(async (s) => {
    if (!nb || !s || !s.id) return;
    try {
      const out = await api("/source_state", {
        method: "POST",
        body: { notebook: nb, source_id: s.id, enabled: s.active === false },
        timeoutMs: 3e4
      });
      if (out && out.state && studio.data) {
        studio.setData({ ...studio.data, notebook: out.state });
      } else {
        await studio.reload(true);
      }
    } catch (e) {
      say(`could not update source: ${e.message || e}`);
    }
  }, [nb, studio, say]);
  const toggleAllSources = (0, import_react.useCallback)(async () => {
    const sources = notebook && notebook.sources || [];
    if (!nb || !sources.length) return;
    const allOn = sources.every((s) => s.active !== false);
    try {
      for (const s of sources) {
        await api("/source_state", {
          method: "POST",
          body: { notebook: nb, source_id: s.id, enabled: !allOn },
          timeoutMs: 3e4
        });
      }
      await studio.reload(true);
    } catch (e) {
      say(`could not update sources: ${e.message || e}`);
    }
  }, [nb, notebook, studio, say]);
  const openThread = (0, import_react.useCallback)((name) => {
    setThreadName(name);
    if (nb) persist.set(`thread.${nb}`, name);
  }, [nb]);
  const newThread = (0, import_react.useCallback)(async (title) => {
    if (!nb) return;
    try {
      const out = await api("/thread/new", {
        method: "POST",
        body: { notebook: nb, title: title || "" },
        timeoutMs: 3e4
      });
      const name = out && out.thread ? out.thread.name : "";
      if (name) openThread(name);
      await studio.reload(true);
      say("new conversation started");
    } catch (e) {
      say(`could not start a conversation: ${e.message || e}`);
    }
  }, [nb, openThread, studio, say]);
  const renameThread = (0, import_react.useCallback)(async (name, title) => {
    if (!nb) return;
    try {
      await api("/thread/rename", {
        method: "POST",
        body: { notebook: nb, thread: name, title },
        timeoutMs: 3e4
      });
      await studio.reload(true);
    } catch (e) {
      say(`could not rename: ${e.message || e}`);
    }
  }, [nb, studio, say]);
  const deleteThread = (0, import_react.useCallback)(async (name) => {
    if (!nb) return;
    try {
      const out = await api("/thread/delete", {
        method: "POST",
        body: { notebook: nb, thread: name, confirm: true },
        timeoutMs: 3e4
      });
      if (out && out.next) openThread(out.next);
      await studio.reload(true);
      say("conversation deleted");
    } catch (e) {
      say(`could not delete: ${e.message || e}`);
    }
  }, [nb, openThread, studio, say]);
  const threads = {
    name: threadName || notebook && notebook.thread_name || "default",
    title: notebook && notebook.thread_title || "Conversation",
    list: notebook && notebook.threads || [],
    onOpen: openThread,
    onNew: newThread,
    onRename: renameThread,
    onDelete: deleteThread
  };
  const deleteNotebook = (0, import_react.useCallback)(async (id) => {
    try {
      await api("/notebook/delete", {
        method: "POST",
        body: { notebook: id, confirm: true },
        timeoutMs: 3e4
      });
      if (nb === id) setNb("");
      await studio.reload(true);
      say("notebook deleted");
    } catch (e) {
      say(`delete failed: ${e.message || e}`);
    }
  }, [nb, studio, say]);
  const renameNotebook = (0, import_react.useCallback)(async (id, title, desc) => {
    try {
      await api("/notebook/update", {
        method: "POST",
        body: { notebook: id, title, description: desc },
        timeoutMs: 3e4
      });
      await studio.reload(true);
      say("notebook updated");
    } catch (e) {
      say(`rename failed: ${e.message || e}`);
    }
  }, [studio, say]);
  const openNotebook = (0, import_react.useCallback)((id) => {
    setNb(id);
    setPicked(null);
    setPeek(null);
    setTab("chat");
    setMode("studio");
  }, []);
  const ops = mode === "ops";
  const home = mode === "home";
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
          ops ? el("b", { children: "Lab Ops" }) : home ? el("b", { children: "All notebooks" }) : el("span", null, "/ ", el("b", { children: notebook ? notebook.title : "no notebook" }))
        )
      ),
      el("div", { className: "nb-spacer" }),
      (0, import_jsx_runtime.jsx)(Seg, {
        label: "Surface",
        value: mode,
        onChange: (v) => setMode(v),
        options: [
          { id: "home", label: "Home", icon: "grid" },
          { id: "studio", label: "Studio", icon: "notebook" },
          { id: "ops", label: "Lab Ops", icon: "server" }
        ]
      }),
      el(
        "div",
        { className: "nb-actions" },
        mode === "studio" ? (0, import_jsx_runtime.jsx)(Btn, {
          icon: "plus",
          variant: "primary",
          onClick: () => openAddSource(),
          disabled: !notebook,
          children: "Add source"
        }) : null
      )
    ),
    ops ? (0, import_jsx_runtime.jsx)(OpsDeck, { onSay: say, onStats: setOpsStats }) : home ? (0, import_jsx_runtime.jsx)(HomeDashboard, {
      data,
      onOpen: openNotebook,
      onNew: () => setNewNb(true),
      onDelete: deleteNotebook,
      onRename: renameNotebook
    }) : el(
      "div",
      { className: "nb-body" },
      railOpen ? (0, import_jsx_runtime.jsx)(Rail, {
        data,
        notebook,
        onAddSource: () => openAddSource(),
        onOpenSource: openSource,
        onToggleSource: toggleSource,
        onToggleAll: toggleAllSources,
        onLabel: labelSources,
        onCollapse: () => setRailOpen(false),
        onGoHome: () => setMode("home"),
        onSay: say,
        loading: studio.loading,
        error: studio.error,
        reload: studio.reload
      }) : (0, import_jsx_runtime.jsx)(PanelToggles, { side: "left", onShow: () => setRailOpen(true) }),
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
        peek,
        setPeek,
        onOpenSource: openSource,
        onAddSource: openAddSource,
        onNewNotebook: () => setNewNb(true),
        onFindSources: (seed) => openAddSource({ mode: "find", seed: seed || "" }),
        threads
      }),
      studioOpen ? (0, import_jsx_runtime.jsx)(StudioPanel, {
        kinds,
        notebook,
        busy,
        generate,
        filter,
        setFilter,
        onOpen: (art) => {
          setPicked(art);
          setTab("view");
        },
        onCollapse: () => setStudioOpen(false),
        onAddNote: () => openAddSource({ mode: "note" })
      }) : (0, import_jsx_runtime.jsx)(PanelToggles, { side: "right", onShow: () => setStudioOpen(true) })
    ),
    (0, import_jsx_runtime.jsx)(StatusBar, { mode, notebook, data, note, opsStats }),
    (0, import_jsx_runtime.jsx)(AddSourceDialog, {
      open: !!srcDialog,
      onClose: () => setSrcDialog(null),
      notebook,
      initialMode: srcDialog && srcDialog.mode,
      seedQuery: srcDialog && srcDialog.seed,
      noteOnly: !!(srcDialog && srcDialog.mode === "note"),
      onDone: async (msg) => {
        setSrcDialog(null);
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
function HomeDashboard({ data, onOpen, onNew, onDelete, onRename }) {
  const [query, setQuery] = (0, import_react.useState)("");
  const [del, setDel] = (0, import_react.useState)(null);
  const [ren, setRen] = (0, import_react.useState)(null);
  const notebooks = data && data.notebooks || [];
  const needle = query.trim().toLowerCase();
  const shown = notebooks.filter((n) => !needle || `${n.title} ${n.description || ""}`.toLowerCase().includes(needle));
  const featured = [...notebooks].sort((a, b) => (b.artifacts || 0) - (a.artifacts || 0)).slice(0, 3);
  const hues = ["#81c995", "#a8c7fa", "#f28b82", "#c58af9", "#fde293"];
  return el(
    "div",
    { className: "nb-home" },
    el(
      "div",
      { className: "nb-home-scroll" },
      el(
        "div",
        { className: "nb-home-head" },
        el(
          "div",
          null,
          el("h1", { className: "nb-home-title", children: "Notebooks" }),
          el("p", {
            className: "nb-home-sub",
            children: `${notebooks.length} notebook${notebooks.length === 1 ? "" : "s"} \xB7 every answer and artifact is grounded in your sources`
          })
        ),
        el(
          "div",
          { className: "nb-home-search" },
          (0, import_jsx_runtime.jsx)(SearchField, {
            value: query,
            onChange: setQuery,
            placeholder: "Search notebooks",
            label: "Search notebooks"
          })
        )
      ),
      featured.length ? el(
        "div",
        { className: "nb-feature-row", role: "list", "aria-label": "Featured notebooks" },
        featured.map((n, i) => el("button", {
          key: n.id,
          type: "button",
          role: "listitem",
          className: "nb-feature",
          style: { "--kc": hues[i % hues.length] },
          onClick: () => onOpen(n.id),
          "aria-label": `Open notebook ${n.title}`,
          children: [
            el("span", {
              className: "nb-feature-emoji",
              "aria-hidden": "true",
              children: emojiFor(n.id)
            }),
            el("span", { className: "nb-feature-title", children: n.title }),
            el("span", {
              className: "nb-feature-meta",
              children: `${dshort(n.updated_at)} \xB7 ${n.sources} source${n.sources === 1 ? "" : "s"} \xB7 ${n.artifacts} artifact${n.artifacts === 1 ? "" : "s"}`
            })
          ]
        }, n.id))
      ) : null,
      el(
        "div",
        { className: "nb-home-sec" },
        el("span", { className: "nb-meta", children: "Recent notebooks" }),
        el("span", { style: { flex: 1 } }),
        (0, import_jsx_runtime.jsx)(Btn, { icon: "plus", variant: "primary", onClick: onNew, children: "New notebook" })
      ),
      shown.length === 0 ? el(
        "div",
        { className: "nb-void", style: { height: "auto", padding: "30px 8px" } },
        el(
          "div",
          null,
          el("h3", { children: notebooks.length ? "Nothing matches" : "No notebooks yet" }),
          el("p", { children: notebooks.length ? "Try a different search." : "A notebook is a set of sources. Create one, then describe what you need \u2014 Hermes finds, labels and grounds everything in them." }),
          !notebooks.length ? el(
            "div",
            { style: { marginTop: "14px" } },
            (0, import_jsx_runtime.jsx)(Btn, { variant: "primary", icon: "plus", onClick: onNew, children: "New notebook" })
          ) : null
        )
      ) : el(
        "div",
        { className: "nb-home-grid", role: "list" },
        shown.map((n) => el(
          "div",
          { key: n.id, className: "nb-nbcard-wrap", role: "listitem" },
          el("button", {
            type: "button",
            className: "nb-nbcard",
            onClick: () => onOpen(n.id),
            "aria-label": `Open notebook ${n.title}`,
            children: [
              el("span", {
                className: "nb-nbcard-emoji",
                "aria-hidden": "true",
                children: emojiFor(n.id)
              }),
              el("span", { className: "nb-nbcard-title", children: n.title }),
              el("span", {
                className: "nb-nbcard-meta",
                children: `${dshort(n.updated_at)} \xB7 ${n.sources} source${n.sources === 1 ? "" : "s"}`
              })
            ]
          }, n.id),
          (0, import_jsx_runtime.jsx)(IconBtn, {
            icon: "note",
            label: `Rename notebook ${n.title}`,
            size: 14,
            className: "nb-nbcard-ren",
            onClick: (e) => {
              e.stopPropagation();
              setRen(n);
            }
          }),
          (0, import_jsx_runtime.jsx)(IconBtn, {
            icon: "trash",
            label: `Delete notebook ${n.title}`,
            size: 14,
            className: "nb-nbcard-del",
            onClick: (e) => {
              e.stopPropagation();
              setDel(n);
            }
          })
        ))
      )
    ),
    del ? (0, import_jsx_runtime.jsx)(Dialog, {
      open: true,
      onClose: () => setDel(null),
      title: "Delete notebook",
      width: 420,
      children: el(
        "div",
        null,
        el("p", {
          style: { margin: "0 0 16px", color: T.text2, fontSize: "14.5px", lineHeight: 1.55 },
          children: `\u201C${del.title}\u201D and its sources, thread and artifacts will be removed. This cannot be undone.`
        }),
        el(
          "div",
          { style: { display: "flex", gap: "8px", justifyContent: "flex-end" } },
          (0, import_jsx_runtime.jsx)(Btn, { onClick: () => setDel(null), children: "Cancel" }),
          (0, import_jsx_runtime.jsx)(Btn, {
            variant: "primary",
            icon: "trash",
            onClick: () => {
              const id = del.id;
              setDel(null);
              onDelete(id);
            },
            children: "Delete"
          })
        )
      )
    }) : null,
    ren ? (0, import_jsx_runtime.jsx)(RenameDialog, {
      notebook: ren,
      onClose: () => setRen(null),
      onDone: async (title, desc) => {
        setRen(null);
        await onRename(ren.id, title, desc);
      }
    }) : null
  );
}
function RenameDialog({ notebook, onClose, onDone }) {
  const [title, setTitle] = (0, import_react.useState)(notebook.title || "");
  const [desc, setDesc] = (0, import_react.useState)(notebook.description || "");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [err, setErr] = (0, import_react.useState)("");
  return (0, import_jsx_runtime.jsx)(Dialog, {
    open: true,
    onClose,
    title: "Notebook settings",
    width: 460,
    children: el(
      "div",
      null,
      el(
        "div",
        { className: "nb-field", style: { height: "40px", marginBottom: "10px" } },
        (0, import_jsx_runtime.jsx)(Glyph, { name: "notebook", size: 14 }),
        el("input", {
          value: title,
          onChange: (e) => setTitle(e.target.value),
          autoFocus: true,
          placeholder: "Notebook title",
          "aria-label": "Notebook title"
        })
      ),
      el(
        "div",
        { className: "nb-field", style: { height: "40px" } },
        (0, import_jsx_runtime.jsx)(Glyph, { name: "doc", size: 14 }),
        el("input", {
          value: desc,
          onChange: (e) => setDesc(e.target.value),
          placeholder: "Description (optional)",
          "aria-label": "Notebook description"
        })
      ),
      err ? el("div", { style: { marginTop: "10px", color: T.danger, fontSize: "13.5px" }, children: err }) : null,
      el(
        "div",
        { style: { display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" } },
        (0, import_jsx_runtime.jsx)(Btn, { onClick: onClose, children: "Cancel" }),
        (0, import_jsx_runtime.jsx)(Btn, {
          variant: "primary",
          disabled: busy || !title.trim(),
          onClick: async () => {
            setBusy(true);
            setErr("");
            try {
              await onDone(title.trim(), desc.trim());
            } catch (e) {
              setErr(e.message || String(e));
              setBusy(false);
            }
          },
          children: busy ? "Saving\u2026" : "Save"
        })
      )
    )
  });
}
function PanelToggles({ side, onShow }) {
  return el(
    "div",
    { className: "nb-paneltog" },
    (0, import_jsx_runtime.jsx)(IconBtn, {
      icon: side === "left" ? "arrowRight" : "arrowLeft",
      label: side === "left" ? "Show sources panel" : "Show studio panel",
      onClick: onShow
    })
  );
}
function Rail({
  data,
  notebook,
  onAddSource,
  onOpenSource,
  onToggleSource,
  onToggleAll,
  onLabel,
  onCollapse,
  onGoHome,
  onSay,
  loading,
  error,
  reload
}) {
  const sources = notebook && notebook.sources || [];
  const labels = notebook && notebook.labels || [];
  const [q, setQ] = (0, import_react.useState)("");
  const [srcFilter, setSrcFilter] = (0, import_react.useState)("all");
  const [closed, setClosed] = (0, import_react.useState)({});
  const shown = (0, import_react.useMemo)(() => {
    const needle = (q || "").trim().toLowerCase();
    return sources.filter((s) => {
      if (srcFilter !== "all" && !(s.labels || []).some((l) => l.toLowerCase() === srcFilter)) return false;
      if (!needle) return true;
      return (s.title + " " + (s.origin || "") + " " + (s.labels || []).join(" ")).toLowerCase().includes(needle);
    });
  }, [sources, q, srcFilter]);
  const groups = (0, import_react.useMemo)(() => {
    const map = /* @__PURE__ */ new Map();
    for (const s of shown) {
      const g = ((s.labels || [])[0] || kindLabel(s.kind) || "other").toLowerCase();
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(s);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [shown]);
  const allOn = sources.length > 0 && sources.every((s) => s.active !== false);
  const activeCount = sources.filter((s) => s.active !== false).length;
  const srcRow = (s) => {
    const on = s.active !== false;
    return el(
      "div",
      {
        className: "nb-src",
        key: s.id,
        "data-on": pickedCite === s.n ? "true" : "false",
        "data-off": on ? "false" : "true"
      },
      el("button", {
        type: "button",
        className: "nb-src-open",
        onClick: () => onOpenSource(s),
        "aria-label": `Open source ${s.n} \u2014 ${s.title}`,
        title: s.summary || s.origin || s.title,
        children: [
          el(
            "span",
            { className: "nb-src-ico" },
            (0, import_jsx_runtime.jsx)(Glyph, { name: SRC_ICON[s.kind] || "file", size: 15 }),
            el("b", { className: "nb-cite", children: `S${s.n}` })
          ),
          el(
            "span",
            { style: { minWidth: 0, flex: 1 } },
            el("span", { className: "nb-src-title", children: s.title }),
            el(
              "span",
              { className: "nb-src-meta" },
              el("span", { className: "nb-chip", children: `${kindLabel(s.kind)} \xB7 ${nfmt(s.chars)}` }),
              (s.labels || []).slice(0, 2).map((l) => el("span", { className: "nb-chip", children: l }, l)),
              (s.labels || []).length > 2 ? el("span", {
                className: "nb-chip",
                title: `Also tagged: ${s.labels.slice(2).join(", ")}`,
                children: `+${s.labels.length - 2}`
              }) : null
            )
          )
        ]
      }),
      el("button", {
        type: "button",
        className: "nb-srccheck",
        role: "checkbox",
        "aria-checked": on,
        "aria-label": `${on ? "Exclude" : "Include"} \u201C${s.title}\u201D ${on ? "from" : "in"} answers`,
        title: on ? "Included in answers \u2014 click to exclude" : "Excluded from answers \u2014 click to include",
        onClick: () => onToggleSource(s),
        children: on ? (0, import_jsx_runtime.jsx)(Glyph, { name: "check", size: 14 }) : null
      })
    );
  };
  return el(
    "aside",
    { className: "nb-col nb-rail", "aria-label": "Sources" },
    el(
      "div",
      { className: "nb-pane-head" },
      el("span", { className: "nb-pane-title", children: "Sources" }),
      el("span", { className: "nb-meta", children: `${activeCount}/${sources.length}` }),
      (0, import_jsx_runtime.jsx)(IconBtn, {
        icon: "sparkle",
        label: "Auto-label unlabelled sources",
        onClick: onLabel,
        disabled: !(notebook && notebook.stats && notebook.stats.unlabeled)
      }),
      (0, import_jsx_runtime.jsx)(IconBtn, { icon: "refresh", label: "Refresh sources", onClick: () => reload(true) }),
      (0, import_jsx_runtime.jsx)(IconBtn, { icon: "arrowLeft", label: "Hide sources panel", onClick: onCollapse })
    ),
    el(
      "div",
      { className: "nb-pad", style: { paddingTop: "10px", paddingBottom: "8px" } },
      notebook ? el("button", {
        type: "button",
        className: "nb-nbrow",
        "aria-current": "true",
        onClick: onGoHome,
        title: "Back to all notebooks",
        children: [
          el(
            "span",
            { className: "nb-avatar", "aria-hidden": "true" },
            (0, import_jsx_runtime.jsx)(Glyph, { name: "notebook", size: 15 })
          ),
          el(
            "span",
            { style: { minWidth: 0, flex: 1 } },
            el("span", { className: "nb-nbtitle", children: notebook.title }),
            el("span", {
              className: "nb-nbsub",
              children: `${sources.length} source${sources.length === 1 ? "" : "s"} \xB7 ${(notebook.artifacts || []).length} artifact${(notebook.artifacts || []).length === 1 ? "" : "s"}`
            })
          ),
          (0, import_jsx_runtime.jsx)(Glyph, { name: "arrowLeft", size: 14 })
        ]
      }) : el(
        "div",
        { className: "nb-hint", style: { padding: "6px 4px", lineHeight: 1.5 } },
        "Pick a notebook on Home first \u2014 sources belong to one."
      )
    ),
    el(
      "div",
      { className: "nb-pad", style: { paddingBottom: "8px" } },
      (0, import_jsx_runtime.jsx)(Btn, {
        icon: "plus",
        onClick: onAddSource,
        disabled: !notebook,
        className: "nb-addsrc",
        children: "Add sources"
      })
    ),
    notebook ? (0, import_jsx_runtime.jsx)(WebFinder, { notebook, onAdded: () => reload(true), onSay }) : null,
    el(
      "div",
      { className: "nb-pad", style: { paddingBottom: "8px" } },
      (0, import_jsx_runtime.jsx)(SearchField, { value: q || "", onChange: setQ, placeholder: "Search sources", label: "Search sources" })
    ),
    labels.length ? el(
      "div",
      {
        className: "nb-pad",
        style: { display: "flex", gap: "6px", flexWrap: "wrap", paddingTop: 0, paddingBottom: "10px" },
        role: "group",
        "aria-label": "Filter sources by label"
      },
      labels.slice(0, 6).map((l) => (0, import_jsx_runtime.jsx)(Chip, {
        key: l.label,
        tone: srcFilter === l.label.toLowerCase() ? "accent" : void 0,
        pressed: srcFilter === l.label.toLowerCase(),
        onClick: () => setSrcFilter(srcFilter === l.label.toLowerCase() ? "all" : l.label.toLowerCase()),
        title: `${l.count} source${l.count === 1 ? "" : "s"} labelled ${l.label}`,
        children: `${l.label} ${l.count}`
      }))
    ) : null,
    el(
      "div",
      { className: "nb-scroll", "aria-label": "Source list" },
      el(
        "div",
        { className: "nb-pad", style: { paddingTop: 0, paddingBottom: "12px" } },
        sources.length ? el(
          "div",
          { className: "nb-selall" },
          el("button", {
            type: "button",
            className: "nb-srccheck",
            role: "checkbox",
            "aria-checked": allOn,
            "aria-label": allOn ? "Exclude all sources from answers" : "Include all sources in answers",
            title: allOn ? "Exclude every source" : "Include every source",
            onClick: onToggleAll,
            children: allOn ? (0, import_jsx_runtime.jsx)(Glyph, { name: "check", size: 12 }) : null
          }),
          el("span", {
            className: "nb-src-title",
            style: { fontSize: "12.5px" },
            children: "All sources"
          }),
          el("span", {
            className: "nb-hint",
            style: { marginLeft: "auto" },
            children: `${activeCount} of ${sources.length}`
          })
        ) : null,
        error ? el("div", { className: "nb-hint", style: { padding: "10px", color: T.danger }, children: error }) : !notebook ? null : shown.length === 0 ? el(
          "div",
          { className: "nb-void", style: { height: "auto", padding: "24px 8px" } },
          el(
            "div",
            null,
            el("h3", { style: { fontSize: "15px" }, children: sources.length ? "Nothing matches" : "No sources yet" }),
            el("p", { style: { fontSize: "13.5px" }, children: sources.length ? "Clear the filter or the search to see every source." : "Add a file, a URL or pasted text \u2014 or describe the topic and let Hermes find sources for you." })
          )
        ) : el(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "2px" } },
          groups.map(([g, list]) => {
            const isClosed = !!closed[g];
            return el(
              "div",
              { key: g },
              el("button", {
                type: "button",
                className: "nb-srcgroup",
                "data-closed": isClosed ? "true" : "false",
                "aria-expanded": !isClosed,
                onClick: () => setClosed((c) => ({ ...c, [g]: !c[g] })),
                children: [
                  (0, import_jsx_runtime.jsx)(Glyph, { name: "chevron", size: 13 }),
                  el("span", { style: { textTransform: "capitalize" }, children: g }),
                  el("em", { children: `${list.filter((s) => s.active !== false).length}/${list.length}` })
                ]
              }),
              isClosed ? null : el("div", { className: "nb-srcgroup-list" }, list.map(srcRow))
            );
          })
        )
      )
    )
  );
}
function WebFinder({ notebook, onAdded, onSay }) {
  const [q, setQ] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [cands, setCands] = (0, import_react.useState)(null);
  const [err, setErr] = (0, import_react.useState)("");
  const [added, setAdded] = (0, import_react.useState)({});
  const [adding, setAdding] = (0, import_react.useState)("");
  const search = async () => {
    const query = q.trim();
    if (!query || busy || !notebook) return;
    setBusy(true);
    setErr("");
    setCands(null);
    setAdded({});
    try {
      const out = await api("/discover", {
        method: "POST",
        body: { notebook: notebook.id, query, max_results: 6 },
        timeoutMs: 9e4
      });
      const list = out.candidates || [];
      setCands(list);
      if (!list.length) setErr("Nothing found \u2014 try different words.");
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  const addOne = async (c) => {
    if (adding || added[c.url] || !notebook) return;
    setAdding(c.url);
    setErr("");
    try {
      await api("/sources", {
        method: "POST",
        body: { notebook: notebook.id, urls: [c.url] },
        timeoutMs: 12e4
      });
      setAdded((a) => ({ ...a, [c.url]: true }));
      if (onAdded) onAdded();
    } catch (e) {
      setErr(e.message || String(e));
      if (onSay) onSay(e.message || "could not add source");
    } finally {
      setAdding("");
    }
  };
  return el(
    "div",
    { className: "nb-finder" },
    el(
      "div",
      { className: "nb-finder-row" },
      (0, import_jsx_runtime.jsx)(Glyph, { name: "search", size: 14 }),
      el("input", {
        value: q,
        placeholder: "Search the web for new sources",
        "aria-label": "Search the web for new sources",
        onChange: (e) => setQ(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") search();
        },
        disabled: !notebook || busy,
        spellCheck: false
      }),
      el("button", {
        type: "button",
        className: "nb-finder-go",
        "aria-label": "Find sources",
        title: "Find sources",
        disabled: !q.trim() || busy || !notebook,
        onClick: search,
        children: (0, import_jsx_runtime.jsx)(Glyph, { name: "arrowRight", size: 15 })
      })
    ),
    busy ? el("div", {
      className: "nb-hint",
      style: { fontSize: "11.5px", padding: "7px 4px 0" },
      children: "searching the web\u2026"
    }) : null,
    err ? el("div", {
      className: "nb-hint",
      style: { fontSize: "11.5px", padding: "7px 4px 0", color: T.danger },
      children: err
    }) : null,
    cands && cands.length ? el(
      "div",
      { style: { marginTop: "8px", display: "flex", flexDirection: "column", gap: "2px" } },
      cands.map((c) => {
        const host3 = hostOf(c.url);
        const isAdded = !!added[c.url];
        return el("button", {
          key: c.url,
          type: "button",
          className: "nb-fcand",
          onClick: () => addOne(c),
          disabled: isAdded || !!adding,
          "aria-label": `${isAdded ? "Added" : "Add"} source: ${c.title || c.url}`,
          title: c.snippet || c.url,
          children: [
            el(
              "span",
              { className: "nb-fcand-main" },
              el("span", { className: "nb-fcand-title", children: c.title || c.url }),
              el("span", {
                className: "nb-fcand-sub",
                children: `${host3}${c.snippet ? ` \xB7 ${String(c.snippet).slice(0, 90)}` : ""}`
              })
            ),
            el(
              "span",
              { className: "nb-fcand-add", "data-added": isAdded ? "true" : "false", "aria-hidden": "true" },
              (0, import_jsx_runtime.jsx)(Glyph, { name: isAdded ? "check" : adding === c.url ? "refresh" : "plus", size: 13 })
            )
          ]
        }, c.url);
      })
    ) : null
  );
}
var pickedCite = 0;
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
  peek,
  setPeek,
  onOpenSource,
  onAddSource,
  onNewNotebook,
  onFindSources,
  threads
}) {
  const sources = notebook && notebook.sources || [];
  const [askScope, setAskScope] = (0, import_react.useState)(null);
  if (loading && !notebook) {
    return el(
      "main",
      { className: "nb-col nb-main-col" },
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
      { className: "nb-col nb-main-col" },
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
      { className: "nb-col nb-main-col" },
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
            { style: { marginTop: "16px", display: "flex", gap: "8px", justifyContent: "center" } },
            (0, import_jsx_runtime.jsx)(Btn, { variant: "primary", icon: "plus", onClick: onNewNotebook, children: "New notebook" }),
            (0, import_jsx_runtime.jsx)(Btn, {
              icon: "sparkle",
              onClick: () => onAddSource && onAddSource(),
              disabled: true,
              title: "Create a notebook first",
              children: "Add sources"
            })
          )
        )
      )
    );
  }
  const viewName = picked ? picked.label : "";
  const stats = notebook.stats || {};
  const activeCount = stats.active !== void 0 ? stats.active : sources.length;
  return el(
    "main",
    { className: "nb-col nb-main-col" },
    el(
      "div",
      { className: "nb-main-head" },
      el(
        "div",
        { className: "nb-hero" },
        el("span", { className: "nb-hero-emoji", "aria-hidden": "true", children: emojiFor(notebook.id) }),
        el(
          "div",
          { className: "nb-hero-main" },
          el("h1", { className: "nb-h1", children: notebook.title }),
          el("p", { className: "nb-sub", children: `${sources.length} source${sources.length === 1 ? "" : "s"} \xB7 ${activeCount} active \xB7 ${stats.labels || 0} topics \xB7 updated ${ago(notebook.updated_at) || "recently"}` })
        ),
        el(
          "div",
          { className: "nb-hero-side" },
          el("span", {
            className: "nb-chip",
            "data-tone": modelReady ? "ok" : "warn",
            children: modelReady ? "grounded" : "model offline"
          })
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
    tab === "peek" && peek ? (0, import_jsx_runtime.jsx)(SourcePeek, {
      source: peek,
      notebook,
      onClose: () => {
        setPeek(null);
        setTab("chat");
      },
      onAskAbout: (s) => {
        setAskScope({ id: s.id, title: s.title });
        setTab("chat");
      }
    }) : tab === "view" && picked ? (0, import_jsx_runtime.jsx)(Viewer, { artifact: picked, notebook, onSearch: () => {
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
      reload,
      askScope,
      setAskScope,
      threads,
      onCite: (n) => {
        const src = sources.find((s) => s.n === n);
        if (src) {
          setPeek(src);
          setTab("peek");
        }
      },
      onOpenSource,
      onFindSources
    })
  );
}
var SUGGEST = [
  "Summarise the strongest claim in the sources, with citations.",
  "Where do the sources disagree?",
  "What is missing that I should go and find?"
];
var ovCache = /* @__PURE__ */ new Map();
function Chat({ notebook, askOpen, onSay, modelReady, onCite, onOpenSource, onFindSources, reload, askScope, setAskScope, threads }) {
  const [msgs, setMsgs] = (0, import_react.useState)(() => (notebook.thread || []).map((m, i) => ({ ...m, k: `t${i}` })));
  const [text, setText] = (0, import_react.useState)("");
  const [pending, setPending] = (0, import_react.useState)(null);
  const [ov, setOv] = (0, import_react.useState)("");
  const [sugg, setSugg] = (0, import_react.useState)(null);
  const [cfgOpen, setCfgOpen] = (0, import_react.useState)(false);
  const [cfg, setCfg] = (0, import_react.useState)({});
  const [cfgBusy, setCfgBusy] = (0, import_react.useState)(false);
  const [threadsOpen, setThreadsOpen] = (0, import_react.useState)(false);
  const threadRef = (0, import_react.useRef)(null);
  const boxRef = (0, import_react.useRef)(null);
  const stats = notebook.stats || {};
  const activeCount = stats.active !== void 0 ? stats.active : (notebook.sources || []).length;
  const cacheKey = `${notebook.id}:${stats.sources || 0}:${activeCount}`;
  (0, import_react.useEffect)(() => {
    const stored = (notebook.thread || []).map((m, i) => ({ ...m, k: `t${i}` }));
    setMsgs(stored);
  }, [notebook.id, notebook.thread && notebook.thread.length]);
  (0, import_react.useEffect)(() => {
    if (setAskScope) setAskScope(null);
  }, [notebook.id]);
  (0, import_react.useEffect)(() => {
    const cached = ovCache.get(notebook.id);
    if (cached && cached.key === cacheKey) {
      setOv(cached.ov || "");
      setSugg(cached.sugg || null);
      return void 0;
    }
    let live = true;
    setOv("");
    setSugg(null);
    api("/overview", { method: "POST", body: { notebook: notebook.id }, timeoutMs: 12e4 }).then((o) => {
      if (!live) return;
      const text2 = o.overview || "";
      setOv(text2);
      const c = ovCache.get(notebook.id) || { key: cacheKey };
      ovCache.set(notebook.id, { key: cacheKey, ov: text2, sugg: c.sugg || null });
    }).catch(() => {
    });
    api("/suggest", { method: "POST", body: { notebook: notebook.id }, timeoutMs: 12e4 }).then((o) => {
      if (!live) return;
      const s = o.suggestions || null;
      setSugg(s);
      const c = ovCache.get(notebook.id) || { key: cacheKey };
      ovCache.set(notebook.id, { key: cacheKey, ov: c.ov || "", sugg: s });
    }).catch(() => {
    });
    return () => {
      live = false;
    };
  }, [notebook.id, cacheKey]);
  const saveNote = async () => {
    if (!ov.trim()) return;
    try {
      await api("/note", {
        method: "POST",
        body: { notebook: notebook.id, text: ov, title: `Overview \u2014 ${notebook.title}` },
        timeoutMs: 6e4
      });
      if (onSay) onSay("overview saved as a note \u2014 it is searchable now");
      if (reload) await reload(true);
    } catch (e) {
      if (onSay) onSay(`could not save note: ${e.message || e}`);
    }
  };
  const copyOv = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ov);
        if (onSay) onSay("overview copied");
      }
    } catch {
    }
  };
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
        body: {
          notebook: notebook.id,
          question: q,
          thread: threads && threads.name || notebook.thread_name || "default",
          ...askScope ? { source_ids: [askScope.id] } : {}
        },
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
  const threadName = threads && threads.title || notebook.thread_title || "Conversation";
  const threadCount = (notebook.thread || []).length;
  return el(
    "div",
    { className: "nb-chat" },
    el(
      "div",
      { className: "nb-chatbar" },
      el("button", {
        type: "button",
        className: "nb-threadpick",
        onClick: () => setThreadsOpen(true),
        "aria-haspopup": "dialog",
        "aria-label": `Conversations \u2014 ${threadName}`,
        title: "Switch, rename or start a conversation",
        children: [
          (0, import_jsx_runtime.jsx)(Glyph, { name: "summary", size: 15 }),
          el("span", { className: "nb-threadpick-title", children: threadName }),
          threadCount ? el("span", { className: "nb-chip", children: `${threadCount}` }) : null,
          (0, import_jsx_runtime.jsx)(Glyph, { name: "chevron", size: 14 })
        ]
      }),
      el("span", { style: { flex: 1 } }),
      (0, import_jsx_runtime.jsx)(Btn, {
        size: "sm",
        icon: "plus",
        disabled: !threads || !!pending,
        onClick: () => threads && threads.onNew(),
        children: "New chat"
      })
    ),
    el(
      "div",
      { className: "nb-thread", ref: threadRef, role: "log", "aria-live": "polite", "aria-label": "Conversation" },
      ov ? el(
        "div",
        { className: "nb-overview" },
        el(
          "div",
          { className: "nb-overview-head" },
          (0, import_jsx_runtime.jsx)(Glyph, { name: "sparkle", size: 14 }),
          el("span", { className: "nb-meta", children: "Overview" }),
          el("span", { style: { flex: 1 } }),
          (0, import_jsx_runtime.jsx)(Btn, { size: "sm", icon: "copy", onClick: copyOv, children: "Copy" }),
          (0, import_jsx_runtime.jsx)(Btn, { size: "sm", icon: "pin", onClick: saveNote, children: "Save to note" })
        ),
        el(
          "div",
          { className: "nb-overview-body" },
          (0, import_jsx_runtime.jsx)(Markdown, { text: ov })
        )
      ) : null,
      msgs.length === 0 && !pending ? el(
        "div",
        { style: { margin: msgs.length || ov ? "0" : "auto", textAlign: "center", maxWidth: "54ch" } },
        el(
          "div",
          { style: { display: "grid", placeItems: "center", gap: "10px" } },
          el(
            "span",
            { className: "nb-mark", style: { width: "38px", height: "38px" } },
            (0, import_jsx_runtime.jsx)(Glyph, { name: "sparkle", size: 19 })
          ),
          el("div", { style: { fontSize: "20px", fontWeight: 650, letterSpacing: "-.015em" }, children: "Ask the sources" }),
          el("div", {
            style: { color: T.text3, fontSize: "14.5px", lineHeight: 1.6 },
            children: "Every answer is built from this notebook and cites the source it came from. If the sources do not cover it, the answer says so."
          })
        )
      ) : null,
      msgs.length === 0 && !pending && sugg && (sugg.questions || []).length ? el(
        "div",
        { style: { marginTop: ov ? "18px" : "0" } },
        el("div", { className: "nb-meta", style: { marginBottom: "10px" }, children: "Suggested questions" }),
        el(
          "div",
          { className: "nb-suggest-grid" },
          sugg.questions.slice(0, 3).map((question) => el("button", {
            key: question,
            type: "button",
            className: "nb-suggest",
            onClick: () => send(question),
            "aria-label": `Ask: ${question}`,
            children: [
              el("span", { className: "nb-suggest-q", children: question }),
              el(
                "span",
                { className: "nb-suggest-go", "aria-hidden": "true" },
                (0, import_jsx_runtime.jsx)(Glyph, { name: "arrowRight", size: 14 })
              )
            ]
          }, question))
        ),
        (sugg.gaps || []).length ? el(
          "div",
          { className: "nb-gaprow", style: { marginTop: "14px" } },
          el("span", { className: "nb-meta", children: "Source gaps" }),
          sugg.gaps.slice(0, 3).map((g) => (0, import_jsx_runtime.jsx)(Chip, {
            key: g,
            onClick: () => onFindSources && onFindSources(g),
            title: "Find sources for this gap",
            children: g
          }))
        ) : null
      ) : null,
      msgs.map((m) => (0, import_jsx_runtime.jsx)(Msg, { msg: m, onCite, onOpenSource, notebook }, m.k)),
      pending ? el(
        "div",
        { className: "nb-msg", "data-role": "assistant" },
        el("span", { className: "nb-avatar", children: "HN" }),
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
          placeholder: "Ask a question or create something",
          "aria-label": "Ask the notebook",
          rows: 2
        }),
        el(
          "div",
          { className: "nb-askfoot" },
          (0, import_jsx_runtime.jsx)(Chip, {
            title: `${activeCount} of ${stats.sources || 0} sources are in context`,
            children: `${activeCount} source${activeCount === 1 ? "" : "s"}`
          }),
          askScope ? (0, import_jsx_runtime.jsx)(Chip, {
            tone: "accent",
            title: `Answering from ${askScope.title} only \u2014 click to clear`,
            onClick: () => setAskScope && setAskScope(null),
            children: `only: ${String(askScope.title || "source").slice(0, 28)}`
          }) : null,
          (0, import_jsx_runtime.jsx)(IconBtn, {
            icon: "sliders",
            label: "Configure chat",
            onClick: () => {
              const o = notebook.options || {};
              setCfg({
                chat_style: o.chat_style || "default",
                chat_length: o.chat_length || "medium",
                chat_custom: o.chat_custom || ""
              });
              setCfgOpen(true);
            }
          }),
          el("span", {
            className: "nb-hint",
            style: { marginLeft: "auto" },
            children: modelReady ? "\u23CE send \xB7 \u21E7\u23CE newline" : "model offline \u2014 enable the plugin and restart the gateway"
          }),
          el("button", {
            type: "button",
            className: "nb-sendbtn",
            onClick: () => send(),
            disabled: !text.trim() || !!pending,
            "aria-label": pending ? "Asking\u2026" : "Send question",
            title: pending ? "Asking\u2026" : "Send",
            children: (0, import_jsx_runtime.jsx)(Glyph, { name: "send", size: 15 })
          })
        )
      ),
      el("div", {
        className: "nb-disclaimer",
        children: "Hermes Notebook can make mistakes \u2014 double-check it."
      }),
      cfgOpen ? (0, import_jsx_runtime.jsx)(Dialog, {
        open: true,
        title: "Configure chat",
        onClose: () => setCfgOpen(false),
        children: el(
          "div",
          { style: { display: "grid", gap: "16px" } },
          el(
            "div",
            null,
            el("div", { className: "nb-meta", style: { marginBottom: "8px" }, children: "Response style" }),
            (0, import_jsx_runtime.jsx)(Seg, {
              label: "Response style",
              fill: true,
              value: cfg.chat_style || "default",
              onChange: (v) => setCfg((c) => ({ ...c, chat_style: v })),
              options: [
                { id: "default", label: "Default" },
                { id: "learning_guide", label: "Learning guide" },
                { id: "custom", label: "Custom" }
              ]
            }),
            cfg.chat_style === "custom" ? el("input", {
              className: "nb-genopt-text",
              type: "text",
              placeholder: "e.g. always end with a checklist",
              value: cfg.chat_custom || "",
              onChange: (e) => setCfg((c) => ({ ...c, chat_custom: e.target.value })),
              style: { marginTop: "8px", width: "100%" }
            }) : null
          ),
          el(
            "div",
            null,
            el("div", { className: "nb-meta", style: { marginBottom: "8px" }, children: "Response length" }),
            (0, import_jsx_runtime.jsx)(Seg, {
              label: "Response length",
              fill: true,
              value: cfg.chat_length || "medium",
              onChange: (v) => setCfg((c) => ({ ...c, chat_length: v })),
              options: [
                { id: "short", label: "Short" },
                { id: "medium", label: "Medium" },
                { id: "long", label: "Long" }
              ]
            })
          ),
          el(
            "div",
            { style: { display: "flex", gap: "8px", justifyContent: "flex-end" } },
            (0, import_jsx_runtime.jsx)(Btn, { onClick: () => setCfgOpen(false), children: "Cancel" }),
            (0, import_jsx_runtime.jsx)(Btn, {
              variant: "primary",
              disabled: cfgBusy,
              onClick: async () => {
                setCfgBusy(true);
                try {
                  await api("/options", {
                    method: "POST",
                    body: {
                      notebook: notebook.id,
                      options: {
                        chat_style: cfg.chat_style === "custom" ? "custom" : cfg.chat_style,
                        chat_length: cfg.chat_length,
                        chat_custom: cfg.chat_style === "custom" ? cfg.chat_custom : ""
                      }
                    },
                    timeoutMs: 3e4
                  });
                  setCfgOpen(false);
                  if (reload) reload();
                } catch (e) {
                  onSay && onSay(`could not save chat options: ${e.message || e}`);
                } finally {
                  setCfgBusy(false);
                }
              },
              children: "Save"
            })
          )
        )
      }) : null,
      threadsOpen && threads ? (0, import_jsx_runtime.jsx)(ThreadsDialog, {
        open: true,
        threads: threads.list || [],
        active: threads.name,
        busy: !!pending,
        onClose: () => setThreadsOpen(false),
        onOpen: (name) => {
          threads.onOpen(name);
          setThreadsOpen(false);
        },
        onNew: (title) => {
          threads.onNew(title);
          setThreadsOpen(false);
        },
        onRename: (name, title) => threads.onRename(name, title),
        onDelete: (name) => threads.onDelete(name)
      }) : null
    )
  );
}
var CITE_TEXT_CACHE = /* @__PURE__ */ new Map();
function Msg({ msg, onCite, notebook }) {
  const isUser = msg.role === "user";
  const [citePop, setCitePop] = (0, import_react.useState)(null);
  const citeFor = (n) => (msg.citations || []).find((c) => c.n === n);
  const onMouseOver = (e) => {
    const b = e.target && e.target.closest ? e.target.closest(".nb-inline-cite") : null;
    if (!b || !notebook) return;
    const n = Number(b.getAttribute("data-n"));
    const c = citeFor(n);
    if (!c) return;
    const r = b.getBoundingClientRect();
    setCitePop({ n, x: r.left, y: r.bottom + 8, title: c.title, kind: c.kind, id: c.id, text: null, loading: true });
    const key = `${notebook.id}:${c.id || n}`;
    if (CITE_TEXT_CACHE.has(key)) {
      setCitePop((p) => p && p.n === n ? { ...p, text: CITE_TEXT_CACHE.get(key), loading: false } : p);
      return;
    }
    if (!c.id) {
      setCitePop((p) => p && p.n === n ? { ...p, loading: false } : p);
      return;
    }
    api(`/source_text?${qs({ notebook: notebook.id, id: c.id, chars: 700 })}`, { timeoutMs: 2e4 }).then((out) => {
      const passage = String(out.text || out.source_text || "").replace(/\s+/g, " ").trim().slice(0, 420);
      CITE_TEXT_CACHE.set(key, passage);
      setCitePop((p) => p && p.n === n ? { ...p, text: passage, loading: false } : p);
    }).catch(() => {
      CITE_TEXT_CACHE.set(key, "");
      setCitePop((p) => p && p.n === n ? { ...p, text: "", loading: false } : p);
    });
  };
  const onMouseOut = (e) => {
    const b = e.target && e.target.closest ? e.target.closest(".nb-inline-cite") : null;
    if (b) setCitePop(null);
  };
  return el(
    "div",
    { className: "nb-msg", "data-role": isUser ? "user" : "assistant" },
    isUser ? null : el("span", { className: "nb-avatar", children: "HN" }),
    el(
      "div",
      { className: "nb-msg-body", onMouseOver: isUser ? void 0 : onMouseOver, onMouseOut: isUser ? void 0 : onMouseOut },
      isUser ? el(
        "div",
        { className: "nb-bubble" },
        el("div", { className: "nb-who", children: "You" }),
        el("div", { children: msg.content })
      ) : el(
        "div",
        null,
        el(
          "div",
          { className: "nb-who" },
          "Hermes Notebook",
          msg.meta ? el("span", { style: { marginLeft: "8px", color: T.text4, fontWeight: 500, textTransform: "none", letterSpacing: 0 }, children: `\xB7 ${msg.meta}` }) : null,
          notebook ? (0, import_jsx_runtime.jsx)(IconBtn, {
            icon: "pin",
            size: 13,
            label: "Save this answer as a note",
            onClick: async () => {
              try {
                const first = String(msg.content || "").split("\n").find((l) => l.trim()) || "Notebook answer";
                await api("/note", {
                  method: "POST",
                  body: { notebook: notebook.id, text: msg.content, title: first.slice(0, 90) },
                  timeoutMs: 3e4
                });
              } catch {
              }
            }
          }) : null
        ),
        el(
          "div",
          { className: "nb-bubble" },
          (0, import_jsx_runtime.jsx)(Markdown, { text: msg.content, onCite })
        ),
        (msg.citations || []).length ? el(
          "div",
          { style: { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }, role: "list", "aria-label": "Citations" },
          msg.citations.map((c) => el("button", {
            key: `${c.n}-${c.title}`,
            type: "button",
            className: "nb-chip nb-citechip",
            onClick: () => onCite && onCite(c.n),
            title: c.origin || c.title,
            "aria-label": `Citation ${c.n} \u2014 ${c.title}`,
            children: [el("b", { children: `S${c.n}` }), el("span", { children: c.title })]
          }))
        ) : null
      )
    ),
    citePop ? el("div", {
      className: "nb-citepop",
      role: "tooltip",
      style: { left: `${Math.min(citePop.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 340)}px`, top: `${citePop.y}px` },
      children: [
        el(
          "div",
          { className: "nb-citepop-head" },
          el("b", { children: `S${citePop.n}` }),
          el("span", { children: citePop.title || "source" }),
          citePop.kind ? el("span", { className: "nb-meta", children: citePop.kind }) : null
        ),
        el("div", {
          className: "nb-citepop-body",
          children: citePop.loading ? "reading the passage\u2026" : citePop.text ? `\u201C${citePop.text}${citePop.text.length >= 420 ? "\u2026" : ""}\u201D` : "passage unavailable \u2014 click the citation to open the source"
        })
      ]
    }) : null
  );
}
function SourcePeek({ source, notebook, onClose, onAskAbout }) {
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
          children: `${kindLabel(source.kind)} \xB7 ${nfmt(source.chars)} chars \xB7 ${source.origin || "stored text"}`
        })
      ),
      source.origin && source.origin.startsWith("http") ? (0, import_jsx_runtime.jsx)(IconBtn, { icon: "external", label: "Open the original", onClick: () => host2.openLink ? host2.openLink(source.origin) : window.open(source.origin, "_blank") }) : null,
      (0, import_jsx_runtime.jsx)(IconBtn, { icon: "close", label: "Close source", onClick: onClose })
    ),
    el(
      "div",
      { className: "nb-view-body" },
      onAskAbout ? el(
        "div",
        { style: { marginBottom: "14px" } },
        (0, import_jsx_runtime.jsx)(Btn, {
          size: "sm",
          icon: "faq",
          onClick: () => onAskAbout(source),
          children: "Ask about this source"
        })
      ) : null,
      (source.labels || []).length || source.summary ? el(
        "div",
        { style: { marginBottom: "14px", display: "grid", gap: "8px" } },
        source.summary ? el("div", { style: { fontSize: "14px", color: T.text2, lineHeight: 1.55 }, children: source.summary }) : null,
        (source.labels || []).length ? el(
          "div",
          { style: { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" } },
          (0, import_jsx_runtime.jsx)(Glyph, { name: "tag", size: 13 }),
          source.labels.map((l) => (0, import_jsx_runtime.jsx)(Chip, { key: l, children: l }))
        ) : null
      ) : null,
      err ? el("div", { style: { color: T.danger }, children: err }) : text ? el("pre", {
        className: "nb-mono",
        style: { whiteSpace: "pre-wrap", fontSize: "14.5px", lineHeight: 1.7, color: T.text2, margin: 0 },
        children: text
      }) : el("div", { className: "nb-hint", children: "reading\u2026" })
    )
  );
}
function StudioPanel({ kinds, notebook, busy, generate, filter, setFilter, onOpen, onCollapse, onAddNote }) {
  const ready = latestByKind(notebook ? notebook.artifacts : []);
  const arts = notebook && notebook.artifacts || [];
  const kindGroup = {};
  for (const k of kinds) kindGroup[k.id] = k.group || "other";
  const shownArts = arts.filter((a) => filter === "all" || kindGroup[a.kind] === filter);
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
  }, [shownArts.length, filter]);
  return el(
    "aside",
    { className: "nb-col nb-studio", "aria-label": "Studio" },
    el(
      "div",
      { className: "nb-pane-head" },
      el("span", { className: "nb-pane-title", children: "Studio" }),
      el("span", {
        className: "nb-chip",
        "data-tone": Object.keys(ready).length ? "ok" : void 0,
        children: `${Object.keys(ready).length}/${kinds.length}`
      }),
      (0, import_jsx_runtime.jsx)(IconBtn, { icon: "arrowRight", label: "Hide studio panel", onClick: onCollapse })
    ),
    el(
      "div",
      { className: "nb-pad", style: { paddingBottom: "8px" } },
      el(
        "div",
        { className: "nb-gen-grid" },
        kinds.map((k) => (0, import_jsx_runtime.jsx)(GenPill, {
          key: k.id,
          kind: k,
          art: ready[k.id],
          started: busy[k.id],
          nbId: notebook && notebook.id,
          onOpen: () => {
            const a = ready[k.id];
            if (a) onOpen(a);
            else generate(k.id);
          },
          onGenerate: (opts) => generate(k.id, opts)
        }))
      )
    ),
    el(
      "div",
      { className: "nb-pad", style: { paddingTop: "10px", paddingBottom: "4px", borderTop: `1px solid ${T.lineSoft}` } },
      el(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
        el("span", { className: "nb-meta", children: "Artifacts" }),
        el("span", { style: { flex: 1 } }),
        FILTERS.map((f) => (0, import_jsx_runtime.jsx)(Chip, {
          key: f.id,
          tone: filter === f.id ? "accent" : void 0,
          pressed: filter === f.id,
          onClick: () => setFilter(f.id),
          title: `${f.label} artifacts`,
          children: f.label
        }))
      )
    ),
    el(
      "div",
      { className: "nb-scroll", ref: scrollRef, "data-scrollable": canScroll ? "true" : "false" },
      el(
        "div",
        { className: "nb-artlist", style: { padding: "4px 8px 18px" } },
        shownArts.length === 0 ? el(
          "div",
          { className: "nb-hint", style: { padding: "14px 8px", lineHeight: 1.5 } },
          notebook && notebook.sources && notebook.sources.length ? "Nothing generated yet \u2014 pick an output above." : "Add sources first \u2014 every artifact is built from them."
        ) : shownArts.map((a, i) => el("button", {
          key: a.key || a.primary || i,
          type: "button",
          className: "nb-art",
          "data-kind": a.kind,
          onClick: () => onOpen(a),
          "aria-label": `Open ${a.label || a.kind}`,
          title: a.primary || a.label,
          children: [
            el(
              "span",
              { className: "nb-art-ico", "aria-hidden": "true" },
              i < 12 ? (0, import_jsx_runtime.jsx)(ArtThumb, { run: a, nbId: notebook && notebook.id }) : (0, import_jsx_runtime.jsx)(Glyph, { name: KIND_ICON[a.kind] || "doc", size: 17 })
            ),
            el(
              "span",
              { className: "nb-art-main" },
              el("span", { className: "nb-art-title", children: a.label || a.kind }),
              el("span", {
                className: "nb-art-sub",
                children: `${nfmt(a.bytes)} \xB7 ${ago(a.modified)}`
              })
            )
          ]
        }, a.key || a.primary || i))
      )
    ),
    canScroll ? (0, import_jsx_runtime.jsx)("div", { className: "nb-fade", "aria-hidden": "true" }) : null,
    el(
      "div",
      { className: "nb-pad", style: { borderTop: `1px solid ${T.lineSoft}`, display: "flex", justifyContent: "center", paddingTop: "10px", paddingBottom: "12px" } },
      (0, import_jsx_runtime.jsx)(Btn, { icon: "note", onClick: onAddNote, disabled: !notebook, children: "Add note" })
    )
  );
}
function GenPill({ kind, art, started, nbId, onOpen, onGenerate }) {
  const [, force] = (0, import_react.useState)(0);
  const [opts, setOpts] = (0, import_react.useState)({});
  const [cfgOpen, setCfgOpen] = (0, import_react.useState)(false);
  const [notes, setNotes] = (0, import_react.useState)(null);
  const [notesBusy, setNotesBusy] = (0, import_react.useState)(false);
  const [thumbs, setThumbs] = (0, import_react.useState)(null);
  const optSpecs = kind.options || [];
  (0, import_react.useEffect)(() => {
    if (!cfgOpen || !nbId) return void 0;
    let live = true;
    api(`/infographic_styles?previews=1&${qs({ notebook: nbId })}`, { timeoutMs: 12e4 }).then((out) => {
      if (live && out && out.previews) setThumbs(out.previews);
    }).catch(() => {
    });
    return () => {
      live = false;
    };
  }, [cfgOpen, nbId]);
  (0, import_react.useEffect)(() => {
    if (!started) return void 0;
    const t = setInterval(() => force((n) => n + 1), 1e3);
    return () => clearInterval(t);
  }, [started]);
  const secs = started ? Math.max(0, Math.round((Date.now() - started) / 1e3)) : 0;
  const state = started ? `writing \xB7 ${secs}s` : art ? `ready \xB7 ${ago(art.modified)}` : "Generate";
  const pick = (id, v) => setOpts((o) => ({ ...o, [id]: v }));
  return el(
    "div",
    { className: "nb-gen", "data-kind": kind.id },
    el("button", {
      type: "button",
      className: "nb-card",
      "data-kind": kind.id,
      "data-ready": art ? "true" : "false",
      "data-busy": started ? "true" : "false",
      onClick: started ? void 0 : art ? onOpen : () => onGenerate(opts),
      "aria-label": `${kind.label} \u2014 ${state}. ${art ? "Open it" : "Generate it"}`,
      title: art ? `${kind.label} \xB7 ${art.primary}` : `Generate ${kind.label}`,
      children: [
        el(
          "span",
          { className: "nb-card-ico", "aria-hidden": "true" },
          (0, import_jsx_runtime.jsx)(Glyph, { name: KIND_ICON[kind.id] || "doc", size: 15 })
        ),
        el(
          "span",
          { className: "nb-card-main" },
          el("span", { className: "nb-card-name", children: kind.label }),
          el(
            "span",
            { className: "nb-card-state" },
            el("span", {
              className: "nb-dot",
              style: { background: started ? "var(--kc)" : art ? T.ok : void 0 }
            }),
            started ? `${secs}s` : art ? ago(art.modified) : "generate"
          ),
          started ? el(
            "span",
            { className: "nb-bar-track", style: { marginTop: "2px" } },
            el("span", {
              className: "nb-bar-fill",
              style: { width: `${Math.min(96, 12 + secs * 2.2)}%`, opacity: 0.9 }
            })
          ) : null
        )
      ]
    }),
    optSpecs.length ? (0, import_jsx_runtime.jsx)(IconBtn, {
      icon: "sliders",
      label: `${kind.label} options`,
      className: "nb-gen-cfg",
      active: cfgOpen,
      onClick: () => setCfgOpen((o) => !o)
    }) : null,
    cfgOpen && optSpecs.length ? (0, import_jsx_runtime.jsx)(Dialog, {
      open: true,
      title: `${kind.label} options`,
      width: 560,
      onClose: () => setCfgOpen(false),
      children: el(
        "div",
        { style: { display: "grid", gap: "16px" } },
        optSpecs.map((spec) => el(
          "div",
          { key: spec.id, className: "nb-genopt" },
          el("div", { className: "nb-genopt-label", children: spec.label }),
          spec.kind === "text" ? el("input", {
            className: "nb-genopt-text",
            type: "text",
            placeholder: spec.placeholder || "",
            value: opts[spec.id] || "",
            onChange: (e) => pick(spec.id, e.target.value)
          }) : spec.kind === "select" ? el(
            "div",
            { className: "nb-stylewrap" },
            el(
              "div",
              { className: "nb-stylegrid", role: "radiogroup", "aria-label": spec.label },
              (spec.items || (spec.choices || []).map((c) => ({ id: c, label: c }))).map((it) => {
                const cur = (opts[spec.id] || spec.default || (spec.choices || [])[0]) === it.id;
                const src = thumbs && thumbs[it.id];
                const loaded = !!thumbs;
                return el("button", {
                  key: it.id,
                  type: "button",
                  role: "radio",
                  "aria-checked": cur ? "true" : "false",
                  className: "nb-styleopt",
                  "data-on": cur ? "true" : "false",
                  title: it.blurb || it.label,
                  onClick: () => pick(spec.id, it.id),
                  children: [
                    el(
                      "span",
                      { className: "nb-stylethumb", "data-empty": src ? void 0 : "true" },
                      src ? el("img", { src, alt: `${it.label} infographic style`, loading: "lazy" }) : null,
                      cur ? el("span", { className: "nb-stylecheck", "aria-hidden": "true", children: "\u2713" }) : null
                    ),
                    el("span", { className: "nb-stylelabel", children: it.label })
                  ]
                });
              })
            ),
            el("div", {
              className: "nb-stylehint",
              children: thumbs ? "Previews are this notebook\u2019s own last infographic, drawn in each style." : "Drawing previews\u2026"
            })
          ) : el(Seg, {
            value: opts[spec.id] || spec.choices[0],
            onChange: (v) => pick(spec.id, v),
            options: spec.choices.map((c) => ({
              id: c,
              label: c.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())
            }))
          })
        )),
        kind.id === "video_overview" && nbId ? el(
          "div",
          { style: { borderTop: `1px solid ${T.lineSoft}`, paddingTop: "12px", display: "grid", gap: "8px" } },
          (0, import_jsx_runtime.jsx)(Btn, {
            size: "sm",
            icon: "doc",
            disabled: notesBusy || started,
            onClick: async () => {
              setNotesBusy(true);
              try {
                const out = await api("/video_notes", {
                  method: "POST",
                  body: { notebook: nbId, style: opts.style || "cinematic", length: opts.length || "short" },
                  timeoutMs: 18e4
                });
                setNotes(out);
              } catch (e) {
                setNotes({ error: e.message || String(e) });
              } finally {
                setNotesBusy(false);
              }
            },
            children: notesBusy ? "Writing script\u2026" : "Review script first"
          }),
          notes && !notes.error ? (0, import_jsx_runtime.jsx)(Btn, {
            size: "sm",
            variant: "primary",
            disabled: started,
            onClick: () => {
              setCfgOpen(false);
              onGenerate({ ...opts, notes });
            },
            children: `Render with these notes (${(notes.beats || []).length} beats)`
          }) : null
        ) : null,
        el(
          "div",
          { style: {
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            borderTop: `1px solid ${T.lineSoft}`,
            paddingTop: "12px"
          } },
          (0, import_jsx_runtime.jsx)(Btn, { size: "sm", onClick: () => setCfgOpen(false), children: "Cancel" }),
          (0, import_jsx_runtime.jsx)(Btn, {
            size: "sm",
            variant: "primary",
            disabled: !!started,
            onClick: () => {
              setCfgOpen(false);
              onGenerate(opts);
            },
            children: art ? "Regenerate" : "Generate"
          })
        )
      )
    }) : null,
    notes ? (0, import_jsx_runtime.jsx)(Dialog, {
      open: true,
      title: notes.title || "Video producer notes",
      onClose: () => setNotes(null),
      width: 640,
      children: notes.error ? el("div", { style: { color: T.danger }, children: notes.error }) : el(
        "div",
        { style: { display: "grid", gap: "10px" } },
        el("div", { className: "nb-meta", children: `${(notes.beats || []).length} beats \xB7 ${notes.style} \xB7 ${notes.length}` }),
        (notes.beats || []).map((b, i) => el(
          "div",
          {
            key: i,
            style: {
              border: `1px solid ${T.lineSoft}`,
              borderRadius: "12px",
              padding: "10px 12px"
            }
          },
          el("div", {
            style: { fontSize: "12px", fontWeight: 650, color: T.accent, marginBottom: "4px" },
            children: `${String(i + 1).padStart(2, "0")} \xB7 ${b.headline || "beat"}`
          }),
          el("div", { style: { fontSize: "13px", color: T.text2, lineHeight: 1.5 }, children: b.text })
        ))
      )
    }) : null
  );
}
function ThreadsDialog({ open, threads, active, busy, onClose, onOpen, onNew, onRename, onDelete }) {
  const [title, setTitle] = (0, import_react.useState)("");
  const [editing, setEditing] = (0, import_react.useState)("");
  const [draft, setDraft] = (0, import_react.useState)("");
  const [confirming, setConfirming] = (0, import_react.useState)("");
  const list = threads || [];
  const commitRename = (name) => {
    const next = draft.trim();
    setEditing("");
    if (next) onRename(name, next);
  };
  return (0, import_jsx_runtime.jsx)(Dialog, {
    open: true,
    title: "Conversations",
    width: 620,
    onClose,
    children: el(
      "div",
      { style: { display: "grid", gap: "14px" } },
      el(
        "div",
        { className: "nb-newthread" },
        el("input", {
          className: "nb-genopt-text",
          type: "text",
          autoFocus: true,
          placeholder: "Name a new conversation (optional)",
          "aria-label": "New conversation name",
          value: title,
          onChange: (e) => setTitle(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") {
              onNew(title);
              setTitle("");
            }
          }
        }),
        (0, import_jsx_runtime.jsx)(Btn, {
          size: "sm",
          variant: "primary",
          icon: "plus",
          disabled: busy,
          onClick: () => {
            onNew(title);
            setTitle("");
          },
          children: "Start"
        })
      ),
      el(
        "div",
        { className: "nb-threadlist", role: "list", "aria-label": "Conversations" },
        list.length === 0 ? el("div", {
          className: "nb-hint",
          style: { padding: "10px 4px" },
          children: "No conversations yet \u2014 the first question starts one."
        }) : list.map((t) => {
          const on = t.name === active;
          const isEditing = editing === t.name;
          return el(
            "div",
            {
              key: t.name,
              className: "nb-threadrow",
              role: "listitem",
              "data-on": on ? "true" : "false"
            },
            el("button", {
              type: "button",
              className: "nb-threadrow-main",
              disabled: isEditing,
              onClick: () => onOpen(t.name),
              "aria-current": on ? "true" : void 0,
              "aria-label": `Open conversation ${t.title}`,
              children: [
                el("span", { className: "nb-threadrow-title", children: t.title }),
                el("span", {
                  className: "nb-threadrow-meta",
                  children: `${t.messages || 0} message${t.messages === 1 ? "" : "s"}` + (t.updated ? ` \xB7 ${ago(t.updated)}` : "")
                })
              ]
            }),
            isEditing ? el(
              "div",
              { className: "nb-threadrow-edit" },
              el("input", {
                className: "nb-genopt-text",
                type: "text",
                autoFocus: true,
                "aria-label": `Rename ${t.title}`,
                value: draft,
                onChange: (e) => setDraft(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === "Enter") commitRename(t.name);
                  if (e.key === "Escape") setEditing("");
                }
              }),
              (0, import_jsx_runtime.jsx)(Btn, { size: "sm", onClick: () => commitRename(t.name), children: "Save" })
            ) : el(
              "div",
              { className: "nb-threadrow-acts" },
              (0, import_jsx_runtime.jsx)(Btn, {
                size: "sm",
                icon: "note",
                label: `Rename ${t.title}`,
                children: "Rename",
                onClick: () => {
                  setEditing(t.name);
                  setDraft(t.title);
                  setConfirming("");
                }
              }),
              confirming === t.name ? (0, import_jsx_runtime.jsx)(Btn, {
                size: "sm",
                className: "nb-danger",
                label: `Confirm delete ${t.title}`,
                onClick: () => {
                  setConfirming("");
                  onDelete(t.name);
                },
                children: "Really delete"
              }) : (0, import_jsx_runtime.jsx)(Btn, {
                size: "sm",
                icon: "close",
                label: `Delete ${t.title}`,
                children: "Delete",
                onClick: () => setConfirming(t.name)
              })
            )
          );
        })
      ),
      el("div", {
        className: "nb-hint",
        children: "Each conversation keeps its own history; answers still cite the same sources."
      })
    )
  });
}
function ArtThumb({ run, nbId }) {
  const ext = String(run.ext || (run.primary || "").split(".").pop() || "").toLowerCase();
  if (ext === "png") return (0, import_jsx_runtime.jsx)(ThumbImg, { nbId, name: run.primary, alt: run.label || "" });
  if (ext === "mp3") return (0, import_jsx_runtime.jsx)(WaveThumb, { seed: `${run.kind}:${run.key || run.primary}` });
  return (0, import_jsx_runtime.jsx)(Glyph, { name: KIND_ICON[run.kind] || "doc", size: 17 });
}
function ThumbImg({ nbId, name, alt }) {
  const [url, setUrl] = (0, import_react.useState)("");
  (0, import_react.useEffect)(() => {
    if (!nbId || !name) return void 0;
    let live = true;
    let made = "";
    api(`/artifact?${qs({ notebook: nbId, name, b64: 1 })}`, { timeoutMs: 3e4 }).then((out) => {
      if (!live) return;
      const raw = atob(out.b64 || "");
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
      made = URL.createObjectURL(new Blob([bytes], { type: out.mime || "image/png" }));
      setUrl(made);
    }).catch(() => {
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [nbId, name]);
  return url ? el("img", { className: "nb-thumb-img", src: url, alt: alt || "" }) : null;
}
function WaveThumb({ seed }) {
  const bars = (0, import_react.useMemo)(() => {
    const n = 22;
    let x = 0;
    for (let i = 0; i < seed.length; i += 1) x = (x * 31 + seed.charCodeAt(i)) % 1e5;
    const out = [];
    for (let i = 0; i < n; i += 1) {
      x = (x * 1103515245 + 12345) % 2147483648;
      out.push(0.25 + x % 100 / 100 * 0.75);
    }
    return out;
  }, [seed]);
  return el(
    "span",
    { className: "nb-thumb-wave" },
    bars.map((h, i) => (0, import_jsx_runtime.jsx)("i", { key: `w${i}`, style: { height: `${Math.round(h * 100)}%` } }))
  );
}
function StatusBar({ mode, notebook, data, note, opsStats }) {
  const ready = data && data.model_ready;
  const ops = mode === "ops";
  const home = mode === "home";
  const notebooks = data && data.notebooks || [];
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
    ) : home ? el(
      "span",
      null,
      (0, import_jsx_runtime.jsx)("span", { className: "nb-sdot", style: { background: ready ? T.ok : T.warn } }),
      `${notebooks.length} notebook${notebooks.length === 1 ? "" : "s"} \xB7 `,
      ready ? "model ready" : "model offline"
    ) : el(
      "span",
      null,
      (0, import_jsx_runtime.jsx)("span", { className: "nb-sdot", style: { background: ready ? T.ok : T.warn } }),
      ready ? "grounded \xB7 model ready" : "model offline \u2014 enable the plugin"
    ),
    !ops && !home && notebook ? el(
      "span",
      null,
      (0, import_jsx_runtime.jsx)("b", { children: notebook.stats.sources }),
      " sources \xB7 ",
      (0, import_jsx_runtime.jsx)("b", { children: nfmt(notebook.stats.chars) }),
      " chars \xB7 ",
      (0, import_jsx_runtime.jsx)("b", { children: notebook.stats.labels }),
      " labels"
    ) : null,
    !ops && !home && notebook && notebook.stats.unlabeled ? (0, import_jsx_runtime.jsx)("span", {
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
  { id: "find", label: "Find for me", icon: "sparkle" },
  { id: "url", label: "Web URL", icon: "link" },
  { id: "path", label: "File path", icon: "file" },
  { id: "text", label: "Paste text", icon: "note" }
];
var hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
function AddSourceDialog({ open, onClose, notebook, onDone, initialMode, seedQuery, noteOnly }) {
  const [mode, setMode] = (0, import_react.useState)(noteOnly ? "note" : initialMode || "find");
  const [value, setValue] = (0, import_react.useState)("");
  const [title, setTitle] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [err, setErr] = (0, import_react.useState)("");
  const [cands, setCands] = (0, import_react.useState)(null);
  const [sel, setSel] = (0, import_react.useState)({});
  const [adding, setAdding] = (0, import_react.useState)(false);
  const [added, setAdded] = (0, import_react.useState)(null);
  const wasOpen = (0, import_react.useRef)(false);
  const fileRef = (0, import_react.useRef)(null);
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f || !notebook || busy) return;
    setBusy(true);
    setErr("");
    try {
      let body;
      if (f.path) {
        body = { notebook: notebook.id, path: f.path, title: f.name };
      } else if (f.size <= 15e5) {
        body = { notebook: notebook.id, text: await f.text(), title: f.name };
      } else {
        setErr("That file is too large to read here \u2014 switch to File path and give its location.");
        return;
      }
      const out = await api("/source", { method: "POST", body, timeoutMs: 12e4 });
      await onDone(out.source && out.source.title ? `added ${out.source.title}` : "file added");
    } catch (err2) {
      setErr(err2.message || String(err2));
    } finally {
      setBusy(false);
    }
  };
  (0, import_react.useEffect)(() => {
    if (open && !wasOpen.current) {
      setMode(noteOnly ? "note" : initialMode || "find");
      setValue("");
      setTitle("");
      setErr("");
      setCands(null);
      setSel({});
      setAdded(null);
      setBusy(false);
      setAdding(false);
      const seed = (seedQuery || "").trim();
      if (seed) {
        setValue(seed);
        return;
      }
      if (notebook && !noteOnly) {
        const t = `${notebook.title || ""}${notebook.description ? ` \u2014 ${notebook.description}` : ""}`.trim();
        if (t) setValue(t);
      }
    }
    wasOpen.current = open;
  }, [open, notebook, initialMode, seedQuery, noteOnly]);
  const pickMode = (m) => {
    setMode(m);
    if (m !== "find") {
      setCands(null);
      setAdded(null);
      setErr("");
    }
  };
  const find = async () => {
    const q = value.trim();
    if (!q || busy || !notebook) return;
    setBusy(true);
    setErr("");
    setAdded(null);
    try {
      const out = await api("/discover", {
        method: "POST",
        body: { notebook: notebook.id, query: q, max_results: 8 },
        timeoutMs: 9e4
      });
      const list = out.candidates || [];
      setCands(list);
      const all = {};
      for (const c of list) all[c.url] = true;
      setSel(all);
      if (!list.length) setErr("The search came back empty \u2014 try a broader description.");
    } catch (e) {
      setCands(null);
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  const addPicked = async () => {
    const urls = (cands || []).filter((c) => sel[c.url]).map((c) => c.url);
    if (!urls.length || adding || !notebook) return;
    setAdding(true);
    setErr("");
    try {
      const out = await api("/sources", {
        method: "POST",
        body: { notebook: notebook.id, urls },
        timeoutMs: 3e5
      });
      setAdded(out);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setAdding(false);
    }
  };
  const submit = async () => {
    if (!value.trim() || busy || !notebook) return;
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
  const pickedCount = (cands || []).filter((c) => sel[c.url]).length;
  const finish = () => onDone(added && added.added ? `added ${added.added} source${added.added === 1 ? "" : "s"}${added.duplicates ? ` \xB7 ${added.duplicates} already here` : ""}` : null);
  const findBody = () => {
    if (added) {
      const failed = (added.results || []).filter((r) => !r.ok);
      return el(
        "div",
        { style: { display: "grid", gap: "12px" } },
        el(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "11px" } },
          el("span", {
            className: "nb-avatar",
            "aria-hidden": "true",
            style: { background: "color-mix(in srgb, var(--ui-success, #3fb950) 16%, transparent)", color: "var(--ui-success, #3fb950)" },
            children: (0, import_jsx_runtime.jsx)(Glyph, { name: "check", size: 16 })
          }),
          el(
            "div",
            null,
            el("div", {
              style: { fontWeight: 650, fontSize: "15px" },
              children: `${added.added} source${added.added === 1 ? "" : "s"} added`
            }),
            el("div", { className: "nb-hint", children: added.duplicates ? `${added.duplicates} candidate${added.duplicates === 1 ? "" : "s"} turned out to be already here \u2014 nothing was duplicated.` : "They are extracted, labelled and indexed \u2014 ask or generate away." })
          )
        ),
        failed.length ? el(
          "div",
          { style: { display: "grid", gap: "6px" } },
          el("div", { className: "nb-meta", children: "Did not make it" }),
          failed.map((r) => el("div", {
            key: r.url,
            className: "nb-hint",
            style: { color: "var(--ui-danger, #f85149)" },
            children: `${hostOf(r.url) || r.url} \u2014 ${r.error || "failed"}`
          }))
        ) : null,
        el(
          "div",
          { style: { display: "flex", justifyContent: "flex-end", marginTop: "6px" } },
          (0, import_jsx_runtime.jsx)(Btn, { variant: "primary", icon: "check", onClick: finish, children: "Done" })
        )
      );
    }
    if (cands) {
      return el(
        "div",
        { style: { display: "grid", gap: "10px" } },
        el(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px" } },
          el("span", { className: "nb-meta", children: `Candidates \xB7 ${pickedCount} of ${cands.length} picked` }),
          el("span", { style: { flex: 1 } }),
          (0, import_jsx_runtime.jsx)(Btn, {
            size: "sm",
            icon: "refresh",
            onClick: () => {
              setCands(null);
              setErr("");
            },
            children: "Refine search"
          })
        ),
        el(
          "div",
          { className: "nb-cand-list", role: "group", "aria-label": "Candidate sources" },
          cands.map((c) => {
            const on = !!sel[c.url];
            const host3 = hostOf(c.url);
            return el("button", {
              type: "button",
              className: "nb-cand",
              "data-on": on ? "true" : "false",
              role: "checkbox",
              "aria-checked": on,
              "aria-label": `${on ? "Remove" : "Add"} source: ${c.title || c.url}`,
              onClick: () => setSel((s) => ({ ...s, [c.url]: !s[c.url] })),
              children: [
                el(
                  "span",
                  { className: "nb-cand-check", "aria-hidden": "true" },
                  on ? (0, import_jsx_runtime.jsx)(Glyph, { name: "check", size: 12 }) : null
                ),
                el(
                  "span",
                  { style: { minWidth: 0, flex: 1 } },
                  el("span", { className: "nb-cand-title", children: c.title || c.url }),
                  el(
                    "span",
                    { className: "nb-cand-sub" },
                    host3 ? el("span", { className: "nb-chip", children: host3 }) : null,
                    el("span", { children: (c.snippet || "").slice(0, 200) })
                  )
                )
              ]
            }, c.url);
          })
        ),
        el(
          "div",
          { style: { display: "flex", gap: "8px", justifyContent: "flex-end" } },
          (0, import_jsx_runtime.jsx)(Btn, { onClick: onClose, children: "Cancel" }),
          (0, import_jsx_runtime.jsx)(Btn, {
            variant: "primary",
            icon: "plus",
            onClick: addPicked,
            disabled: adding || !pickedCount,
            children: adding ? "Adding\u2026" : `Add ${pickedCount} source${pickedCount === 1 ? "" : "s"}`
          })
        )
      );
    }
    return el(
      "div",
      { style: { display: "grid", gap: "10px" } },
      el(
        "div",
        { className: "nb-field", style: { height: "42px" } },
        (0, import_jsx_runtime.jsx)(Glyph, { name: "sparkle", size: 15 }),
        el("input", {
          value,
          onChange: (e) => setValue(e.target.value),
          autoFocus: true,
          onKeyDown: (e) => {
            if (e.key === "Enter") find();
          },
          placeholder: "Describe what this notebook should know\u2026",
          "aria-label": "Describe the sources to find"
        })
      ),
      el("div", {
        className: "nb-hint",
        style: { padding: "0 2px" },
        children: "Hermes searches the web and offers candidate sources \u2014 nothing joins the notebook until you pick it. Already-covered urls are skipped automatically."
      }),
      err ? el("div", { style: { color: T.danger, fontSize: "14px" }, children: err }) : null,
      el(
        "div",
        { style: { display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" } },
        (0, import_jsx_runtime.jsx)(Btn, { onClick: onClose, children: "Cancel" }),
        (0, import_jsx_runtime.jsx)(Btn, {
          variant: "primary",
          icon: "search",
          onClick: find,
          disabled: busy || !value.trim() || !notebook,
          children: busy ? "Searching\u2026" : "Find sources"
        })
      )
    );
  };
  const submitNote = async () => {
    if (!value.trim() || busy || !notebook) return;
    setBusy(true);
    setErr("");
    try {
      const body = { notebook: notebook.id, text: value.trim() };
      if (title.trim()) body.title = title.trim();
      await api("/note", { method: "POST", body, timeoutMs: 6e4 });
      setValue("");
      setTitle("");
      await onDone("note saved \u2014 it is searchable now");
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  const noteBody = () => el(
    "div",
    null,
    el("p", {
      style: { margin: "0 0 14px", color: T.text3, fontSize: "14.5px", lineHeight: 1.55 },
      children: "A note becomes a first-class source \u2014 searchable, citable, and included in every answer and artifact."
    }),
    el(
      "div",
      { style: { display: "grid", gap: "10px" } },
      el("textarea", {
        value,
        onChange: (e) => setValue(e.target.value),
        autoFocus: true,
        placeholder: "Jot down the key points, a quote, a decision\u2026",
        "aria-label": "Note text",
        style: {
          minHeight: "150px",
          borderRadius: "12px",
          border: `1px solid ${T.line}`,
          background: T.cardDeep,
          color: T.text,
          padding: "12px",
          fontSize: "14.5px",
          lineHeight: 1.55,
          resize: "vertical",
          outline: "none"
        }
      }),
      el(
        "div",
        { className: "nb-field", style: { height: "40px" } },
        (0, import_jsx_runtime.jsx)(Glyph, { name: "note", size: 14 }),
        el("input", {
          value: title,
          onChange: (e) => setTitle(e.target.value),
          placeholder: "Title (optional)",
          "aria-label": "Note title"
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
        icon: "check",
        onClick: submitNote,
        disabled: busy || !value.trim() || !notebook,
        children: busy ? "Saving\u2026" : "Save note"
      })
    )
  );
  return (0, import_jsx_runtime.jsx)(Dialog, {
    open,
    onClose,
    title: noteOnly ? "Add a note" : "Add a source",
    width: mode === "find" && !noteOnly ? 620 : 520,
    children: noteOnly ? noteBody() : el(
      "div",
      null,
      el("p", {
        style: { margin: "0 0 14px", color: T.text3, fontSize: "14.5px", lineHeight: 1.55 },
        children: mode === "find" ? "Describe what this notebook should know \u2014 Hermes searches the web and offers candidates. Nothing joins until you pick it." : "A source is anything the notebook can cite: a URL, a file on this machine, or text you paste. It is extracted, labelled and indexed on the way in."
      }),
      (0, import_jsx_runtime.jsx)(Seg, { label: "Source kind", value: mode, onChange: pickMode, options: SOURCE_MODES }),
      el(
        "div",
        { style: { marginTop: "14px" } },
        mode === "find" ? findBody() : el(
          "div",
          null,
          el(
            "div",
            { style: { display: "grid", gap: "10px" } },
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
            { style: { display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px", alignItems: "center" } },
            el("input", {
              ref: fileRef,
              type: "file",
              hidden: true,
              onChange: onFile,
              accept: ".pdf,.docx,.pptx,.xlsx,.epub,.ipynb,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a"
            }),
            (0, import_jsx_runtime.jsx)(Btn, {
              icon: "folder",
              disabled: busy || !notebook,
              onClick: () => fileRef.current && fileRef.current.click(),
              children: "Upload file"
            }),
            el("span", { style: { flex: 1 } }),
            (0, import_jsx_runtime.jsx)(Btn, { onClick: onClose, children: "Cancel" }),
            (0, import_jsx_runtime.jsx)(Btn, {
              variant: "primary",
              icon: "plus",
              onClick: submit,
              disabled: busy || !value.trim() || !notebook,
              children: busy ? "Ingesting\u2026" : "Add source"
            })
          )
        )
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
  } else if (artifact.kind === "data_table") {
    body = (0, import_jsx_runtime.jsx)(DataTableView, { text: primary.text, name: artifact.primary });
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
      primary.text ? (0, import_jsx_runtime.jsx)(IconBtn, {
        icon: "copy",
        label: "Copy artifact text",
        onClick: () => {
          try {
            navigator.clipboard.writeText(primary.text);
          } catch {
          }
        }
      }) : null,
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
          el("span", {
            className: "nb-chip",
            style: { background: "rgba(255,255,255,.12)", color: "#cfd3e0", borderColor: "transparent" },
            children: "1.0\xD7"
          })
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
            borderRadius: "18px",
            overflow: "auto",
            background: "#0d1017",
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
        data && data._style ? el("span", {
          className: "nb-chip",
          title: "Infographic style",
          children: data._style.label
        }) : null,
        data && data.takeaway ? el("span", { className: "nb-chip", "data-tone": "accent", children: data.takeaway }) : null
      )
    )
  );
}
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", inQ = false;
  const s = String(text || "");
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else inQ = false;
      } else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    if (row.some((c) => c !== "")) rows.push(row);
  }
  return rows;
}
function DataTableView({ text, name }) {
  const rows = (0, import_react.useMemo)(() => parseCsv(text), [text]);
  const [sort, setSort] = (0, import_react.useState)({ col: -1, dir: 1 });
  const head = rows[0] || [];
  const body = rows.slice(1);
  const shown = (0, import_react.useMemo)(() => {
    if (sort.col < 0) return body;
    const i = sort.col;
    return [...body].sort((a, b) => {
      const x = String(a[i] || ""), y = String(b[i] || "");
      const nx = Number(x.replace(/[^0-9.\-]/g, "")), ny = Number(y.replace(/[^0-9.\-]/g, ""));
      const c = !Number.isNaN(nx) && !Number.isNaN(ny) && x !== "" && y !== "" ? nx - ny : x.localeCompare(y);
      return c * sort.dir;
    });
  }, [body, sort]);
  const exportCsv = () => {
    const blob = new Blob([text || ""], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name || "table.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4e3);
  };
  if (!head.length) {
    return el("div", { className: "nb-view-body" }, el("div", { className: "nb-hint", children: "empty table" }));
  }
  return el(
    "div",
    { className: "nb-view-body" },
    el(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" } },
      el("span", { className: "nb-meta", children: `${body.length} rows \xD7 ${head.length} columns` }),
      el("span", { style: { flex: 1 } }),
      (0, import_jsx_runtime.jsx)(Btn, { size: "sm", icon: "download", onClick: exportCsv, children: "Export CSV" })
    ),
    el(
      "div",
      { className: "nb-dt-wrap" },
      el(
        "table",
        { className: "nb-dt" },
        el("thead", null, el(
          "tr",
          null,
          head.map((h, i) => el("th", {
            key: i,
            onClick: () => setSort((s) => ({ col: i, dir: s.col === i ? -s.dir : 1 })),
            "aria-sort": sort.col === i ? sort.dir > 0 ? "ascending" : "descending" : "none",
            children: [h, sort.col === i ? el("span", { className: "nb-dt-arrow", children: sort.dir > 0 ? "\u2191" : "\u2193" }) : null]
          }, `h${i}`))
        )),
        el(
          "tbody",
          null,
          shown.map((r, ri) => el(
            "tr",
            { key: `r${ri}` },
            head.map((_, ci) => el("td", { key: `c${ci}`, children: String(r[ci] || "") }, `c${ci}`))
          ))
        )
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
  const host3 = hosts.find((h) => h.id === sel) || hosts[0] || null;
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
      "aria-label": "Lab operations"
    },
    el(
      "aside",
      { className: "nb-col", style: { flex: "0 0 330px" } },
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
              "aria-current": host3 && h.id === host3.id ? "true" : "false",
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
      { className: "nb-col nb-main-col", "aria-label": "Selected host" },
      host3 ? (0, import_jsx_runtime.jsx)(HostView, { host: host3, tab, setTab, onSay, key: host3.id }) : el(
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
function HostView({ host: host3, tab, setTab, onSay }) {
  const ok = host3.reachable;
  return el(
    "div",
    { className: "nb-col", style: { minHeight: 0 } },
    el(
      "div",
      { className: "nb-main-head" },
      el(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        el("h1", { className: "nb-h1", children: host3.name }),
        el("span", { className: "nb-chip", children: host3.role }),
        ok ? el("span", {
          className: "nb-chip",
          "data-tone": host3.patch_state === "patched" ? "ok" : "warn",
          children: host3.patch_state === "patched" ? "kernel patched" : `upgrade to ${host3.kernel_fix || "fix"}`
        }) : el("span", { className: "nb-chip", "data-tone": "danger", children: "unreachable" }),
        el("span", { style: { flex: 1 } }),
        el("span", { className: "nb-mono", style: { fontSize: "12px", color: T.text4 }, children: host3.dial || "" })
      ),
      ok ? el("p", { className: "nb-sub", children: `${host3.os || ""} \xB7 kernel ${host3.kernel || "?"} \xB7 up ${fmtUptime(host3.uptime_s)} \xB7 ${host3.cores || "?"} cores \xB7 load ${(host3.load || []).map((n) => Number(n).toFixed(2)).join(" / ")}` }) : el("p", { className: "nb-sub", style: { color: T.danger }, children: host3.error || "this host did not answer" }),
      ok ? el(
        "div",
        { className: "nb-strip", role: "group", "aria-label": "Host measurements" },
        el("div", { className: "nb-cell" }, el("b", { children: `${Math.round((host3.mem || {}).pct || 0)}%` }), el("span", { children: "memory" })),
        el("div", { className: "nb-cell" }, el("b", { children: `${Math.round((host3.disk || {}).pct || 0)}%` }), el("span", { children: "disk" })),
        el("div", { className: "nb-cell" }, el("b", { children: host3.containers_up || 0 }), el("span", { children: "containers" })),
        el("div", { className: "nb-cell" }, el("b", { style: { color: host3.failed_units ? T.danger : T.ok }, children: host3.failed_units || 0 }), el("span", { children: "failed units" })),
        el("div", { className: "nb-cell" }, el("b", { children: `${host3.measured_ms || 0}ms` }), el("span", { children: "probe" }))
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
    ok ? tab === "services" ? (0, import_jsx_runtime.jsx)(ServicesTab, { host: host3, onSay }) : tab === "terminal" ? (0, import_jsx_runtime.jsx)(TerminalTab, { host: host3, onSay }) : tab === "files" ? (0, import_jsx_runtime.jsx)(FilesTab, { host: host3 }) : tab === "snapshots" ? (0, import_jsx_runtime.jsx)(SnapshotsTab, { host: host3, onSay }) : (0, import_jsx_runtime.jsx)(AuditTab, { onSay }) : el(
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
function ServicesTab({ host: host3, onSay }) {
  const [state, setState] = (0, import_react.useState)({ loading: true, units: [], failed: 0, error: "" });
  const [q, setQ] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)("");
  const [result, setResult] = (0, import_react.useState)(null);
  const load = (0, import_react.useCallback)(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const out = await api(`/ops/services?${qs({ host: host3.id })}`, { timeoutMs: 45e3 });
      setState({ loading: false, units: out.units || [], failed: out.failed || 0, error: "" });
    } catch (e) {
      setState({ loading: false, units: [], failed: 0, error: e.message || String(e) });
    }
  }, [host3.id]);
  (0, import_react.useEffect)(() => {
    load();
  }, [load]);
  const op = async (unit, verb) => {
    setBusy(unit);
    setResult(null);
    try {
      const out = await api("/ops/service", {
        method: "POST",
        body: { host: host3.id, unit, op: verb, confirm: verb === "stop" || verb === "mask" ? unit : "" },
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
function TerminalTab({ host: host3, onSay }) {
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
        body: { host: host3.id, cmd: c },
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
        lines.length === 0 ? el("span", { style: { color: "#6f7488" }, children: `# ${host3.name} \u2014 commands run over ssh, every call lands in the audit log
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
          placeholder: `run a command on ${host3.name}`,
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
function FilesTab({ host: host3 }) {
  const [path, setPath] = (0, import_react.useState)("/home");
  const [state, setState] = (0, import_react.useState)({ loading: true, entries: [], parent: "/", error: "" });
  const [open, setOpen] = (0, import_react.useState)(null);
  const load = (0, import_react.useCallback)(async (p) => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const out = await api(`/ops/files?${qs({ host: host3.id, path: p })}`, { timeoutMs: 45e3 });
      setState({ loading: false, entries: out.entries || [], parent: out.parent || "/", error: "" });
      setPath(out.path || p);
    } catch (e) {
      setState({ loading: false, entries: [], parent: "/", error: e.message || String(e) });
    }
  }, [host3.id]);
  (0, import_react.useEffect)(() => {
    load(path);
  }, [load]);
  const readFile = async (name) => {
    const full = path.endsWith("/") ? path + name : `${path}/${name}`;
    try {
      const out = await api(`/ops/file?${qs({ host: host3.id, path: full, bytes: 6e4 })}`, { timeoutMs: 45e3 });
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
function SnapshotsTab({ host: host3, onSay }) {
  const [vmid, setVmid] = (0, import_react.useState)("100");
  const [state, setState] = (0, import_react.useState)({ loading: false, list: [], raw: "", error: "" });
  const [name, setName] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const load = (0, import_react.useCallback)(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const out = await api(`/ops/snapshots?${qs({ host: host3.id, vmid })}`, { timeoutMs: 6e4 });
      setState({ loading: false, list: out.snapshots || [], raw: out.raw || "", error: out.ok ? "" : out.raw || "qm refused" });
    } catch (e) {
      setState({ loading: false, list: [], raw: "", error: e.message || String(e) });
    }
  }, [host3.id, vmid]);
  const create = async () => {
    setBusy(true);
    try {
      const out = await api("/ops/snapshot", { method: "POST", body: { host: host3.id, vmid, name }, timeoutMs: 2e5 });
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
              style: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", border: `1px solid ${T.lineSoft}`, borderRadius: "12px", background: T.card }
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
            style: { border: `1px solid ${T.lineSoft}`, borderRadius: "12px", padding: "11px 13px", background: T.card }
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
    onClick: () => host2.navigate(ROUTE),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      minHeight: "24px",
      padding: "0 7px",
      border: 0,
      borderRadius: "7px",
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
  const ListRow2 = ListRow;
  const ToggleRow2 = ToggleRow;
  const SegmentedControl2 = SegmentedControl;
  const [surface, setSurface] = (0, import_react.useState)(() => persist.get("mode", "studio"));
  const [chip, setChip] = (0, import_react.useState)(() => persist.get("statusChip", true));
  const [state, setState] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    api("/health").then(setState).catch(() => setState(null));
  }, []);
  const rows = [];
  if (ListRow2) {
    rows.push((0, import_jsx_runtime.jsx)(ListRow2, {
      key: "surface",
      title: "Default surface",
      description: "Which half of the plugin opens first: the research studio, or the lab deck.",
      action: SegmentedControl2 ? (0, import_jsx_runtime.jsx)(SegmentedControl2, {
        value: surface,
        onChange: (v) => {
          setSurface(v);
          persist.set("mode", v);
        },
        items: [{ value: "studio", label: "Studio" }, { value: "ops", label: "Lab Ops" }]
      }) : null
    }));
  }
  if (ToggleRow2) {
    rows.push((0, import_jsx_runtime.jsx)(ToggleRow2, {
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
  if (ListRow2) {
    rows.push((0, import_jsx_runtime.jsx)(ListRow2, {
      key: "data",
      title: "Notebook store",
      description: state && state.data_root ? el("span", { className: "nb-mono", style: { fontSize: "12px" }, children: state.data_root }) : "backend not reachable from this window",
      hint: state && state.model_ready ? "model bound \u2014 answers and artifacts run through your provider" : "the agent half is not registered in this process (enable the plugin, restart the gateway)"
    }));
    rows.push((0, import_jsx_runtime.jsx)(ListRow2, {
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
        padding: "12px 14px",
        borderRadius: "14px",
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
      onClick: () => host2.navigate(ROUTE),
      children: "Open"
    })
  );
}
var plugin = {
  id: ID,
  name: "Notebook",
  description: "Ground sources into cited answers and study artifacts, and drive the lab fleet from the same window.",
  // On by default: the page is the product. A user's explicit toggle still wins.
  defaultEnabled: true,
  register(ctx) {
    setCtx(ctx);
    const shells = [
      ["route", ROUTES_AREA2, { path: ROUTE }, () => (0, import_jsx_runtime.jsx)(App, {})],
      ["nav", SIDEBAR_NAV_AREA2, { path: ROUTE, label: "Notebook", codicon: "notebook" }, void 0],
      [
        "status",
        STATUSBAR_AREAS2 ? STATUSBAR_AREAS2.right : "statusBar.right",
        { order: 118 },
        () => (0, import_jsx_runtime.jsx)(StatusChip, {})
      ],
      ["palette-studio", PALETTE_AREA2, {
        id: "notebook.open",
        label: "Notebook: open the studio",
        keywords: ["notebook", "studio", "sources", "research"],
        run: () => host2.navigate(ROUTE)
      }, void 0],
      ["palette-ops", PALETTE_AREA2, {
        id: "notebook.ops",
        label: "Notebook: open the lab deck",
        keywords: ["lab", "fleet", "ops", "homelab", "servers"],
        run: () => host2.navigate(`${ROUTE}?surface=ops`)
      }, void 0],
      ["palette-ask", PALETTE_AREA2, {
        id: "notebook.ask",
        label: "Notebook: ask the active notebook",
        keywords: ["ask", "notebook", "citation", "grounded"],
        run: () => {
          host2.navigate(ROUTE);
          if (host2.composer && host2.composer.setDraft) {
            host2.composer.setDraft(null, "Ask my active Hermes notebook a question grounded in its sources");
          }
        }
      }, void 0]
    ];
    for (const [id, area, data, render] of shells) {
      contribute(ctx, id, area, render ? { ...data, render } : data);
    }
    contribute(ctx, "directive", TRANSCRIPT_DIRECTIVE_AREA2, {
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

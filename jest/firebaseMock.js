// Every `@react-native-firebase/*` import resolves here under Jest. Any named
// export (getApp, getFirestore, collection, onSnapshot, ...) is a no-op
// function, and anything called returns undefined. Tests that need real
// Firestore behaviour mock the service they call, not this module.
const noop = () => undefined;

module.exports = new Proxy(
  {},
  {
    get: (_target, prop) => {
      if (prop === "__esModule") return true;
      if (prop === "default") return noop;
      return noop;
    },
  },
);

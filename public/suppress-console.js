// Production Console Suppressor - Inline Script
// This runs before React hydration to catch early logs

(function() {
  'use strict';
  
  // Only suppress in production
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Store originals
    const _console = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
      trace: console.trace,
      table: console.table,
      dir: console.dir,
      group: console.group,
      groupEnd: console.groupEnd,
      time: console.time,
      timeEnd: console.timeEnd,
    };
    
    // Override all console methods with no-ops
    const noop = function() {};
    
    console.log = noop;
    console.error = noop;
    console.warn = noop;
    console.info = noop;
    console.debug = noop;
    console.trace = noop;
    console.table = noop;
    console.dir = noop;
    console.dirxml = noop;
    console.group = noop;
    console.groupCollapsed = noop;
    console.groupEnd = noop;
    console.time = noop;
    console.timeEnd = noop;
    console.timeLog = noop;
    console.assert = noop;
    console.count = noop;
    console.countReset = noop;
    console.profile = noop;
    console.profileEnd = noop;
    
    // Prevent reopening via window.console
    Object.defineProperty(window, 'console', {
      get: function() {
        return {
          log: noop,
          error: noop,
          warn: noop,
          info: noop,
          debug: noop,
          trace: noop,
          table: noop,
          dir: noop,
          dirxml: noop,
          group: noop,
          groupCollapsed: noop,
          groupEnd: noop,
          time: noop,
          timeEnd: noop,
          timeLog: noop,
          assert: noop,
          count: noop,
          countReset: noop,
          profile: noop,
          profileEnd: noop,
        };
      },
      set: function() {
        // Prevent re-assignment
        return false;
      }
    });
  }
})();

// Production Console Suppressor - Inline Script
// This runs before React hydration to catch early logs

(function() {
  'use strict';
  
  // Only suppress in production
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Store originals
    var _console = {
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
    var noop = function() {};
    
    try { console.log = noop; } catch(e) {}
    try { console.error = noop; } catch(e) {}
    try { console.warn = noop; } catch(e) {}
    try { console.info = noop; } catch(e) {}
    try { console.debug = noop; } catch(e) {}
    try { console.trace = noop; } catch(e) {}
    try { console.table = noop; } catch(e) {}
    try { console.dir = noop; } catch(e) {}
    try { console.dirxml = noop; } catch(e) {}
    try { console.group = noop; } catch(e) {}
    try { console.groupCollapsed = noop; } catch(e) {}
    try { console.groupEnd = noop; } catch(e) {}
    try { console.time = noop; } catch(e) {}
    try { console.timeEnd = noop; } catch(e) {}
    try { console.timeLog = noop; } catch(e) {}
    try { console.assert = noop; } catch(e) {}
    try { console.count = noop; } catch(e) {}
    try { console.countReset = noop; } catch(e) {}
    try { console.profile = noop; } catch(e) {}
    try { console.profileEnd = noop; } catch(e) {}
    
    // Note: Object.defineProperty(window, 'console', ...) is NOT used here
    // because Safari/Firefox define window.console as non-configurable.
    // Attempting to redefine it throws a TypeError and crashes the page.
  }
})();

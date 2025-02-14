'use strict';

const Homey = require('homey');

class MyApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('Trafikverket weather has been initialized');
    this.setupGlobalFetch();
  }

  setupGlobalFetch() {
    if (!global.fetch) {
      global.fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
    }
    if (!global.AbortSignal.timeout) {
      global.AbortSignal.timeout = timeout => {
        const controller = new AbortController();
        const abort = setTimeout(() => {
          controller.abort();
        }, timeout);
        return controller.signal;
      }
    }
  }
}

module.exports = MyApp;
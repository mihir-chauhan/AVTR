const path = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    // Changes the cache location for Puppeteer to be inside the project folder.
    // This ensures the browser binary is present where the app is running.
    cacheDirectory: path.join(__dirname, '.cache', 'puppeteer'),
};

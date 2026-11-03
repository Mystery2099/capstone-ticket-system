import baseConfig from '../../playwright.config';
export default { ...baseConfig, testDir: '.', webServer: { ...baseConfig.webServer, cwd: '../..' } };

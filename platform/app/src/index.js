/**
 * Entry point for development and production PWA builds.
 */
import 'regenerator-runtime/runtime';
import { createRoot } from 'react-dom/client';
import App from './App';
import React from 'react';

/**
 * EXTENSIONS AND MODES
 * =================
 * pluginImports.js is dynamically generated from extension and mode
 * configuration at build time.
 *
 * pluginImports.js imports all of the modes and extensions and adds them
 * to the window for processing.
 */
import { modes as defaultModes, extensions as defaultExtensions } from './pluginImports';
import loadDynamicConfig from './loadDynamicConfig';
import { validateDeploymentLicense } from './utils/deploymentLicense';
export { history } from './utils/history';
export { preserveQueryParameters, preserveQueryStrings } from './utils/preserveQueryParameters';

function renderDeploymentLicenseError(container, validation) {
  const root = createRoot(container);
  const messages = {
    'missing-hospital': '当前访问链接缺少授权机构信息。',
    'hospital-mismatch': '当前机构未获得此部署包授权。',
    'host-mismatch': '当前访问域名未获得此部署包授权。',
  };

  root.render(
    React.createElement(
      'div',
      {
        style: {
          alignItems: 'center',
          background: '#0b0f17',
          color: '#f8fafc',
          display: 'flex',
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          height: '100vh',
          justifyContent: 'center',
          margin: 0,
          padding: 24,
        },
      },
      React.createElement(
        'div',
        { style: { maxWidth: 520, textAlign: 'center' } },
        React.createElement(
          'h1',
          { style: { fontSize: 22, fontWeight: 650, lineHeight: 1.35, margin: '0 0 12px' } },
          '授权校验未通过'
        ),
        React.createElement(
          'p',
          { style: { color: '#cbd5e1', fontSize: 15, lineHeight: 1.7, margin: 0 } },
          messages[validation.reason] || '当前部署包未授权在此环境中使用。'
        )
      )
    )
  );
}

loadDynamicConfig(window.config).then(async config_json => {
  // Reset Dynamic config if defined
  if (config_json !== null) {
    window.config = config_json;
  }

  const container = document.getElementById('root');
  const licenseValidation = await validateDeploymentLicense(window.config);
  if (!licenseValidation.ok) {
    renderDeploymentLicenseError(container, licenseValidation);
    return;
  }

  /**
   * Combine our appConfiguration with installed extensions and modes.
   * In the future appConfiguration may contain modes added at runtime.
   *  */
  const appProps = {
    config: window ? window.config : {},
    defaultExtensions,
    defaultModes,
  };

  const root = createRoot(container);
  root.render(React.createElement(App, appProps));
});

const widget = document.createElement('div');
widget.setAttribute('vw', '');
widget.className = 'enabled';

const accessButton = document.createElement('div');
accessButton.setAttribute('vw-access-button', '');
accessButton.className = 'active';

const pluginWrapper = document.createElement('div');
pluginWrapper.setAttribute('vw-plugin-wrapper', '');

const pluginTopWrapper = document.createElement('div');
pluginTopWrapper.className = 'vw-plugin-top-wrapper';
pluginWrapper.appendChild(pluginTopWrapper);
widget.append(accessButton, pluginWrapper);
document.body.appendChild(widget);

const script = document.createElement('script');
script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
script.async = true;
script.onload = () => {
  if (typeof window.VLibras?.Widget !== 'function') {
    console.error('O widget VLibras foi carregado, mas não pôde ser inicializado.');
    return;
  }
  new window.VLibras.Widget('https://vlibras.gov.br/app');
};
script.onerror = () => {
  console.error('Não foi possível carregar o widget VLibras.');
};
document.body.appendChild(script);

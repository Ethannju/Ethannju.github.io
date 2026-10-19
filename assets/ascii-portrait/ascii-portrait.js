(function registerAsciiPortraitAsset() {
  const scriptUrl = new URL(document.currentScript.src, document.baseURI);

  class AsciiPortrait extends HTMLElement {
    static get observedAttributes() {
      return ['portrait', 'preset', 'viewer', 'title', 'loading', 'transparent'];
    }

    constructor() {
      super();
      const shadow = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `
        :host {
          display: block;
          width: 100%;
          min-height: 240px;
          aspect-ratio: var(--ascii-portrait-ratio, 729 / 705);
          overflow: hidden;
          background: #000;
          contain: layout paint style;
        }

        iframe {
          display: block;
          width: 100%;
          height: 100%;
          border: 0;
          background: #000;
        }

        :host([transparent]),
        :host([transparent]) iframe {
          background: transparent;
        }
      `;
      this.frame = document.createElement('iframe');
      this.frame.setAttribute('part', 'frame');
      this.frame.setAttribute('allow', 'fullscreen');
      shadow.append(style, this.frame);
    }

    connectedCallback() {
      this.updateFrame();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.updateFrame();
    }

    updateFrame() {
      const viewerValue = this.getAttribute('viewer') || './index.html';
      const viewerUrl = new URL(viewerValue, scriptUrl);
      viewerUrl.searchParams.set('embed', '1');
      if (this.hasAttribute('transparent')) {
        viewerUrl.searchParams.set('transparent', '1');
      }

      const portraitValue = this.getAttribute('portrait');
      if (portraitValue) {
        viewerUrl.searchParams.set(
          'portrait',
          new URL(portraitValue, document.baseURI).href
        );
      }

      const presetValue = this.getAttribute('preset');
      if (presetValue) {
        viewerUrl.searchParams.set(
          'preset',
          new URL(presetValue, document.baseURI).href
        );
      }

      const nextSource = viewerUrl.href;
      if (this.frame.src !== nextSource) this.frame.src = nextSource;
      this.frame.title = this.getAttribute('title') || '动态 ASCII 肖像';
      this.frame.loading = this.getAttribute('loading') === 'eager' ? 'eager' : 'lazy';
    }
  }

  if (!customElements.get('ascii-portrait')) {
    customElements.define('ascii-portrait', AsciiPortrait);
  }
})();

(() => {
  const source = document.querySelector('#source-language');
  const target = document.querySelector('#target-language');
  const input = document.querySelector('#translator-input');
  const output = document.querySelector('#translator-output');
  const button = document.querySelector('#translate-button');
  const swap = document.querySelector('#swap-languages');
  const status = document.querySelector('#translator-status');
  const count = document.querySelector('#character-count');
  let requestController;

  const languageNames = { en: 'English', ar: 'Arabic', fr: 'French', es: 'Spanish', tr: 'Turkish' };

  function updateDirection() {
    output.dir = target.value === 'ar' ? 'rtl' : 'auto';
    input.dir = source.value === 'ar' ? 'rtl' : 'auto';
  }

  async function translate() {
    const text = input.value.trim();
    count.textContent = String(input.value.length);
    if (!text) {
      output.value = '';
      status.textContent = 'Enter some text to translate.';
      return;
    }
    if (source.value === target.value) {
      output.value = text;
      status.textContent = 'Both languages are the same.';
      return;
    }

    if (requestController) requestController.abort();
    requestController = new AbortController();
    button.disabled = true;
    button.textContent = 'Translating…';
    status.textContent = 'Translating with MyMemory…';

    try {
      const params = new URLSearchParams({ q: text, langpair: `${source.value}|${target.value}` });
      const response = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
        signal: requestController.signal,
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('Translation service is unavailable.');
      const data = await response.json();
      const translated = data?.responseData?.translatedText;
      if (typeof translated !== 'string' || !translated.trim()) {
        throw new Error(data?.responseDetails || 'No translation was returned.');
      }
      output.value = translated;
      updateDirection();
      status.textContent = `Translated to ${languageNames[target.value]}.`;
    } catch (error) {
      if (error.name === 'AbortError') return;
      output.value = '';
      status.textContent = 'Could not translate right now. Check your connection and try again.';
    } finally {
      button.disabled = false;
      button.innerHTML = 'Translate <span aria-hidden="true">→</span>';
    }
  }

  button.addEventListener('click', translate);
  input.addEventListener('input', () => { count.textContent = String(input.value.length); });
  source.addEventListener('change', updateDirection);
  target.addEventListener('change', updateDirection);
  swap.addEventListener('click', () => {
    const previousSource = source.value;
    source.value = target.value;
    target.value = previousSource;
    const previousText = input.value;
    input.value = output.value;
    output.value = previousText;
    count.textContent = String(input.value.length);
    status.textContent = 'Languages swapped. Translate again to refresh the result.';
    updateDirection();
  });
  updateDirection();
})();

(function () {
  if (document.getElementById('steam-helper-custom')) return;

  const container = document.getElementById('prices_user');
  if (!container) return;

  const card = document.createElement('div');
  card.id = 'steam-helper-custom';
  card.className = 'addfunds_area_purchase_game game_area_purchase_game';
  card.innerHTML = `
    <div class="addfunds_purchase_action game_purchase_action shp-action">
      <div class="game_purchase_action_bg">
        <div class="game_purchase_price price shp-price-input">
          <input id="shp-custom-input" type="text" inputmode="numeric" placeholder="${LANG.placeholder}">
        </div>
        <a class="btnv6_green_white_innerfade btn_medium shp-btn-disabled" id="shp-submit-btn" href="#">
          <span>${LANG.buttonText}</span>
        </a>
      </div>
    </div>
    <h1>${LANG.title}</h1>
    <p id="shp-helper-text">${LANG.minAmountText}</p>
  `;

  const first = container.querySelector('.addfunds_area_purchase_game');
  first ? container.insertBefore(card, first) : container.appendChild(card);

  const input = document.getElementById('shp-custom-input');
  const btn = document.getElementById('shp-submit-btn');
  const text = document.getElementById('shp-helper-text');

  input.addEventListener('input', () => {
    const raw = input.value.replace(/\D/g, '');
    if (!raw) {
      input.value = '';
      btn.classList.add('shp-btn-disabled');
      btn.classList.remove('shp-btn-enabled');
      text.textContent = LANG.minAmountText;
      text.className = '';
      return;
    }

    const n = parseInt(raw, 10);
    input.value = CONFIG.symbol + ' ' + n.toLocaleString('ko-KR');

    if (n < CONFIG.minAmount) {
      btn.classList.add('shp-btn-disabled');
      btn.classList.remove('shp-btn-enabled');
      text.textContent = LANG.minAmountError;
      text.className = 'shp-text-error';
    } else {
      btn.classList.remove('shp-btn-disabled');
      btn.classList.add('shp-btn-enabled');
      text.textContent = LANG.previewFormat(n);
      text.className = 'shp-text-success';
    }
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btn.click();
  });

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const n = parseInt(input.value.replace(/\D/g, ''), 10);

    if (isNaN(n) || n < CONFIG.minAmount) {
      text.textContent = LANG.inputError;
      text.className = 'shp-text-error';
      return;
    }

    const form = document.getElementById('form_addfunds');
    const amount = document.getElementById('input_amount');
    const currency = document.getElementById('input_currency');

    if (form && amount && currency) {
      amount.value = n * CONFIG.multiplier;
      currency.value = CONFIG.currency;
      form.submit();
    } else {
      text.textContent = LANG.formNotFoundError;
      text.className = 'shp-text-error';
    }
  });
})();

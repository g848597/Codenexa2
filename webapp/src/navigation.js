// БАГ, который чинит этот модуль: у docsApp.js, sportApp.js и legal.js кнопка
// "назад" запоминала только последнюю активную ВКЛАДКУ (.tab.active). Но когда
// раздел открывают со страницы продукта (view-product) — например, кнопкой
// "Открыть AI Sport →" на карточке продукта, — в этот момент ни одна вкладка
// не активна (productDetail.js снимает .active со всех вкладок при открытии
// страницы продукта). В результате lastActiveTabView оставался равным своему
// старому значению ('dashboard' по умолчанию), и "назад" из Sport/Docs/Legal
// всегда уводил на дашборд, а не туда, откуда пользователь реально пришёл —
// на страницу открытого продукта. Пользователь терял место в интерфейсе.
//
// Теперь любой полноэкранный раздел перед открытием вызывает
// captureReturnTarget(), который запоминает либо активную вкладку, либо (если
// была открыта страница продукта) сам этот продукт — а "назад" использует
// getReturnTarget() и, если нужно, зовёт reopenProduct().

let returnTarget = { type: 'tab', view: 'dashboard' };
let currentProductId = null;
let reopenProductFn = null;

// productDetail.js регистрирует здесь свою функцию открытия продукта — так
// navigation.js не импортирует productDetail.js напрямую (а то получился бы
// цикл: productDetail → docsApp/sportApp/legal → navigation → productDetail).
export function registerProductReopener(fn) {
  reopenProductFn = fn;
}

// productDetail.js вызывает это при открытии страницы продукта, чтобы
// navigation.js знал, какой именно продукт сейчас открыт.
export function setCurrentProductId(productId) {
  currentProductId = productId;
}

export function captureReturnTarget() {
  const productView = document.getElementById('view-product');
  if (productView && productView.classList.contains('active') && currentProductId) {
    returnTarget = { type: 'product', productId: currentProductId };
    return;
  }
  const activeTab = document.querySelector('.tab.active');
  if (activeTab) {
    returnTarget = { type: 'tab', view: activeTab.dataset.view };
  }
  // Если ни продукт, ни вкладка не активны (например, один полноэкранный
  // раздел открыл другой), оставляем предыдущее значение — оно надёжнее, чем
  // сброс на дашборд.
}

export function getReturnTarget() {
  return returnTarget;
}

// Возвращает true, если удалось вернуться на страницу продукта (вызывающий
// код в этом случае не должен сам активировать какой-либо .view/.tab).
export function reopenProductIfNeeded(target) {
  if (target.type === 'product' && reopenProductFn) {
    reopenProductFn(target.productId);
    return true;
  }
  return false;
}

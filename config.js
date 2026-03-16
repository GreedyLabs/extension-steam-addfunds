const CONFIG = {
  currency: 'KRW',
  minAmount: 5000,
  multiplier: 100,
  symbol: '₩'
};

const LANG = {
  title: 'Steam 충전',
  minAmountText: '최소 5,000원 이상',
  placeholder: '예: 5,000',
  buttonText: '자금 추가',
  previewFormat: (amount) => `${amount.toLocaleString('ko-KR')}원 충전`,
  minAmountError: '최소 5,000원 이상',
  inputError: '5,000원 이상 입력해주세요.',
  formNotFoundError: '충전 폼을 찾을 수 없습니다. 페이지를 새로고침 해주세요.'
};

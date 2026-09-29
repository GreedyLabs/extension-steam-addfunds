# Steam 충전 도우미

Steam 지갑에 원하는 금액을 자유롭게 충전할 수 있는 Chrome / Edge 확장 프로그램입니다.

## 기능

- 💰 커스텀 금액 입력 (페이지의 최소 충전 금액 자동 감지)
- ⚡ Steam 기본 충전 금액을 입력칸 옆의 빠른 선택 버튼으로 제공
- 🎯 목표 지갑 잔액을 입력하면 현재 잔액에서 부족한 충전 금액 자동 계산
- 🧾 현재 잔액·충전 금액·충전 후 예상 잔액 미리보기
- 🛒 장바구니 부족액을 계산해 충전 페이지에 자동 입력
- ↩️ 충전 페이지에서 장바구니로 돌아가기
- 🌐 브라우저 언어에 따른 다국어 지원 (한국어 / English / 日本語 / 简体中文, 미지원 언어는 영어) 및 통화 자동 포맷

샘플 금액으로 새 화면을 확인하려면 `pnpm preview`를 실행한 뒤 `.preview/index.html`을 브라우저에서 여세요. 실제 결제 없이 충전 금액 입력, 목표 잔액, 최소 충전액 적용, 입력 오류를 확인할 수 있습니다.

## 설치 방법

소스에서 직접 빌드해 로드합니다. ([pnpm](https://pnpm.io) 필요)

```bash
git clone https://github.com/GreedyLabs/extension-steam-addfunds.git
cd extension-steam-addfunds
pnpm install
pnpm build
```

1. Chrome에서 `chrome://extensions/` 접속 (Edge는 `edge://extensions/`)
2. 우측 상단 "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. 빌드 결과물인 **`dist/`** 폴더 선택

> `pnpm build`는 `src/`의 TypeScript를 번들해 `dist/`에 로드 가능한 확장(`content.js`, `cart.js`, `manifest.json`, `styles.css`, `_locales/`)을 생성합니다. 브라우저에는 `dist/` 폴더를 로드해야 합니다.

## 사용 방법

1. [Steam 지갑 충전 페이지](https://store.steampowered.com/steamaccount/addfunds)에 접속합니다.
2. 상단의 "Steam 충전" 카드에서 "충전 금액" 또는 "목표 잔액"을 선택합니다.
3. 충전할 금액을 입력하거나 빠른 선택 버튼을 누릅니다. "목표 잔액"에서는 맞출 지갑 잔액을 직접 입력합니다.
4. 현재 지갑 잔액·충전 금액·충전 후 예상 잔액 미리보기를 확인합니다.
5. "자금 추가" 버튼을 클릭하거나 입력칸에서 엔터 키를 눌러 Steam의 결제 화면으로 이동합니다.

Steam의 기본 충전 금액 카드는 "Steam 충전" 카드 안의 빠른 선택 버튼으로 표시됩니다. 빠른 선택 버튼은 입력 금액만 설정하며 결제 화면으로 바로 이동하지 않습니다. "목표 잔액"을 선택하면 이 버튼은 숨겨지고 목표 금액을 직접 입력할 수 있습니다.

"목표 잔액"은 현재 지갑 잔액에서 부족한 만큼을 계산합니다. 필요한 금액이 Steam 페이지의 최소 충전액보다 작으면 최소 충전액을 적용하고, 이 확장 프로그램에서 입력 가능한 금액 단위로 올림합니다. 이 경우 충전 후 잔액이 목표보다 많을 수 있으므로 미리보기에 표시된 금액을 확인하세요. 이미 목표 잔액 이상이면 추가 충전이 필요하지 않다고 안내합니다.

현재 원화 입력은 확장 프로그램에서 1원 단위로 제한합니다. `5,000.00`처럼 소수부가 모두 0인 입력은 허용하지만 `5,000.50`처럼 0이 아닌 소수부는 허용하지 않습니다. Steam 자체가 원화 소수 금액 충전을 허용하는지는 검증하지 않았습니다.

[장바구니](https://store.steampowered.com/cart/)에서는 현재 지갑 잔액이 부족할 때 결제 버튼 아래에 충전 버튼이 나타납니다. 버튼을 누르면 장바구니에서 계산한 부족액을 충전 페이지에 자동 입력합니다. 이후에는 직접 접속했을 때와 같은 충전 화면에서 금액을 조정하고, 현재 지갑 잔액·충전 금액·충전 후 예상 잔액을 확인할 수 있습니다. "장바구니로 돌아가기"를 누르면 장바구니로 이동합니다.

## 개발

```bash
pnpm install        # 의존성 설치 (최초 1회)
pnpm dev            # src/ 변경 시 dist/ 자동 재빌드 (watch)
pnpm build          # dist/ 1회 빌드
pnpm preview        # 실제 UI 코드로 대화형 미리보기 생성 (.preview/index.html)
pnpm test           # 금액 계산 및 화면 통합 테스트 (Vitest)
pnpm check          # 타입체크 + 린트 + 포맷 + 테스트 (CI와 동일한 게이트)
pnpm build:zip      # 스토어 업로드용 extension.zip 생성
```

수정 후에는 `dist/`를 재빌드하고 `chrome://extensions/`에서 확장의 새로고침(↻)을 누르면 반영됩니다.

## 기술 스택

- TypeScript (esbuild 번들)
- Chrome Extension Manifest V3
- Vitest · ESLint · Prettier

## 라이선스

MIT

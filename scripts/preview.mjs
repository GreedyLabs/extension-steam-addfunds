// Build a standalone, interactive preview using the actual extension UI and sample data.
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const output = resolve(process.argv[2] ?? '.preview/index.html');
const bundled = await build({
  entryPoints: ['src/content.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  target: 'es2022',
  charset: 'utf8',
});
const locales = Object.fromEntries(
  await Promise.all(
    ['en', 'ko', 'ja', 'zh_CN'].map(async (code) => [
      code,
      JSON.parse(await readFile(`_locales/${code}/messages.json`, 'utf8')),
    ]),
  ),
);
const styles = await readFile('styles.css', 'utf8');
const presetCards = [5000, 10000, 25000, 50000, 100000]
  .map((amount, index) => {
    const formatted = `₩ ${new Intl.NumberFormat('ko-KR').format(amount)}`;
    return `<div class="addfunds_area_purchase_game game_area_purchase_game preset"><div><h2>${formatted} 추가</h2>${index === 0 ? '<small>최소 충전액</small>' : ''}</div><div class="game_purchase_action"><span class="price">${formatted}</span><a data-amount="${amount * 100}" data-currency="KRW">자금 추가</a></div></div>`;
  })
  .join('');
const safeScript = (value) => value.replaceAll('</script', '<\\/script');
const html = `<!doctype html>
<html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Steam 충전 도우미 · 미리보기</title>
<link rel="stylesheet" href="https://store.fastly.steamstatic.com/public/shared/css/motiva_sans.css?v=YzJgj1FjzW34&amp;l=koreana&amp;_cdn=fastly">
<style>
*{box-sizing:border-box}body{margin:0;background:#182735;color:#c7d5e0;font:400 12px/normal "Motiva Sans",sans-serif}header{background:#101923;border-bottom:1px solid #314454;padding:26px max(24px,calc((100vw - 1020px)/2));}header small{color:#66c0f4;letter-spacing:2px;font-size:11px}header h1{color:#fff;font-size:26px;font-weight:500;margin:8px 0}header p{color:#8fa8bb;margin:0;font-size:14px;line-height:1.5}main{max-width:1020px;margin:36px auto;padding:0 24px;display:grid;grid-template-columns:minmax(0,620px) minmax(220px,1fr);gap:32px;align-items:start}.toolbar{font-size:14px;line-height:1.5;display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:18px}.toolbar select{background:#14212d;color:#c7d5e0;border:1px solid #496073;padding:9px;border-radius:3px;font:inherit}.page-title{font-size:23px;font-weight:400;color:#fff;margin:0 0 20px}.addfunds_area_purchase_game{margin-bottom:16px}.preset{background:#203344;padding:18px 22px;border-radius:3px;display:flex;justify-content:space-between;align-items:center;color:#92a9bb}.preset h2{margin:0;color:#b8c9d7;font-size:17px;font-weight:400}.preset small{font-size:11px}.preset a{padding:8px 15px;color:#b8c9d7;background:#304e61;pointer-events:none;border-radius:3px}.sample{font-size:14px;line-height:1.5;padding:20px;background:#101f2c;border-top:2px solid #66c0f4}.sample h2{font-size:12px;letter-spacing:1px;color:#8fa8bb;margin:0 0 18px}.sample p{margin:8px 0}.sample strong{display:block;font-size:26px;color:#fff;font-weight:400;font-variant-numeric:tabular-nums}.sample hr{border:0;border-top:1px solid #314454;margin:20px 0}.sample .explain{font-size:12px;color:#8fa8bb;line-height:1.8}.demo-notice{border:1px solid #546e47;background:#273d29;padding:14px;color:#d0e7ba;margin-top:16px}.demo-notice[hidden]{display:none}footer{max-width:1020px;margin:24px auto;padding:0 24px 36px;color:#768c9d;font-size:12px}@media(max-width:800px){main{grid-template-columns:1fr;max-width:680px}.sample{order:-1}.sample strong{display:inline;font-size:19px}.sample hr,.sample .explain{display:none}main{gap:20px;margin-top:24px}}
#prices_user .addfunds_area_purchase_game{font-size:13px;line-height:normal}#prices_user h1{font-size:21px;line-height:23px;font-weight:400}.preset[hidden]{display:none}.preset .game_purchase_action{display:flex;align-items:center;gap:12px}.preset .price{font-size:14px;color:#fff}
${styles}</style>
<header><small>STEAM ADD FUNDS HELPER</small><h1>충전 화면 미리보기</h1><p>샘플 데이터로 직접 확인할 수 있습니다. 실제 결제는 진행되지 않습니다.</p></header>
<main><section><div class="toolbar"><label for="scenario">예시</label><select id="scenario"><option value="amount">충전 금액 입력</option><option value="cart">장바구니에서 금액 가져오기</option><option value="target">목표 잔액 맞추기</option><option value="minimum">최소 충전액 적용</option><option value="invalid">잘못된 소수 입력</option></select><label for="language">언어</label><select id="language"><option value="ko">한국어</option><option value="en">English</option><option value="ja">日本語</option><option value="zh_CN">简体中文</option></select></div>
<h2 class="page-title">Steam 지갑에 자금 추가</h2><div id="prices_user">${presetCards}</div><div id="demo-notice" class="demo-notice" role="status" hidden></div></section>
<aside class="sample"><h2>미리보기용 샘플</h2><p>현재 지갑 잔액<strong id="header_wallet_balance">₩ 32,150</strong></p><hr><p>최소 충전액<strong>₩ 5,000</strong></p><hr><p class="explain">충전 금액을 직접 정하거나 목표 잔액을 입력해 보세요.<br><br>최소 충전액이 적용되면 실제로 도달하는 잔액이 계산 내역에 표시됩니다.</p></aside></main><footer>실제 확장 프로그램과 동일한 화면·계산 코드를 사용하는 로컬 미리보기입니다.</footer>
<form id="form_addfunds"><input id="input_amount" type="hidden"><input id="input_currency" type="hidden"></form>
<script>
const locales=${safeScript(JSON.stringify(locales))};
const query=new URLSearchParams(location.search);const language=query.get('lang')||'ko';const selected=locales[language]||locales.en;
document.documentElement.lang=language.replace('_','-');
window.chrome={i18n:{getUILanguage:()=>language.replace('_','-'),getMessage:(key,values=[])=>{let message=(selected[key]||locales.en[key])?.message||key;message=message.replace(/\\$AMOUNT\\$/g,String(values[0]??''));return message;}}};
const scenario=query.get('scenario')||'amount';const hash=scenario==='cart'?'#shp=17850':'';history.replaceState(null,'',location.pathname+location.search+hash);
document.querySelector('#scenario').value=scenario;document.querySelector('#language').value=language;
function changeScenario(){const params=new URLSearchParams({scenario:document.querySelector('#scenario').value,lang:document.querySelector('#language').value});location.search=params.toString();}
document.querySelector('#scenario').addEventListener('change',changeScenario);document.querySelector('#language').addEventListener('change',changeScenario);
document.querySelector('#form_addfunds').submit=()=>{const notice=document.querySelector('#demo-notice');notice.hidden=false;notice.textContent='미리보기: '+new Intl.NumberFormat(language.replace('_','-'),{style:'currency',currency:'KRW'}).format(Number(document.querySelector('#input_amount').value)/100)+' 충전 요청을 확인했습니다. 실제 결제는 진행되지 않았습니다.';queueMicrotask(()=>window.dispatchEvent(new Event('pageshow')));};
</script><script>${safeScript(bundled.outputFiles[0].text)}</script><script>
if(scenario!=='cart'){
 if(scenario==='target'||scenario==='minimum')document.querySelector('#shp-mode-target').click();
 const field=document.querySelector('#shp-custom-input');field.value=scenario==='target'?'50000':scenario==='minimum'?'33000':scenario==='invalid'?'5,000.50':'17850';field.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste'}));field.blur();
}
document.querySelector('.shp-back-link').addEventListener('click',event=>{event.preventDefault();const notice=document.querySelector('#demo-notice');notice.hidden=false;notice.textContent='실제 확장 프로그램에서는 Steam 장바구니로 돌아갑니다.';});
</script></html>`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, html);
console.log(`Preview written to ${output}`);

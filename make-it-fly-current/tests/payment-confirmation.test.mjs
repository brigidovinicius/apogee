import assert from 'node:assert/strict';
import test from 'node:test';
import { opportunityLoader } from './helpers/load-opportunity-module.mjs';

function harness() {
  const previousWindow=globalThis.window, previousDocument=globalThis.document;
  let interval, timeout, cleanup, refreshes=0, waiting=false, intervalCleared=0, timeoutCleared=0;
  globalThis.document={visibilityState:'visible'};
  globalThis.window={
    setInterval(fn,ms){assert.equal(ms,3000);interval=fn;return 1;},
    setTimeout(fn,ms){assert.equal(ms,60000);timeout=fn;return 2;},
    clearInterval(id){assert.equal(id,1);intervalCleared++;interval=undefined;},
    clearTimeout(id){assert.equal(id,2);timeoutCleared++;timeout=undefined;},
  };
  let mounted=false;
  const Component=opportunityLoader({
    react:{useState:()=>[waiting,value=>{waiting=value;}],useEffect:fn=>{if(!mounted){cleanup=fn();mounted=true;}}},
    'next/navigation':{useRouter:()=>({refresh:()=>{refreshes++;}})},
  })('components/members/annual-payment-confirmation.tsx').AnnualPaymentConfirmation;
  return {render:()=>Component(),tick:()=>interval?.(),expire:()=>timeout?.(),
    get refreshes(){return refreshes;},get intervalCleared(){return intervalCleared;},get timeoutCleared(){return timeoutCleared;},
    unmount(){cleanup();},restore(){if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}};
}

test('waiting refreshes server state only while visible and cleans timers when payment is confirmed or route leaves',()=>{
  const view=harness();try {
    view.render();view.tick();assert.equal(view.refreshes,1);
    document.visibilityState='hidden';view.tick();assert.equal(view.refreshes,1);
    document.visibilityState='visible';view.tick();assert.equal(view.refreshes,2);
    view.unmount();view.tick();assert.equal(view.refreshes,2);
    assert.equal(view.intervalCleared,1);assert.equal(view.timeoutCleared,1);
  }finally{view.restore();}
});

test('delayed confirmation stops automatic requests, offers manual refresh and never claims payment succeeded',()=>{
  const view=harness();try {
    view.render();view.expire();view.tick();assert.equal(view.refreshes,0);
    const result=view.render();
    assert.match(result.props.children[0].props.children[0].props.children,/levando um pouco mais de tempo/);
    assert.match(result.props.children[0].props.children[1].props.children,/Não é necessário pagar novamente/);
    result.props.children[1].props.onClick();assert.equal(view.refreshes,1);
    view.unmount();
  }finally{view.restore();}
});
